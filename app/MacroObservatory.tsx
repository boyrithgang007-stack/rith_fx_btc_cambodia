"use client";

import MacroGlobe from "./MacroGlobe";
import ControlButton from "./ControlButton";

import { useEffect, useState } from "react";
import { compareCpi, inspectPost, type MacroData } from "./lib/macro";
import ForexFactoryCalendar from "./ForexFactoryCalendar";

const schedule = "https://www.bls.gov/schedule/news_release/cpi.htm";
const prompts = [
  { en: "When is the next CPI?", km: "តើ CPI លើកក្រោយនៅពេលណា?" },
  { en: "BTC price", km: "តម្លៃ BTC ប៉ុន្មាន?" },
  { en: "How does CPI affect Forex?", km: "តើ CPI ប៉ះពាល់ដល់ Forex ដូចម្តេច?" },
  { en: "What do social posts say?", km: "តើព័ត៌មានបណ្ដាញសង្គមនិយាយអ្វីខ្លះ?" },
];
type Language = "km" | "en";

const formatTime = (time: number, language: Language) => new Date(time).toLocaleString(language === "km" ? "km-KH" : "en-GB", {
  timeZone: "Asia/Bangkok",
  dateStyle: "medium",
  timeStyle: "short",
});

const copy = {
  km: {
    language: "ភាសា", khmer: "ខ្មែរ", english: "English",
    title: "មើលព្រឹត្តិការណ៍។", subtitle: "ស្វែងយល់ពីចលនាទីផ្សារ។",
    description: "CPI • Forex • Crypto\nតាមដានព័ត៌មាន និងស្វែងយល់ពីទីផ្សារ",
    askDesk: "សួរផ្នែកស្រាវជ្រាវ ↗", officialSchedule: "កាលវិភាគ CPI ផ្លូវការ ↗",
    disclaimer: "ពេលវេលាយោងតាមប្រភព។ ការវិភាគជាលក្ខខណ្ឌ។ ការសម្រេចចិត្តជារបស់អ្នក។",
    connecting: "កំពុងភ្ជាប់ប្រភព…",
    noSnapshot: "មិនមានទិន្នន័យដែលបានផ្ទៀងផ្ទាត់", checked: "បានពិនិត្យ",
    refresh: "↻ ធ្វើបច្ចុប្បន្នភាព",
    releaseAlert: "ពេលវេលាប្រកាស CPI ជិតមកដល់ក្នុង ±30 នាទី។ Spread និងតម្លៃអាចប្រែប្រួល។ សញ្ញាក្រាបមិនត្រូវបានផ្អាកដោយស្វ័យប្រវត្តិទេ។",
    eventRadar: "01 / រ៉ាដាព្រឹត្តិការណ៍", nextCpi: "ការប្រកាស CPI សហរដ្ឋអាមេរិកលើកក្រោយ",
    awaitingCalendar: "កំពុងរង់ចាំកាលវិភាគ", noUpcomingDate: "មិនទាន់មានកាលបរិច្ឆេទខាងមុខដែលបានផ្ទៀងផ្ទាត់ទេ។",
    officialFeed: "ពេលវេលាកាលវិភាគមកពីប្រភពផ្លូវការ BLS។", verifyBls: "ផ្ទៀងផ្ទាត់ម៉ោងប្រកាសនៅ BLS ↗",
    scenarioLab: "02 / សាកល្បងសេណារីយ៉ូ", scenarioTitle: "បើ CPI ខុសពីការរំពឹងទុក?",
    sameMeasure: "ប្រៀបធៀបលើសូចនាករដូចគ្នា", actual: "តម្លៃជាក់ស្តែង (%)",
    forecast: "ការព្យាករណ៍ (%)", enterActual: "បញ្ចូលតម្លៃជាក់ស្តែង", enterForecast: "បញ្ចូលតម្លៃរំពឹងទុក",
    enterBoth: "បញ្ចូលភាគរយត្រឹមត្រូវទាំងពីរ ដើម្បីប្រៀបធៀបសេណារីយ៉ូ។",
    manualOnly: "ទិន្នន័យបញ្ចូលដោយដៃ មិនមែនជាតម្លៃប្រកាសផ្ទាល់ ឬការព្យាករណ៍ដែលបានផ្ទៀងផ្ទាត់ទេ។",
    above: "លើសការព្យាករណ៍", below: "ក្រោមការព្យាករណ៍", inline: "ស្របតាមការព្យាករណ៍",
    hotter: "តម្លៃខ្ពស់ជាងអាចបង្កើនការរំពឹងទុកអំពីគោលនយោបាយតឹងរ៉ឹង។ សូមមើល USD និងអត្រាការប្រាក់; ប្រតិកម្មរបស់ Crypto និង Forex មិនអាចធានាបានទេ។",
    cooler: "តម្លៃទាបជាងអាចបន្ថយការរំពឹងទុកអំពីគោលនយោបាយតឹងរ៉ឹង។ សូមរង់ចាំការបញ្ជាក់ពី USD និងអត្រាការប្រាក់; ព័ត៌មានផ្សេងអាចមានឥទ្ធិពលខ្លាំងជាង។",
    noSurprise: "មិនមានការភ្ញាក់ផ្អើលលើតួលេខសំខាន់ទេ។ CPI ស្នូល ការកែតម្រូវទិន្នន័យ និងទីតាំងវិនិយោគអាចជំរុញទីផ្សារ។",
    sourceCheck: "03 / ផ្ទៀងផ្ទាត់ប្រភព", sourceTitle: "អានឲ្យលើសពីចំណងជើង",
    socialUnavailable: "មិនមានព័ត៌មានបណ្ដាញសង្គម", originalPost: "ប្រកាសដើម ↗",
    unknownDate: "មិនស្គាល់កាលបរិច្ឆេទ", pastePost: "បិទភ្ជាប់ប្រកាសសាធារណៈ",
    pastePlaceholder: "បិទភ្ជាប់មតិអំពី CPI, Forex ឬ Crypto…", noTopic: "រកមិនឃើញប្រធានបទដែលគាំទ្រ",
    claims: "ការអះអាងជាភាគរយ៖", none: "រកមិនឃើញ",
    inspectionWarning: "អត្ថបទនេះមិនទាន់បានផ្ទៀងផ្ទាត់ទេ។ ពិនិត្យពេលវេលាបោះពុម្ព ប្រភពដើម និងប្រៀបធៀប Headline/Core និង MoM/YoY ឲ្យដូចគ្នា។",
    localCheck: "អត្ថបទត្រូវបានពិនិត្យក្នុងកម្មវិធី។ ការរកប្រធានបទមិនមែនជាការផ្ទៀងផ្ទាត់ការពិត ឬព្យាករណ៍ទិសដៅទេ។",
    marketDesk: "04 / ជំនួយការទីផ្សារ", copilot: "ជំនួយការ RFX TEAM", aiPowered: "ដំណើរការដោយ AI",
    assistantDescription: "សួរអំពី CPI, Forex និង Crypto។ AI ប្រើទិន្នន័យដែលបង្ហាញ ហើយមិនបង្កើតតម្លៃបច្ចុប្បន្នទេ។",
    yourQuestion: "សំណួររបស់អ្នក", questionPlaceholder: "តើ CPI លើកក្រោយនៅពេលណា?", ask: "សួរ AI ↗",
    choosePrompt: "ជ្រើសសំណួរ ឬវាយសំណួររបស់អ្នក ដើម្បីចាប់ផ្ដើមជជែកជាមួយ AI។",
    aiSetupNote: "មុខងារ AI មិនទាន់បានកំណត់ទេ។ សូមកំណត់ GEMINI_API_KEY និង GEMINI_ANALYSIS_MODEL នៅលើ Server។",
    aiError: "មិនអាចទទួលចម្លើយពី AI បានទេ។ សូមសាកល្បងម្ដងទៀត។",
    calendarConnected: "ប្រតិទិន BLS បានភ្ជាប់", calendarUnavailable: "មិនអាចភ្ជាប់ប្រតិទិនបាន — សូមពិនិត្យ BLS",
    socialNotConnected: "X មិនទាន់បានភ្ជាប់ — សូមបិទភ្ជាប់ប្រកាសខាងក្រោម",
    socialConnected: "X បានភ្ជាប់ · គំរូព័ត៌មាន 7 ថ្ងៃថ្មីៗ",
    socialError: "X មិនអាចប្រើបាន — សូមពិនិត្យសិទ្ធិ API ឬកូតា",
    releaseWindowLabel: "ពេលវេលាប្រកាស CPI",
    topicCpi: "CPI", topicForex: "USD / Forex", topicCrypto: "Crypto",
    unauthorized: "សូមចូលគណនីដែលបានអនុម័ត ដើម្បីភ្ជាប់ប្រភព។",
  },
  en: {
    language: "Language", khmer: "ខ្មែរ", english: "English",
    title: "See the event.", subtitle: "Understand the move.",
    description: "CPI • Forex • Crypto\nTrack the news and understand the markets.",
    askDesk: "Ask the market desk ↗", officialSchedule: "Official CPI schedule ↗",
    disclaimer: "Source-backed timing. Conditional analysis. Your decision.",
    connecting: "Connecting sources…",
    noSnapshot: "No verified snapshot", checked: "Checked", refresh: "↻ Refresh",
    releaseAlert: "CPI release window ±30 minutes. Expect changing spreads and prices. Existing chart signals are not automatically suspended.",
    eventRadar: "01 / EVENT RADAR", nextCpi: "Next US CPI release",
    awaitingCalendar: "Awaiting calendar", noUpcomingDate: "No verified upcoming date loaded.",
    officialFeed: "Calendar times come from the official BLS feed.", verifyBls: "Verify release time at BLS ↗",
    scenarioLab: "02 / SCENARIO LAB", scenarioTitle: "What if CPI surprises?",
    sameMeasure: "Compare the same measure", actual: "Actual (%)", forecast: "Forecast (%)",
    enterActual: "Enter actual", enterForecast: "Enter consensus",
    enterBoth: "Enter two valid percentages to compare a scenario.",
    manualOnly: "Manual inputs, not a live release or verified forecast.",
    above: "Above forecast", below: "Below forecast", inline: "In line with forecast",
    hotter: "A hotter reading can raise expectations of tighter policy. Watch USD and yields; crypto and FX responses are not guaranteed.",
    cooler: "A cooler reading can ease policy expectations. Watch USD and yields for confirmation; other news can dominate.",
    noSurprise: "No headline surprise. Core CPI, revisions and positioning may drive the reaction.",
    sourceCheck: "03 / SOURCE CHECK", sourceTitle: "Read beyond the headline",
    socialUnavailable: "Social feed unavailable", originalPost: "Original post ↗",
    unknownDate: "Unknown date", pastePost: "Paste a public post",
    pastePlaceholder: "Paste CPI, Forex or crypto commentary…", noTopic: "No supported topic detected",
    claims: "Percentage claims:", none: "None detected",
    inspectionWarning: "Unverified text. Check publication time, original source, headline vs core and MoM vs YoY before comparing figures.",
    localCheck: "Text is checked locally. Topic detection does not verify truth or predict sentiment.",
    marketDesk: "04 / MARKET DESK", copilot: "RFX TEAM assistant", aiPowered: "AI POWERED",
    assistantDescription: "Ask about CPI, Forex, and crypto. AI uses the displayed context and will not invent current prices.",
    yourQuestion: "Your question", questionPlaceholder: "When is the next CPI?", ask: "Ask AI ↗",
    choosePrompt: "Choose a prompt or enter your own question to start chatting with AI.",
    aiSetupNote: "AI is not configured. Set GEMINI_API_KEY and GEMINI_ANALYSIS_MODEL on the server.",
    aiError: "AI could not answer. Please try again.",
    calendarConnected: "BLS calendar connected", calendarUnavailable: "Calendar unavailable — check BLS directly",
    socialNotConnected: "X not connected — paste a post below",
    socialConnected: "X connected · recent 7-day sample",
    socialError: "X unavailable — check API access / quota",
    releaseWindowLabel: "CPI release window",
    topicCpi: "CPI", topicForex: "USD / Forex", topicCrypto: "Crypto",
    unauthorized: "Sign in with an approved account to connect sources.",
  },
} as const;

export default function MacroObservatory({ quotes, updatedAt }: { quotes: {symbol:string;price:number}[]; updatedAt: string | null }) {
  const [language, setLanguage] = useState<Language>("km");
  const text = copy[language];
  const [data, setData] = useState<MacroData | null>(null);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState<number | null>(null);
  const [actual, setActual] = useState("");
  const [forecast, setForecast] = useState("");
  const [measure, setMeasure] = useState("Headline · MoM");
  const [post, setPost] = useState("");
  const [question, setQuestion] = useState("");
  const [assistantIntent, setAssistantIntent] = useState("");
  const [answer, setAnswer] = useState("");
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantError, setAssistantError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      try {
        const response = await fetch("/api/macro", { signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 401 ? "unauthorized" : "unavailable");
        const snapshot = await response.json();
        setData(snapshot);
        setAiConfigured(snapshot.aiConfigured === true);
        setError("");
      } catch (reason) {
        if (!controller.signal.aborted) {
          setData(null);
          setError(reason instanceof Error && reason.message === "unauthorized" ? "unauthorized" : "unavailable");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    const timer = setInterval(load, 300000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [refresh]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const next = now ? data?.events.find(event => event.time > now) : undefined;
  const seconds = next && now ? Math.max(0, Math.floor((next.time - now) / 1000)) : null;
  const countdown = seconds === null
    ? text.awaitingCalendar
    : `${Math.floor(seconds / 86400)}${language === "km" ? "ថ្ងៃ" : "d"} ${Math.floor(seconds / 3600) % 24}${language === "km" ? "ម៉" : "h"} ${Math.floor(seconds / 60) % 60}${language === "km" ? "ន" : "m"} ${seconds % 60}${language === "km" ? "វិ" : "s"}`;
  const nearby = now && data?.events.some(event => Math.abs(event.time - now) <= 1800000);
  const scenario = compareCpi(actual, forecast);
  const inspection = post.trim() ? inspectPost(post) : null;

  function statusText(value: string | undefined, kind: "calendar" | "social") {
    if (!value) return kind === "calendar" ? text.calendarUnavailable : text.socialUnavailable;
    if (kind === "calendar") return value.includes("connected") ? text.calendarConnected : text.calendarUnavailable;
    if (value.includes("not connected")) return text.socialNotConnected;
    if (value.includes("unavailable")) return text.socialError;
    if (value.includes("connected")) return text.socialConnected;
    return text.socialUnavailable;
  }

  function topicLabel(topic: string) {
    if (topic === "CPI") return text.topicCpi;
    if (topic === "USD / Forex") return text.topicForex;
    if (topic === "Crypto") return text.topicCrypto;
    return topic;
  }

  function scenarioLabel(label: string) {
    return label === "Above forecast" ? text.above : label === "Below forecast" ? text.below : text.inline;
  }

  function scenarioExplanation(label: string) {
    return label === "Above forecast" ? text.hotter : label === "Below forecast" ? text.cooler : text.noSurprise;
  }

  function changeLanguage(next: Language) {
    setLanguage(next);
    if (assistantIntent) void ask(assistantIntent, next);
  }

  async function ask(prompt: string, responseLanguage: Language = language) {
    setQuestion(prompt);
    setAssistantIntent(prompt);
    setAssistantError("");
    setAnswer("");
    setAssistantBusy(true);
    const parsedPriceTime = updatedAt ? Date.parse(updatedAt) : NaN;
    try {
      const response = await fetch("/api/macro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          question: prompt,
          language: responseLanguage,
          context: {
            calendar: next ? { title: next.title, time: next.time } : null,
            scenario: scenario ? {
              measure,
              actual: Number(actual),
              forecast: Number(forecast),
              surprise: scenario.surprise,
              label: scenario.label,
            } : null,
            quotes: quotes.filter(item => Number.isFinite(item.price) && item.price >= 0).slice(0, 20),
            pricesAsOf: Number.isFinite(parsedPriceTime) ? parsedPriceTime : null,
            calendarStatus: data?.calendarStatus ?? "unavailable",
            socialStatus: data?.socialStatus ?? "unavailable",
            socialPostCount: data?.posts.length ?? 0,
          },
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : text.aiError);
      if (typeof result.answer !== "string" || !result.answer.trim()) throw new Error(text.aiError);
      setAnswer(result.answer);
    } catch (reason) {
      setAssistantError(reason instanceof Error && reason.name !== "TimeoutError" ? reason.message : text.aiError);
    } finally {
      setAssistantBusy(false);
    }
  }

  return <section id="macro" className="macro-observatory" aria-label={language === "km" ? "ទិន្នន័យ CPI និងស្រាវជ្រាវទីផ្សារ" : "CPI and market research"} lang={language}>
    <div className="macro-language-switch" role="group" aria-label={language === "km" ? "ជ្រើសរើសភាសា" : "Choose language"}>
      <span>{text.language}</span>
      <ControlButton type="button" aria-pressed={language === "km"} onClick={() => changeLanguage("km")}>{text.khmer}</ControlButton>
      <ControlButton type="button" aria-pressed={language === "en"} onClick={() => changeLanguage("en")}>{text.english}</ControlButton>
    </div>
    <div className="macro-hero">
      <div className="macro-hero-copy">
        <span className="macro-kicker">NR / MACRO OBSERVATORY</span>
        <h2>{text.title}<br/><em>{text.subtitle}</em></h2>
        <p>{text.description}</p>
        <div className="macro-actions"><a href="#macro-assistant">{text.askDesk}</a><a href={schedule} target="_blank" rel="noreferrer">{text.officialSchedule}</a></div>
        <small>{text.disclaimer}</small>
      </div>
      <MacroGlobe language={language}/>
    </div>
    <div className="macro-status">
      <span>{loading ? text.connecting : error ? error === "unauthorized" ? text.unauthorized : text.calendarUnavailable : statusText(data?.calendarStatus, "calendar")}</span>
      <span>{data ? `${text.checked} ${formatTime(data.checkedAt, language)} · ${language === "km" ? "បាងកក" : "Bangkok"}` : text.noSnapshot}</span>
      <ControlButton type="button" disabled={loading} onClick={() => setRefresh(value => value + 1)}>{text.refresh}</ControlButton>
    </div>
    {nearby && <p className="macro-alert">{text.releaseAlert}</p>}
    <ForexFactoryCalendar snapshot={data?.forexFactory} language={language} loading={loading} onRefresh={()=>{setLoading(true);setRefresh(value=>value+1);}}/>
    <div className="macro-grid">
      <article className="macro-card macro-event">
        <span className="macro-kicker">{text.eventRadar}</span><h3>{text.nextCpi}</h3>
        <div className="macro-countdown" aria-label={text.releaseWindowLabel}>{countdown}</div>
        <p>{next ? `${formatTime(next.time, language)} · ${language === "km" ? "អាស៊ី/បាងកក" : "Asia/Bangkok"}` : text.noUpcomingDate}</p>
        <small>{next ? `${new Date(next.time).toLocaleString(language === "km" ? "km-KH" : "en-US", {timeZone:"America/New_York", dateStyle:"medium",timeStyle:"short"})} · ${language === "km" ? "ញូវយ៉ក" : "New York"}` : text.officialFeed}</small>
        <a href={schedule} target="_blank" rel="noreferrer">{text.verifyBls}</a>
      </article>
      <article className="macro-card">
        <span className="macro-kicker">{text.scenarioLab}</span><h3>{text.scenarioTitle}</h3>
        <label>{text.sameMeasure}<select value={measure} onChange={event => setMeasure(event.target.value)}>
          {["Headline · MoM","Headline · YoY","Core · MoM","Core · YoY"].map((item, index) => <option key={item} value={item}>{(language === "km" ? ["ចំណងជើង · ប្រចាំខែ","ចំណងជើង · ធៀបឆ្នាំមុន","ស្នូល · ប្រចាំខែ","ស្នូល · ធៀបឆ្នាំមុន"] : ["Headline · MoM","Headline · YoY","Core · MoM","Core · YoY"])[index]}</option>)}
        </select></label>
        <div className="macro-input-row">
          <label>{text.actual}<input type="number" step="0.01" min="-100" max="100" placeholder={text.enterActual} value={actual} onChange={event => setActual(event.target.value)}/></label>
          <label>{text.forecast}<input type="number" step="0.01" min="-100" max="100" placeholder={text.enterForecast} value={forecast} onChange={event => setForecast(event.target.value)}/></label>
        </div>
        <div className="macro-scenario" aria-live="polite">{scenario ? <><b>{scenarioLabel(scenario.label)} · {scenario.surprise > 0 ? "+" : ""}{scenario.surprise} {language === "km" ? "ពិន្ទុភាគរយ" : "pp"}</b><p>{scenarioExplanation(scenario.label)}</p></> : <p>{text.enterBoth}</p>}</div>
        <small>{text.manualOnly}</small>
      </article>
      <article className="macro-card">
        <span className="macro-kicker">{text.sourceCheck}</span><h3>{text.sourceTitle}</h3>
        <p className="macro-feed-status">{statusText(data?.socialStatus, "social")}</p>
        <div className="macro-posts">{data?.posts.map(post => <article key={post.id}><p>{post.text}</p><a href={post.url} target="_blank" rel="noreferrer">{text.originalPost}</a><small>{Number.isFinite(Date.parse(post.time)) ? formatTime(Date.parse(post.time), language) : text.unknownDate}</small></article>)}</div>
        <label>{text.pastePost}<textarea maxLength={4000} rows={3} value={post} onChange={event => setPost(event.target.value)} placeholder={text.pastePlaceholder}/></label>
        {inspection && <div className="macro-inspection"><b>{inspection.topics.length ? inspection.topics.map(topicLabel).join(" · ") : text.noTopic}</b><p>{text.claims} {inspection.claims.join(", ") || text.none}</p><small>{language === "km" ? "អត្ថបទនេះមិនទាន់បានផ្ទៀងផ្ទាត់ទេ។ ពិនិត្យពេលវេលាបោះពុម្ព ប្រភពដើម និងប្រៀបធៀប Headline/Core និង MoM/YoY ឲ្យដូចគ្នា។" : inspection.warning}</small></div>}
        <small>{language === "km" ? "អត្ថបទដែលអ្នកបញ្ចូលត្រូវបានពិនិត្យក្នុងកម្មវិធី។ ការរកប្រធានបទមិនមែនជាការផ្ទៀងផ្ទាត់ការពិត ឬព្យាករណ៍ទិសដៅទេ។ ប្រកាសដើមត្រូវបានបង្ហាញជាភាសាដែលបានសរសេរ។" : "Pasted text is checked locally. Topic detection does not verify truth or predict sentiment. Original posts are shown in their source language."}</small>
      </article>
      <article id="macro-assistant" className="macro-card macro-assistant">
        <span className="macro-kicker">{text.marketDesk}</span><h3>{text.copilot} <span>{text.aiPowered}</span></h3>
        <p>{text.assistantDescription}</p>
        <div className="macro-prompts">{prompts.map(prompt => <ControlButton key={prompt.en} type="button" disabled={!aiConfigured||assistantBusy} onClick={() => void ask(prompt[language])}>{prompt[language]}</ControlButton>)}</div>
        <form onSubmit={event => {event.preventDefault(); if (question.trim()) void ask(question.trim());}}>
          <label>{text.yourQuestion}<input maxLength={500} value={question} onChange={event => setQuestion(event.target.value)} placeholder={text.questionPlaceholder} required/></label>
          <ControlButton type="submit" disabled={!aiConfigured||assistantBusy}>{assistantBusy ? (language === "km" ? "កំពុងឆ្លើយ…" : "Thinking…") : text.ask}</ControlButton>
        </form>
        {!aiConfigured && <p className="signal-setup-note">{text.aiSetupNote}</p>}
        {assistantError && <p className="signal-error" role="alert">{assistantError}</p>}
        <div className="macro-answer" role="status">{assistantBusy ? (language === "km" ? "AI កំពុងរៀបចំចម្លើយ…" : "AI is preparing an answer…") : answer || text.choosePrompt}</div>
        <a href="https://www.bls.gov/cpi/questions-and-answers.htm" target="_blank" rel="noreferrer">{language === "km" ? "ស្វែងយល់អំពី CPI · BLS ↗" : "Learn about CPI · BLS ↗"}</a>
      </article>
    </div>
  </section>;
}
