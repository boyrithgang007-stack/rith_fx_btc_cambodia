"use client";
import {useEffect,useRef,useState} from "react";
import ControlButton from "./ControlButton";
import {useBinanceStream} from "./useBinanceStream";
import SignalChart from "./SignalChart";
import ImageAnalysisPanel from "./ImageAnalysisPanel";

import {CANDLE_MARKETS,CANDLE_FRAMES,type CandleMarket,type CandleFrame} from "./candle-markets";
import type {CandleAnalysisReport} from "./candle-types";
const time=(n:number)=>new Date(n).toLocaleString("en-GB",{timeZone:"Asia/Bangkok",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false});
const price=(n:number|null)=>n===null?"—":n.toLocaleString("en-US",{maximumFractionDigits:5});

export default function CandleSignalDesk(){

  const [liveEnabled,setLiveEnabled]=useState(false);
  const [rewardRatio,setRewardRatio]=useState<2|3>(2);
  const [market,setMarket]=useState<CandleMarket>("BTCUSDT"),[frame,setFrame]=useState<CandleFrame>("15m");
  const [capabilities,setCapabilities]=useState<{aiConfigured:boolean;visionConfigured:boolean;forexConfigured:boolean;telegramSignalStatus:string}|null>(null);
  const [reports,setReports]=useState<CandleAnalysisReport[]>([]),[selectedReportId,setSelectedReportId]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [chart,setChart]=useState<"tradingview"|"analysis">("analysis"),[clock,setClock]=useState(0);
  const stream=useBinanceStream(market,frame,rewardRatio,liveEnabled&&CANDLE_MARKETS[market].provider==="binance");
  const analysisRequest=useRef<AbortController|null>(null);
  useEffect(()=>()=>analysisRequest.current?.abort(),[]);
  useEffect(()=>{const controller=new AbortController();fetch("/api/candle-analysis",{signal:controller.signal,cache:"no-store"}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(value=>{if(!controller.signal.aborted){setCapabilities({aiConfigured:value.aiConfigured===true,visionConfigured:value.visionConfigured===true,forexConfigured:value.forexConfigured===true,telegramSignalStatus:typeof value.telegramSignalStatus==="string"?value.telegramSignalStatus:"starting"});if(Array.isArray(value.reports)&&value.reports.length){const saved=value.reports as CandleAnalysisReport[];setReports(saved);setSelectedReportId(saved[0].id);setMarket(saved[0].market);setFrame(saved[0].frame);setChart("analysis");setClock(Date.now());}}}).catch(()=>{if(!controller.signal.aborted)setError("មិនអាចពិនិត្យការភ្ជាប់ data បាន។ សូម Refresh ទំព័រ។");});return()=>controller.abort();},[]);
  useEffect(()=>{if(!reports.length&&!liveEnabled)return;const timer=window.setInterval(()=>setClock(Date.now()),1000);return()=>window.clearInterval(timer);},[reports.length,liveEnabled]);
  async function analyze(includeAi:boolean,selectedFrame:CandleFrame=frame){
    setLiveEnabled(false);
    analysisRequest.current?.abort();const controller=new AbortController();analysisRequest.current=controller;
    setBusy(true);setError("");
    try {
      const response=await fetch("/api/candle-analysis",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({market,frame:selectedFrame,includeAi,rewardRatio}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(55000)])});
      const data=await response.json();
      if(!response.ok)throw Error(data.error||"Analysis unavailable.");
      if(!data.id||data.market!==market||data.frame!==selectedFrame||!data.signal||!Array.isArray(data.candles))throw Error("Invalid analysis response.");
      const savedReport=data as CandleAnalysisReport;
      setClock(Date.now());setReports(current=>[savedReport,...current.filter(item=>item.id!==savedReport.id)].slice(0,100));setSelectedReportId(savedReport.id);setFrame(selectedFrame);setChart("analysis");
    }catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"មិនអាចវិភាគបាន។");}finally{if(!controller.signal.aborted)setBusy(false);}
  }
  const report=(liveEnabled?stream.report:null)??reports.find(item=>item.id===selectedReportId)??reports.find(item=>item.market===market&&item.frame===frame&&(item.rewardRatio??2)===rewardRatio);
  const expired=!report?.expiresAt||(clock===0||clock>=report.expiresAt)||(liveEnabled&&stream.status!=="Streaming");
  const action=expired?"WAIT":report?.signal.action??"WAIT";
  const dataReady=CANDLE_MARKETS[market].provider==="binance"||capabilities?.forexConfigured===true;
  const reportId=report?.id;  const pressure=report?.pressure??{buyPercent:50,sellPercent:50,basis:"candle-pressure-no-volume" as const,candles:0};
  const tpLevels=report&&action!=="WAIT"&&report.signal.entry!==null&&report.signal.stopLoss!==null?[1,2,3].map(r=>report.signal.entry!+(action==="BUY"?1:-1)*Math.abs(report.signal.entry!-report.signal.stopLoss!)*r):[null,null,null];
  useEffect(()=>{if(chart!=="analysis"||!reportId)return;const frameId=window.requestAnimationFrame(()=>document.querySelector(".interactive-signal-chart")?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"center"}));return()=>window.cancelAnimationFrame(frameId);},[chart,reportId]);
  return <section className="candle-signal-desk panel" aria-labelledby="candle-desk-title">
    <div className="candle-desk-heading"><div><p className="eyebrow">TRADINGVIEW + CLOSED-CANDLE RESEARCH</p><h2 id="candle-desk-title">Candle Signal Analysis</h2><p>មើលក្រាប ពិនិត្យ candles បិទ និងបង្កើតសញ្ញាតាមលក្ខខណ្ឌ។ មិនមានការផ្ញើ order ពិត។</p></div><span className="signal-paper-badge">PAPER / RESEARCH</span></div>
    <div className="candle-desk-controls"><label>ទីផ្សារ<select value={market} disabled={busy} onChange={e=>{setMarket(e.target.value as CandleMarket);setSelectedReportId(null);setChart("analysis");setError("");}}>{Object.entries(CANDLE_MARKETS).map(([key,item])=><option value={key} key={key}>{item.label}</option>)}</select></label><label>Timeframe<select value={frame} disabled={busy} onChange={e=>{setFrame(e.target.value as CandleFrame);setSelectedReportId(null);setChart("analysis");setError("");}}>{Object.entries(CANDLE_FRAMES).map(([key,item])=><option value={key} key={key}>{item.label}</option>)}</select></label>
      <label>Risk : Reward<select value={rewardRatio} disabled={busy} onChange={e=>{setRewardRatio(Number(e.target.value) as 2|3);setSelectedReportId(null);}}><option value={2}>1 : 2</option><option value={3}>1 : 3</option></select></label>
      <ControlButton variant="primary" disabled={busy||!capabilities?.aiConfigured||!dataReady} onClick={()=>void analyze(true)}>{busy?"កំពុងវិភាគ…":"ϟ បង្កើតសញ្ញាថ្មី"}</ControlButton><ControlButton disabled={busy||!dataReady} onClick={()=>void analyze(false)}>Analyze candles · Technical</ControlButton></div>    <div className="signal-mode-cards"><button type="button" disabled={busy||!dataReady} onClick={()=>void analyze(false,"5m")}><span>SCALP · 5m</span><strong>Analyze scalp setup</strong><small>Short timeframe · closed-candle technical signal</small></button><button type="button" disabled={busy||!dataReady} onClick={()=>void analyze(false,"1h")}><span>SWING · 1h</span><strong>Analyze swing setup</strong><small>Higher timeframe · closed-candle technical signal</small></button></div>
    <div className="signal-connection-status"><span>Chart: Candles + Buy / Sell + Entry / SL / TP</span><span>OHLC: {CANDLE_MARKETS[market].provider==="binance"?"Binance public spot":capabilities?.forexConfigured?"Twelve Data · plan permissions required":"Twelve Data not configured"}</span></div>
    <p className="signal-meta">Telegram Bot: {capabilities?.telegramSignalStatus==="active"?"ភ្ជាប់រួច · កំពុងរង់ចាំ signal ថ្មី":capabilities?.telegramSignalStatus==="needs-data-config"?"Telegram បានភ្ជាប់ ប៉ុន្តែ signal មាស/ប្រេង/ប្រាក់ត្រូវការ Twelve Data API key":"មិនទាន់ភ្ជាប់សម្រាប់ autopost"}{capabilities?.telegramSignalStatus==="needs-config"?" · កំណត់ TELEGRAM_BOT_TOKEN និង TELEGRAM_TARGET_CHAT_ID នៅ server":""}{capabilities?.telegramSignalStatus==="unsupported-host"?" · ត្រូវការម៉ាស៊ីន Node.js ដែលរត់ជាប់ជានិច្ច":""}{capabilities?.telegramSignalStatus==="invalid-markets"?" · សូមពិនិត្យ TELEGRAM_SIGNAL_MARKETS":""}</p>
    {!dataReady&&<p className="signal-setup-note">Candle data is not connected for this symbol. Gold, silver, oil and Forex require an active Twelve Data subscription with symbol access. No signal can be generated until this feed is connected.</p>}
    <div className="signal-stream-controls"><ControlButton aria-pressed={liveEnabled} disabled={CANDLE_MARKETS[market].provider!=="binance"} onClick={()=>setLiveEnabled(value=>!value)}>{liveEnabled?"Stop live stream":"Start live Binance stream"}</ControlButton><p role="status">{stream.status}{stream.price!==null?` | Price ${price(stream.price)}`:""}{stream.age!==null?` | Event age ${stream.age} ms`:""}</p><p>Live technical signals update on closed candles while this page is open. Additional review uses the Generate signal button. Stream signals are session-only.</p></div>
    {error&&<p className="signal-error" role="alert">{error}</p>}
    {report&&<SignalChart report={report} active={!expired}/>}
    {!report?<div className="signal-empty"><span aria-hidden="true">ϟ</span><h3>No active signals yet</h3><p>ជ្រើស symbol និង timeframe រួចបង្កើតសញ្ញាថ្មី ឬប្រើការវិភាគបច្ចេកទេស។ លទ្ធផល WAIT មានន័យថាលក្ខខណ្ឌមិនទាន់គ្រប់។</p></div>:<div className="signal-report">
      <div className="signal-report-header"><h3>{CANDLE_MARKETS[report.market].label} · {report.frame}</h3><strong className={`signal-action action-${action.toLowerCase()}`}>{action==="BUY"?"BUY NOW":action==="SELL"?"SELL NOW":"WAIT"}{expired&&action!=="WAIT"?" · HISTORICAL / EXPIRED":""}</strong></div>
      <p>{expired?"របាយការណ៍នេះមិនមែនជាសញ្ញាចូលថ្មីទេ។ សូមបង្កើតការវិភាគថ្មី។":report.signal.reason}</p>
      <div className="signal-report-levels">{[["Entry price · ចំណុចចូល",action==="WAIT"?null:report.signal.entry],["Stop Loss · SL",action==="WAIT"?null:report.signal.stopLoss]].map(([label,value])=><div key={String(label)}><span>{label}</span><strong>{price(value as number|null)}</strong></div>)}</div><div className="signal-tp-levels">{tpLevels.map((value,i)=><div className={report.rewardRatio===i+1?"is-selected":""} key={i}><span>TP{i+1} · {i+1}R</span><strong>{price(value)}</strong></div>)}</div><section className="market-pressure"><div className="market-pressure-heading"><strong>Buy / Sell Pressure · {pressure.buyPercent}% / {pressure.sellPercent}%</strong><span>{pressure.basis==="taker-volume"?"Binance taker volume":pressure.basis==="candle-pressure"?"Candle anatomy × volume":"Candle anatomy · no volume feed"}</span></div><div className="market-pressure-bar" role="img" aria-label={`Buy pressure ${pressure.buyPercent} percent, sell pressure ${pressure.sellPercent} percent`}><i style={{width:`${pressure.buyPercent}%`}}/></div><div className="market-pressure-labels"><span>Buy {pressure.buyPercent}%</span><span>Sell {pressure.sellPercent}%</span></div></section>
      <p className="signal-meta">Risk : Reward 1 : {report.rewardRatio??2} · Risk = |Entry − SL| · Reward = |TP − Entry|</p>
      <p className="signal-meta">{report.source} · {report.candles.length} displayed closed candles · trend {report.trend} · {report.asOf?`Last close ${time(report.asOf)} UTC+7`:"No closed candle"}{report.expiresAt?` · Expires ${time(report.expiresAt)} UTC+7`:""}</p>
      <ul className="signal-checks">{report.signal.checks.map(check=><li key={check.label}>{check.passed?"✓":"○"} {check.label}</li>)}</ul>
      <section className="ai-candle-review"><h3>{report.ai.status==="reviewed"?"ការត្រួតពិនិត្យសញ្ញា":"របាយការណ៍បច្ចេកទេស"}</h3><p>{report.ai.summary}</p>{report.ai.observations.map((text,i)=><p key={i}>{text}</p>)}{report.ai.risks.length>0&&<><h4>ចំណុចត្រូវពិនិត្យ</h4><ul>{report.ai.risks.map((text,i)=><li key={i}>{text}</li>)}</ul></>}</section>
      <p className="signal-meta">Signal តាម Structure + EMA20 + FVG/OB first-touch rejection នៅ candle បិទ។ មិនទាន់មាន news/HTF/spread filter នៅម៉ាស៊ីននេះទេ។ Entry ជាតម្លៃយោង មិនមែន executable quote ឬការធានាឈ្នះ។</p>
    </div>}
    <ImageAnalysisPanel configured={capabilities?.visionConfigured===true}/>
    <details className="signal-history"><summary>Saved analysis history · {reports.length}</summary>{reports.map(item=><button type="button" className={`signal-history-item ${selectedReportId===item.id?"is-selected":""}`} key={item.id} onClick={()=>{setMarket(item.market);setFrame(item.frame);setSelectedReportId(item.id);setChart("analysis");setClock(Date.now());setError("");}}><b>{CANDLE_MARKETS[item.market].label} · {item.frame} · {item.signal.action}</b><span>{time(item.generatedAt)} UTC+7 · {item.ai.status==="reviewed"?"បានត្រួតពិនិត្យ":"ការវិភាគបច្ចេកទេស"} · {item.signal.action==="WAIT"?"No entry setup":"saved chart marker"}</span></button>)}</details>
  </section>;
}
