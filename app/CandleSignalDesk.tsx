"use client";
import {useEffect,useRef,useState} from "react";
import ControlButton from "./ControlButton";
import TradingViewChart from "./TradingViewChart";
import ImageAnalysisPanel from "./ImageAnalysisPanel";
import {useAppTheme} from "./ThemeControls";
import {CANDLE_MARKETS,CANDLE_FRAMES,type CandleMarket,type CandleFrame} from "./candle-markets";
import type {CandleAnalysisReport} from "./candle-types";
const time=(n:number)=>new Date(n).toLocaleString("en-GB",{timeZone:"Asia/Bangkok",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false});
const price=(n:number|null)=>n===null?"—":n.toLocaleString("en-US",{maximumFractionDigits:5});

export default function CandleSignalDesk(){
  const theme=useAppTheme();
  const [market,setMarket]=useState<CandleMarket>("BTCUSDT"),[frame,setFrame]=useState<CandleFrame>("15m");
  const [capabilities,setCapabilities]=useState<{aiConfigured:boolean;visionConfigured:boolean;forexConfigured:boolean}|null>(null);
  const [reports,setReports]=useState<CandleAnalysisReport[]>([]),[selectedReportId,setSelectedReportId]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [chart,setChart]=useState<"tradingview"|"analysis">("tradingview"),[clock,setClock]=useState(0);
  const analysisRequest=useRef<AbortController|null>(null);
  useEffect(()=>()=>analysisRequest.current?.abort(),[]);
  useEffect(()=>{const controller=new AbortController();fetch("/api/candle-analysis",{signal:controller.signal,cache:"no-store"}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(value=>{if(!controller.signal.aborted){setCapabilities({aiConfigured:value.aiConfigured===true,visionConfigured:value.visionConfigured===true,forexConfigured:value.forexConfigured===true});if(Array.isArray(value.reports)&&value.reports.length){const saved=value.reports as CandleAnalysisReport[];setReports(saved);setSelectedReportId(saved[0].id);setMarket(saved[0].market);setFrame(saved[0].frame);setChart("analysis");setClock(Date.now());}}}).catch(()=>{if(!controller.signal.aborted)setError("មិនអាចពិនិត្យការភ្ជាប់ AI/data បាន។ សូម Refresh ទំព័រ។");});return()=>controller.abort();},[]);
  useEffect(()=>{if(!reports.length)return;const timer=window.setInterval(()=>setClock(Date.now()),1000);return()=>window.clearInterval(timer);},[reports.length]);
  async function analyze(includeAi:boolean){
    analysisRequest.current?.abort();const controller=new AbortController();analysisRequest.current=controller;
    setBusy(true);setError("");
    try {
      const response=await fetch("/api/candle-analysis",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({market,frame,includeAi}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(55000)])});
      const data=await response.json();
      if(!response.ok)throw Error(data.error||"Analysis unavailable.");
      if(!data.id||data.market!==market||data.frame!==frame||!data.signal||!Array.isArray(data.candles))throw Error("Invalid analysis response.");
      const savedReport=data as CandleAnalysisReport;
      setClock(Date.now());setReports(current=>[savedReport,...current.filter(item=>item.id!==savedReport.id)].slice(0,100));setSelectedReportId(savedReport.id);setChart("analysis");
    }catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"មិនអាចវិភាគបាន។");}finally{if(!controller.signal.aborted)setBusy(false);}
  }
  const report=reports.find(item=>item.id===selectedReportId)??reports.find(item=>item.market===market&&item.frame===frame);
  const expired=!report?.expiresAt||clock>=report.expiresAt;
  const action=report?.signal.action??"WAIT";
  const dataReady=CANDLE_MARKETS[market].provider==="binance"||capabilities?.forexConfigured===true;
  const reportId=report?.id;
  useEffect(()=>{if(chart!=="analysis"||!reportId)return;const frameId=window.requestAnimationFrame(()=>document.querySelector(".signal-ohlc-chart")?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"center"}));return()=>window.cancelAnimationFrame(frameId);},[chart,reportId]);
  return <section className="candle-signal-desk panel" aria-labelledby="candle-desk-title">
    <div className="candle-desk-heading"><div><p className="eyebrow">TRADINGVIEW + CLOSED-CANDLE RESEARCH</p><h2 id="candle-desk-title">AI Analyze Candle</h2><p>មើលក្រាប ពិនិត្យ candles បិទ និងបង្កើតសញ្ញាតាមលក្ខខណ្ឌ។ មិនមានការផ្ញើ order ពិត។</p></div><span className="signal-paper-badge">PAPER / RESEARCH</span></div>
    <div className="candle-desk-controls"><label>ទីផ្សារ<select value={market} disabled={busy} onChange={e=>{setMarket(e.target.value as CandleMarket);setSelectedReportId(null);setChart("tradingview");setError("");}}>{Object.entries(CANDLE_MARKETS).map(([key,item])=><option value={key} key={key}>{item.label}</option>)}</select></label><label>Timeframe<select value={frame} disabled={busy} onChange={e=>{setFrame(e.target.value as CandleFrame);setSelectedReportId(null);setChart("tradingview");setError("");}}>{Object.entries(CANDLE_FRAMES).map(([key,item])=><option value={key} key={key}>{item.label}</option>)}</select></label>
      <ControlButton variant="primary" disabled={busy||!capabilities?.aiConfigured||!dataReady} onClick={()=>void analyze(true)}>{busy?"កំពុងវិភាគ…":"ϟ New AI Signal"}</ControlButton><ControlButton disabled={busy||!dataReady} onClick={()=>void analyze(false)}>Analyze candles · Technical</ControlButton></div>
    <div className="signal-connection-status"><span>Chart: TradingView widget</span><span>OHLC: {CANDLE_MARKETS[market].provider==="binance"?"Binance public spot":capabilities?.forexConfigured?"Twelve Data · plan permissions required":"Twelve Data not configured"}</span><span>AI: Gemini · {capabilities?.aiConfigured?"configured · verified on each run":"not configured"}</span></div>
    {!capabilities?.aiConfigured&&<p className="signal-setup-note">AI review ត្រូវការ <code>GEMINI_API_KEY</code> និង <code>GEMINI_ANALYSIS_MODEL</code> នៅ server។ Technical analysis អាចប្រើបានដោយមិនមាន AI។</p>}
    {!dataReady&&<p className="signal-setup-note">កំណត់ <code>TWELVEDATA_API_KEY</code> ជាមួយសិទ្ធិទិន្នន័យសម្រាប់ទីផ្សារនេះ។ Widget TradingView មិនអាចផ្ដល់ candles ទៅម៉ាស៊ីនវិភាគដោយផ្ទាល់ទេ។</p>}
    {error&&<p className="signal-error" role="alert">{error}</p>}
    <div className="signal-chart-tabs" role="group" aria-label="Chart source"><ControlButton controlSize="sm" aria-pressed={chart==="tradingview"} onClick={()=>setChart("tradingview")}>TradingView chart</ControlButton><ControlButton controlSize="sm" disabled={!report} aria-pressed={chart==="analysis"} onClick={()=>setChart("analysis")}>Analyzed OHLC + levels</ControlButton></div>
    {chart==="tradingview"?<TradingViewChart key={`${market}:${frame}:${theme}`} market={market} frame={frame} theme={theme}/>:report&&<CandleEvidenceChart report={report} active={!expired}/>}
    {!report?<div className="signal-empty"><span aria-hidden="true">ϟ</span><h3>No active signals yet</h3><p>ជ្រើស symbol និង timeframe រួចចុច New AI Signal ឬ Technical analysis។ លទ្ធផល WAIT ជាលទ្ធផលត្រឹមត្រូវពេលលក្ខខណ្ឌមិនគ្រប់។</p></div>:<div className="signal-report">
      <div className="signal-report-header"><h3>{CANDLE_MARKETS[report.market].label} · {report.frame}</h3><strong className={`signal-action action-${action.toLowerCase()}`}>{action}{expired&&action!=="WAIT"?" · HISTORICAL / EXPIRED":""}</strong></div>
      <p>{expired?"របាយការណ៍នេះមិនមែនជាសញ្ញាចូលថ្មីទេ។ សូមបង្កើតការវិភាគថ្មី។":report.signal.reason}</p>
      <div className="signal-report-levels">{[["Entry reference",action==="WAIT"?null:report.signal.entry],["Stop loss",action==="WAIT"?null:report.signal.stopLoss],["Take profit · 2R",action==="WAIT"?null:report.signal.takeProfit]].map(([label,value])=><div key={String(label)}><span>{label}</span><strong>{price(value as number|null)}</strong></div>)}</div>
      <p className="signal-meta">{report.source} · {report.candles.length} displayed closed candles · trend {report.trend} · {report.asOf?`Last close ${time(report.asOf)} UTC+7`:"No closed candle"}{report.expiresAt?` · Expires ${time(report.expiresAt)} UTC+7`:""}</p>
      <ul className="signal-checks">{report.signal.checks.map(check=><li key={check.label}>{check.passed?"✓":"○"} {check.label}</li>)}</ul>
      <section className="ai-candle-review"><h3>{report.ai.status==="reviewed"?"AI review · RFX TEAM":"Technical report · no completed AI review"}</h3><p>{report.ai.summary}</p>{report.ai.observations.map((text,i)=><p key={i}>{text}</p>)}{report.ai.risks.length>0&&<><h4>ចំណុចត្រូវពិនិត្យ</h4><ul>{report.ai.risks.map((text,i)=><li key={i}>{text}</li>)}</ul></>}</section>
      <p className="signal-meta">Signal តាម Structure + EMA20 + FVG/OB first-touch rejection នៅ candle បិទ។ មិនទាន់មាន news/HTF/spread filter នៅម៉ាស៊ីននេះទេ។ Entry ជាតម្លៃយោង មិនមែន executable quote ឬការធានាឈ្នះ។</p>
    </div>}
    <ImageAnalysisPanel configured={capabilities?.visionConfigured===true}/>
    <details className="signal-history"><summary>Saved analysis history · {reports.length}</summary>{reports.map(item=><button type="button" className={`signal-history-item ${selectedReportId===item.id?"is-selected":""}`} key={item.id} onClick={()=>{setMarket(item.market);setFrame(item.frame);setSelectedReportId(item.id);setChart("analysis");setClock(Date.now());setError("");}}><b>{CANDLE_MARKETS[item.market].label} · {item.frame} · {item.signal.action}</b><span>{time(item.generatedAt)} UTC+7 · {item.ai.status==="reviewed"?"AI reviewed":"Technical analysis"} · {item.signal.action==="WAIT"?"No entry setup":"saved chart marker"}</span></button>)}</details>
  </section>;
}

function CandleEvidenceChart({report,active}:{report:CandleAnalysisReport;active:boolean}){
  const candles=report.candles.slice(-60),ema=report.ema.slice(-60);
  if(!candles.length)return <p>No validated candles to display.</p>;
  const levels=report.signal.action!=="WAIT"?[report.signal.entry,report.signal.stopLoss,report.signal.takeProfit].filter((n):n is number=>n!==null&&Number.isFinite(n)):[];
  const low=Math.min(...candles.map(c=>c.low),...levels),high=Math.max(...candles.map(c=>c.high),...levels),span=high-low||high*.01;
  const y=(v:number)=>280-(v-low)/span*230,x=(i:number)=>50+i/(Math.max(1,candles.length-1))*790;
  const last=candles.length-1;
  return <figure className="signal-ohlc-chart"><figcaption>{report.source} · {report.frame} · Closed candles only · {active?"current report":"historical / expired"}</figcaption><svg viewBox="0 0 940 330" role="img" aria-label={`Closed candle analysis for ${report.market}, ${report.frame}. Signal ${active?report.signal.action:"expired"}.`}>
    {[0,1,2,3].map(i=><g key={i}><line className="candle-grid" x1="40" x2="850" y1={50+i*230/3} y2={50+i*230/3}/><text x="855" y={54+i*230/3}>{price(high-i*span/3)}</text></g>)}
    {candles.map((c,i)=><g key={c.time} className={c.close>=c.open?"candle-up":"candle-down"}><title>{time(c.time)} UTC+7 · O {c.open} H {c.high} L {c.low} C {c.close}</title><line x1={x(i)} x2={x(i)} y1={y(c.high)} y2={y(c.low)}/><rect x={x(i)-3} y={Math.min(y(c.open),y(c.close))} width="6" height={Math.max(1,Math.abs(y(c.close)-y(c.open)))}/></g>)}
    {ema.length===candles.length&&<polyline className="signal-ema" points={ema.map((v,i)=>`${x(i)},${y(v)}`).join(" ")} fill="none"/>}
    {levels.map((level,i)=><g key={i}><line className="signal-price-level" x1="40" x2="850" y1={y(level)} y2={y(level)}/><text x="50" y={y(level)-6}>{["ENTRY","SL","TP"][i]} {price(level)}</text></g>)}
    {report.signal.action!=="WAIT"&&<g className={`signal-marker-group action-${report.signal.action.toLowerCase()}`}><circle cx={x(last)} cy={y(candles[last].close)} r="6" className="signal-marker"/><text x={x(last)-8} y={y(candles[last].close)-18} textAnchor="end">{report.signal.action}{active?"":" · HISTORICAL"}</text></g>}
    <text x="50" y="315">{time(candles[0].time)}</text><text x="840" y="315" textAnchor="end">{time(candles[last].time)} UTC+7</text>
  </svg><p>EMA20 · ក្រាបនេះប្រើ candles ដូចគ្នានឹងម៉ាស៊ីនវិភាគ។ សញ្ញាមិនត្រូវបានគូរចូល widget TradingView ទេ។</p></figure>;
}
