"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ControlButton from "./ControlButton";
import type { MacroData } from "./lib/macro";
import type { NewsHeadline } from "./lib/bloomberg";

type News = { headlines: NewsHeadline[]; checkedAt: number };
const time = (value: number | string) => new Date(value).toLocaleString("en-GB", { timeZone: "Asia/Bangkok", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

export function useEconomicFeeds(enabled = true) {
  const [macro, setMacro] = useState<MacroData | null>(null);
  const [news, setNews] = useState<News | null>(null);
  const [errors, setErrors] = useState({ macro: false, news: false });
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    async function load() {
      const results = await Promise.allSettled([
        fetch("/api/macro", { signal: controller.signal, cache: "no-store" }).then(async response => {
          const value = await response.json();
          if (!response.ok || !Array.isArray(value.events) || !Number.isFinite(value.checkedAt)) throw Error("Macro unavailable");
          return value as MacroData;
        }),
        fetch("/api/news", { signal: controller.signal, cache: "no-store" }).then(async response => {
          const value = await response.json();
          if (!response.ok || !Array.isArray(value.headlines) || !Number.isFinite(value.checkedAt)) throw Error("News unavailable");
          return value as News;
        }),
      ]);
      if (controller.signal.aborted) return;
      if (results[0].status === "fulfilled") setMacro(results[0].value);
      if (results[1].status === "fulfilled") setNews(results[1].value);
      setErrors({ macro: results[0].status === "rejected", news: results[1].status === "rejected" });
      setLoading(false);
    }
    void load();
    const timer = window.setInterval(() => void load(), 300_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [enabled, request]);
  return { macro, news, errors, loading, refresh: () => { setLoading(true); setRequest(value => value + 1); } };
}

export default function MarketBriefing({ feed }: { feed: ReturnType<typeof useEconomicFeeds> }) {
  const { macro, news, errors, loading, refresh } = feed;
  const [newsIndex,setNewsIndex]=useState(0);
  const [newsPaused,setNewsPaused]=useState(false);
  const factory = macro?.forexFactory;
  const cpi = [...(factory?.events ?? [])].filter(event => event.isCpi).sort((a,b) => b.time-a.time).slice(0,3);
  const next = macro?.events.filter(event => event.time >= macro.checkedAt).sort((a,b) => a.time-b.time)[0];
  const headlines=news?.headlines??[];
  const activeNewsIndex=headlines.length?newsIndex%headlines.length:0;
  const story=headlines[activeNewsIndex]??null;
  useEffect(()=>{
    if(newsPaused||headlines.length<2||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    const timer=window.setInterval(()=>setNewsIndex(index=>(index+1)%headlines.length),9000);
    return()=>window.clearInterval(timer);
  },[headlines.length,newsPaused]);
  return <div className="market-briefing">
    <div className="briefing-heading"><div><span className="td-label">SOURCED ECONOMIC DATA / UTC+7</span><h2>CPI និងព័ត៌មានសេដ្ឋកិច្ច</h2></div><ControlButton controlSize="sm" disabled={loading} onClick={refresh}>{loading ? "កំពុងទាញ…" : "↻ Refresh"}</ControlButton></div>
    <div className="briefing-grid">
      <section className="briefing-card" aria-labelledby="briefing-cpi-title">
        <div className="briefing-card-heading"><h3 id="briefing-cpi-title">CPI / Inflation watch</h3><Link href="/markets/macro">ព័ត៌មានលម្អិត ↗</Link></div>
        {loading && !macro && <p role="status">កំពុងទាញទិន្នន័យ CPI…</p>}
        {errors.macro && <p role="status">មិនអាចធ្វើបច្ចុប្បន្នភាព CPI បាន។ {macro ? "បង្ហាញទិន្នន័យដែលទាញបានចុងក្រោយ។" : "សូមពិនិត្យប្រភពផ្ទាល់។"}</p>}
        <p className="briefing-source"><a href="https://www.bls.gov/schedule/news_release/cpi.htm" target="_blank" rel="noreferrer">BLS · Official US CPI schedule ↗</a></p>
        {next ? <div className="briefing-next"><span>ការចេញផ្សាយបន្ទាប់ / US CPI</span><strong><time dateTime={new Date(next.time).toISOString()}>{time(next.time)} · UTC+7</time></strong></div> : !loading && <p>មិនមានកាលវិភាគ CPI បន្ទាប់ដែលអាចបញ្ជាក់ពី feed បាន។</p>}
        <div className="briefing-card-heading"><span>Forex Factory · CPI this week</span><a href="https://www.forexfactory.com/calendar" target="_blank" rel="noreferrer">Source ↗</a></div>
        {factory?.status === "unavailable" && <p role="status">Forex Factory មិនអាចទាញបាននៅពេលនេះ។</p>}
        {cpi.map(event => <article key={event.id} className="briefing-event"><h4>{event.currency} · {event.title}</h4><time dateTime={new Date(event.time).toISOString()}>{time(event.time)} · UTC+7</time><dl><div><dt>Actual</dt><dd>{event.actual ?? "—"}</dd></div><div><dt>Forecast</dt><dd>{event.forecast ?? "—"}</dd></div><div><dt>Previous</dt><dd>{event.previous ?? "—"}</dd></div></dl></article>)}
        {factory?.status === "connected" && !cpi.length && <p>មិនមាន CPI ក្នុង weekly export នេះ។ សូមមើលកាលវិភាគ BLS ខាងលើ។</p>}
        <p className="briefing-note">Actual បង្ហាញតែពេលប្រភពផ្ដល់។ Forecast មិនមែនជាលទ្ធផល Actual ទេ។</p>
        {macro && <p className="briefing-note">Checked {time(macro.checkedAt)} · UTC+7 · 5-minute refresh</p>}
      </section>
      <section className="briefing-card briefing-world-news" aria-labelledby="briefing-news-title">
        <div className="briefing-card-heading"><h3 id="briefing-news-title">WORLD HOT NEWS · ព័ត៌មានពិភពលោក</h3><a href="https://www.bloomberg.com/economics" target="_blank" rel="noreferrer">Bloomberg ↗</a></div>
        {loading && !news && <p role="status">កំពុងទាញព័ត៌មាន…</p>}
        {errors.news && <p role="status">មិនអាចធ្វើបច្ចុប្បន្នភាពព័ត៌មានបាន។ {news ? "បង្ហាញចំណងជើងដែលទាញបានចុងក្រោយ។" : "សូមបើក Bloomberg ផ្ទាល់។"}</p>}
        {story&&<div key={story.url} className="briefing-news-slide" role="group" aria-roledescription="slide" aria-label={`${activeNewsIndex+1} of ${headlines.length}`}>
          <a className="briefing-news-item" href={story.url} target="_blank" rel="noreferrer"><span>Bloomberg · <time dateTime={story.publishedAt}>{time(story.publishedAt)} · UTC+7</time></span><h4 lang="en">{story.title} ↗</h4></a>
          <div className="briefing-news-controls"><span>{String(activeNewsIndex+1).padStart(2,"0")} / {String(headlines.length).padStart(2,"0")}</span><div><ControlButton controlSize="sm" disabled={headlines.length<2} aria-label="ព័ត៌មានមុន" onClick={()=>setNewsIndex(index=>(index-1+headlines.length)%headlines.length)}>←</ControlButton><ControlButton controlSize="sm" disabled={headlines.length<2} aria-pressed={newsPaused} onClick={()=>setNewsPaused(value=>!value)}>{newsPaused?"▶ បន្ត":"Ⅱ ផ្អាក"}</ControlButton><ControlButton controlSize="sm" disabled={headlines.length<2} aria-label="ព័ត៌មានបន្ទាប់" onClick={()=>setNewsIndex(index=>(index+1)%headlines.length)}>→</ControlButton></div></div>
        </div>}
        {news && !news.headlines.length && <p>មិនមានចំណងជើងព័ត៌មានពី feed នៅពេលនេះ។</p>}
        <p className="briefing-note">ចំណងជើងដើមពី Bloomberg RSS។ អត្ថបទពេញអាននៅប្រភព។ ព័ត៌មានអាចយឺតយ៉ាវ។</p>
        {news && <p className="briefing-note">Checked {time(news.checkedAt)} · UTC+7</p>}
      </section>
    </div>
  </div>;
}
