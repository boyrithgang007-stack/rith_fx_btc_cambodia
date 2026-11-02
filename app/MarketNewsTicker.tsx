"use client";

import { useMemo } from "react";
import type { useEconomicFeeds } from "./MarketBriefing";

type Feed = ReturnType<typeof useEconomicFeeds>;

function formatTime(value: number | string) {
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function MarketNewsTicker({ feed }: { feed: Feed }) {
  const { macro, news, errors, loading } = feed;
  const slides = useMemo(() => {
    const cpi = macro?.events
      .filter(event => Number.isFinite(event.time) && event.time >= macro.checkedAt)
      .sort((a, b) => a.time - b.time)[0];
    return [
      ...(cpi ? [{
        key: `cpi-${cpi.time}`,
        kind: "CPI / INFLATION",
        title: cpi.title,
        detail: `Scheduled ${formatTime(cpi.time)} · UTC+7`,
        source: "BLS · US CPI",
        href: "https://www.bls.gov/schedule/news_release/cpi.htm",
      }] : []),
      ...(news?.headlines.slice(0, 6).map(item => ({
        key: item.url,
        kind: "WORLD HOT NEWS",
        title: item.title,
        detail: `Published ${formatTime(item.publishedAt)} · UTC+7`,
        source: "Bloomberg",
        href: item.url,
      })) ?? []),
    ];
  }, [macro, news]);

  function renderSlides(isDuplicate: boolean) {
    return slides.map(slide => (
      <a
        className="dashboard-news-story"
        href={slide.href}
        target="_blank"
        rel="noreferrer"
        key={slide.key}
        tabIndex={isDuplicate ? -1 : undefined}
      >
        <span className={`dashboard-news-kind ${slide.kind === "CPI / INFLATION" ? "is-cpi" : "is-world"}`}>{slide.kind}</span>
        <strong>{slide.title}</strong>
        <span className="dashboard-news-meta">{slide.detail} · {slide.source} ↗</span>
      </a>
    ));
  }

  return <section className="dashboard-news-strip" aria-label="CPI and world hot news">
    {slides.length ? <div className="dashboard-news-track">
      <div className="dashboard-news-group">{renderSlides(false)}</div>
      <div className="dashboard-news-group" aria-hidden="true">{renderSlides(true)}</div>
    </div> : <p className="dashboard-news-empty" role={errors.macro || errors.news ? "alert" : "status"}>
      {loading ? "កំពុងទាញព័ត៌មាន CPI និងព័ត៌មានពិភពលោក…" : "មិនមានព័ត៌មាន CPI ឬចំណងជើងព័ត៌មានដែលទាញបាននៅពេលនេះទេ។"}
    </p>}
  </section>;
}
