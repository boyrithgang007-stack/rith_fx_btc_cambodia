"use client";

import ControlButton from "./ControlButton";
import EaBotPanel from "./EaBotPanel";

import { useEffect, useMemo, useRef, useState } from "react";
import { chartSignals, type ChartSignal, analyzeMarket, backtestStrategy, evaluateConfirmedSignal, aggregateCandles, hasContinuousCandles, validCandles, type Candle, type Analysis, type Signal } from "./strategy";

const frames = { "30m": {days:"1",ms:1800000}, "4h": {days:"30",ms:14400000}, "4d": {days:"365",ms:345600000} };
type Frame = keyof typeof frames;
const higherFrames = { "30m": {label:"4h",ms:14400000}, "4h": {label:"1d",ms:86400000}, "4d": {label:"16d",ms:1382400000} };
const fmt = (n:number | null) => n === null ? "—" : n.toLocaleString("en-US", {maximumFractionDigits:n < 1 ? 7 : 2});
const date = (n:number) => new Date(n).toLocaleString("km-KH");

function CandleChart({candles,analysis,signal,markers}:{candles:Candle[];analysis:Analysis;signal:Signal;markers:ChartSignal[]}) {
  const [selectedTime,setSelectedTime]=useState<number|null>(null);
  const [showSignals,setShowSignals]=useState(true);
  const [count,setCount]=useState(60),[zones,setZones]=useState(true),[hover,setHover]=useState<number | null>(null);
  const start=Math.max(0,candles.length-count),visible=candles.slice(start);
  if(!visible.length) return <div className="chart-empty">មិនមាន candles សម្រាប់បង្ហាញ។</div>;
  const selectedMarker=showSignals ? markers.find(m=>m.time===selectedTime && m.index>=start) : undefined;
  const chartSignal=selectedMarker?.signal ?? signal;
  const levels=[chartSignal.entry,chartSignal.stopLoss,chartSignal.takeProfit].filter((v):v is number=>v!==null);
  const low=Math.min(...visible.map(c=>c.low),...levels),high=Math.max(...visible.map(c=>c.high),...levels);
  const pad=(high-low)*.1 || high*.01, min=low-pad,max=high+pad;
  const x=(i:number)=>30+(i-start+.5)*850/visible.length,y=(p:number)=>330-(p-min)/(max-min)*300;
  const current=visible[hover ?? visible.length-1] ?? visible.at(-1)!;
  return <div className="smc-chart smc-chart-dark">
    <div className="smc-toolbar"><label>Candles <select value={count} onChange={e=>setCount(Number(e.target.value))}><option>30</option><option>60</option><option>120</option></select></label><label><input type="checkbox" checked={zones} onChange={e=>setZones(e.target.checked)}/> FVG / OB</label><span>បៃតង ↑ · ក្រហម ↓ · ខៀវ EMA 20</span></div>
    <div className="chart-signal-status" role="status"><strong>{signal.action}</strong><span>សញ្ញា candle ចុងក្រោយ · {date(candles.at(-1)!.time)}</span><span>{signal.action==="WAIT" ? "រង់ចាំការបញ្ជាក់ ឬទិន្នន័យថ្មី" : "បានបញ្ជាក់នៅ candle បិទ — ផ្ទៀងផ្ទាត់តម្លៃ broker មុនចូល"}</span></div>
    <div className="smc-toolbar"><label><input type="checkbox" checked={showSignals} onChange={e=>{setShowSignals(e.target.checked);setSelectedTime(null);}}/> ព្រួញ BUY / SELL</label><span>ចុចព្រួញដើម្បីមើល Entry / SL / TP ប្រវត្តិសាស្ត្រ</span></div>
    <div className="smc-chart-legend"><span style={{color:"#5799ff"}}>■ Bullish FVG</span><span style={{color:"#ff9a45"}}>■ Bearish FVG</span><span style={{color:"#41c98e"}}>■ Bullish OB</span><span style={{color:"#f26c7d"}}>■ Bearish OB</span><span>┄ BOS / CHoCH</span></div>
    <p className="smc-ohlc">{date(current.time)} · O {fmt(current.open)} · H {fmt(current.high)} · L {fmt(current.low)} · C {fmt(current.close)}</p>
    <div className="smc-chart-scroll"><svg viewBox="0 0 1000 380" role="img" aria-label="Candlestick chart with structure, FVG, OB and trade levels">
      {Array.from({length:5},(_,i)=>{const p=min+(max-min)*i/4;return <g key={i}><line x1="30" x2="885" y1={y(p)} y2={y(p)} stroke="currentColor" opacity=".12"/><text x="890" y={y(p)+4} fill="currentColor" fontSize="11">{fmt(p)}</text></g>;})}
      {zones && analysis.zones.filter(z=>Math.min(z.invalidatedAt ?? Infinity,z.touchedAt ?? Infinity,z.index+40,candles.length-1)>=start).slice(-10).map(z=>{
        const end=Math.min(z.invalidatedAt ?? Infinity,z.touchedAt ?? Infinity,z.index+40,candles.length-1);
        const bullish=z.direction==="BUY",fvgColor=bullish ? "#5799ff" : "#ff9a45",obColor=bullish ? "#41c98e" : "#f26c7d";
        const left=x(Math.max(start,z.index)),right=end===candles.length-1 && z.touchedAt===null && z.invalidatedAt===null && candles.length-1<z.index+40 ? 880 : x(end);
        const label=bullish ? "BULLISH" : "BEARISH";
        const zoneY=(value:number)=>Math.max(25,Math.min(335,y(value)));
        return <g key={z.id} opacity={z.touchedAt!==null || z.invalidatedAt!==null || candles.length-1>z.index+40 ? .45 : 1} pointerEvents="none">
          <rect x={left} y={zoneY(z.top)} width={Math.max(3,right-left)} height={Math.max(1,zoneY(z.bottom)-zoneY(z.top))} fill={fvgColor} fillOpacity=".2" stroke={fvgColor} strokeWidth="1"/>
          <text x={left+3} y={Math.max(35,zoneY(z.top)-4)} fontSize="9" fill={fvgColor}>{label}_FVG</text>
          <rect x={left} y={zoneY(z.obTop)} width={Math.max(3,right-left)} height={Math.max(1,zoneY(z.obBottom)-zoneY(z.obTop))} fill={obColor} fillOpacity=".16" stroke={obColor} strokeWidth="1"/>
          <text x={left+3} y={Math.min(335,zoneY(z.obBottom)+11)} fontSize="9" fill={obColor}>{label}_OB</text>
          <title>OB origin: {date(candles[z.obIndex].time)} · Confirmed: {date(candles[z.index].time)}</title>
        </g>;
      })}
      <polyline points={visible.map((_,i)=>`${x(i+start)},${y(analysis.ema[i+start])}`).join(" ")} fill="none" stroke="#468bff" strokeWidth="1.5"/>
      {visible.map((c,i)=>{const color=c.close>=c.open ? "#14a57b" : "#e45f70";return <g key={c.time} onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)}><rect x={x(i+start)-425/visible.length} y="25" width={850/visible.length} height="310" fill="transparent"/><line x1={x(i+start)} x2={x(i+start)} y1={y(c.high)} y2={y(c.low)} stroke={color}/><rect x={x(i+start)-250/visible.length} y={y(Math.max(c.open,c.close))} width={500/visible.length} height={Math.max(1,Math.abs(y(c.open)-y(c.close)))} fill={color}/><title>{date(c.time)} · O {fmt(c.open)} H {fmt(c.high)} L {fmt(c.low)} C {fmt(c.close)}</title></g>;})}
      {analysis.events.filter(e=>e.index>=start).slice(-6).map(e=>{
        const color=e.direction==="BUY" ? "#41c98e" : "#f26c7d";
        const label=`${e.direction==="BUY" ? "BULLISH" : "BEARISH"}_${e.kind=== "CHoCH" ? "CHOCH" : e.kind}`;
        const left=x(Math.max(start,e.pivotIndex)),right=x(e.index);
        return <g key={e.index} pointerEvents="none"><line x1={left} x2={right} y1={y(e.price)} y2={y(e.price)} stroke={color} strokeWidth="1.5" strokeDasharray="6 4"/><text x={Math.max(100,Math.min(800,(left+right)/2))} y={Math.max(35,Math.min(335,y(e.price)+(e.direction==="BUY" ? -8 : 15)))} textAnchor="middle" fill={color} fontSize="10" fontWeight="600" paintOrder="stroke" stroke="#131722" strokeWidth="3">{label}</text></g>;
      })}
      {[["Entry",chartSignal.entry,"#468bff"],["SL",chartSignal.stopLoss,"#e45f70"],["TP",chartSignal.takeProfit,"#14a57b"]].map(([label,value,color])=>typeof value==="number" && <g key={String(label)}><line x1="30" x2="880" y1={y(value)} y2={y(value)} stroke={String(color)} strokeDasharray="6 4"/><text x="32" y={y(value)-5} fill={String(color)} fontSize="11">{label} {fmt(value)}</text></g>)}
      {showSignals && markers.filter(m=>m.index>=start).map(m=>{
        const buy=m.signal.action==="BUY",color=buy ? "#41c98e" : "#f26c7d";
        const cx=x(m.index),cy=Math.max(48,Math.min(310,y(buy ? candles[m.index].low : candles[m.index].high)+(buy ? 18 : -18)));
        const select=()=>setSelectedTime(m.time);
        return <g key={m.time} role="button" tabIndex={0} className="chart-trade-marker" aria-label={`${m.signal.action} · ${date(m.time)} · Entry ${fmt(m.signal.entry)}`} onClick={select} onKeyDown={e=>{if(e.key==="Enter" || e.key===" "){e.preventDefault();select();}}}>
          <rect x={cx-24} y={cy-16} width="48" height="36" rx="6" fill="#131722" fillOpacity=".9" stroke={color}/>
          <path d={buy ? `M${cx-5},${cy-4} L${cx},${cy-11} L${cx+5},${cy-4} Z` : `M${cx-5},${cy-11} L${cx},${cy-4} L${cx+5},${cy-11} Z`} fill={color}/>
          <text x={cx} y={cy+11} textAnchor="middle" fill={color} fontSize="10" fontWeight="700">{m.signal.action}</text>
          <title>{date(m.time)} · Entry {fmt(m.signal.entry)} · SL {fmt(m.signal.stopLoss)} · TP {fmt(m.signal.takeProfit)}</title>
        </g>;
      })}
      <text x="30" y="365" fill="currentColor" fontSize="11">{new Date(visible[0].time).toLocaleDateString()}</text><text x="740" y="365" fill="currentColor" fontSize="11">{new Date(visible.at(-1)!.time).toLocaleDateString()}</text>
    </svg></div>
    {selectedMarker && <div className="chart-signal-detail"><strong>{selectedMarker.signal.action} · សញ្ញាប្រវត្តិសាស្ត្រ</strong><span>{date(selectedMarker.time)}</span><span>Entry {fmt(chartSignal.entry)} · SL {fmt(chartSignal.stopLoss)} · TP {fmt(chartSignal.takeProfit)}</span><p>{chartSignal.reason}</p><ControlButton type="button" onClick={()=>setSelectedTime(null)}>ត្រឡប់ទៅ candle ចុងក្រោយ</ControlButton></div>}
    <p className="smc-data-note">ព្រួញសម្គាល់ការបញ្ជាក់នៅពេល candle បិទ មិនមែន order ដែលបាន execute។ តម្លៃ Entry ជាតម្លៃប្រវត្តិសាស្ត្រ; ទិន្នន័យ CoinGecko អាចយឺត។</p>
    {showSignals && !markers.some(m=>m.index>=start) && <p className="smc-data-note">មិនមាន BUY/SELL ដែលបំពេញលក្ខខណ្ឌក្នុង candles ដែលកំពុងបង្ហាញទេ។</p>}
  </div>;
}

export default function StrategyPanel({coin,name}:{coin:string;name:string}) {
  const [frame,setFrame]=useState<Frame>("4h"),[capital,setCapital]=useState(10000),[risk,setRisk]=useState(1),[rr,setRr]=useState(2),[cost,setCost]=useState(10);
  const [confirm,setConfirm]=useState(true),[discount,setDiscount]=useState(false);
  const [data,setData]=useState<{key:string;candles:Candle[];higher:Candle[];at:number}|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0),[now,setNow]=useState(0);
  const [alerts,setAlerts]=useState(false),[alertMessage,setAlertMessage]=useState("");
  const seen=useRef(new Set<string>());
  const key=`${coin}:${frame}`;
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),10000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{
    let cancelled=false,busy=false;
    const controller=new AbortController();
    async function fetchCandles(){
      if(busy) return;busy=true;setLoading(true);setNow(Date.now());
      try {
        async function get(days:string, interval:string) {
          const response=await fetch(`/api/market?candles=1&coin=${encodeURIComponent(coin)}&days=${days}`,{cache:"no-store",signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])});
          const result=await response.json();
          if(!response.ok)throw new Error(result.error || "មិនអាចទាញ candles បានទេ។");
          if(!validCandles(result.candles) || !result.candles.length || result.interval!==interval)throw new Error("ទិន្នន័យ candle ឬ timeframe មិនត្រឹមត្រូវ។");
          return result.candles as Candle[];
        }
        const [base,external]=await Promise.all([get(frames[frame].days,frame),frame==="30m" ? get("30","4h") : Promise.resolve(null)]);
        if(!hasContinuousCandles(base,frames[frame].ms))throw new Error("Candles មានចន្លោះខ្វះទិន្នន័យ។ សូម Refresh។");
        const higher=external ?? aggregateCandles(base,frames[frame].ms,higherFrames[frame].ms);
        if(!cancelled){setData({key:`${coin}:${frame}`,candles:base,higher,at:Date.now()});setError("");setNow(Date.now());}
      }catch(e){if(!cancelled){setData(null);setError(e instanceof Error ? e.message : "ទាញទិន្នន័យបរាជ័យ។");}}
      finally{busy=false;if(!cancelled)setLoading(false);}
    }
    const initial=window.setTimeout(()=>void fetchCandles(),0),timer=window.setInterval(()=>void fetchCandles(),60000);
    return()=>{cancelled=true;controller.abort();clearTimeout(initial);clearInterval(timer);};
  },[coin,frame,refresh]);
  const candles=useMemo(()=>data?.key===key ? data.candles : [],[data,key]);
  const analysis=useMemo(()=>analyzeMarket(candles),[candles]);
  const higher=useMemo(()=>data?.key===key ? data.higher : [],[data,key]);
  const higherAnalysis=useMemo(()=>analyzeMarket(higher),[higher]);
  const confirmation=useMemo(()=>confirm ? {candles:higher,intervalMs:higherFrames[frame].ms,baseIntervalMs:frames[frame].ms,requireDiscount:discount} : undefined,[confirm,higher,frame,discount]);
  const signal=useMemo(()=>evaluateConfirmedSignal(candles,capital,risk,rr,confirmation,cost),[candles,capital,risk,rr,confirmation,cost]);
  const backtest=useMemo(()=>backtestStrategy(candles,capital,risk,rr,cost,confirmation),[candles,capital,risk,rr,cost,confirmation]);
  const markers=useMemo(()=>chartSignals(candles,capital,risk,rr,confirmation,cost),[candles,capital,risk,rr,confirmation,cost]);
  const passed=signal.checks.filter(c=>c.passed).length;
  const stale=!!candles.length && now-candles.at(-1)!.time>frames[frame].ms+15*60000;
  const action=stale || error || loading || data?.key!==key ? "WAIT" : signal.action;
  const displayedSignal=action==="WAIT" ? {...signal,action:"WAIT" as const,entry:null,takeProfit:null,quantity:0,notional:0} : signal;
  useEffect(()=>{
    if(!alerts || action==="WAIT" || !signal.zone || !("Notification" in window) || Notification.permission!=="granted")return;
    const id=`${key}:${signal.zone.id}:${candles.at(-1)?.time}:${action}`;
    if(seen.current.has(id))return;
    seen.current.add(id);
    new Notification(`${name} · ${action}`,{body:`Entry ${fmt(signal.entry)} · SL ${fmt(signal.stopLoss)} · TP ${fmt(signal.takeProfit)}`});
  },[alerts,action,signal,key,candles,name]);
  async function toggleAlerts(){
    if(alerts){setAlerts(false);return;}
    if(!("Notification" in window)){setAlertMessage("Browser មិនគាំទ្រ alerts។");return;}
    try{const p=await Notification.requestPermission();setAlerts(p==="granted");setAlertMessage(p==="granted" ? "Alerts ដំណើរការពេលផ្ទាំងនេះបើក។" : "មិនបានអនុញ្ញាត alerts។");}catch{setAlertMessage("មិនអាចបើក alerts បានទេ។");}
  }
  function download(){
    const rows=["time,direction,entry,exit,pnl,exit_reason",...backtest.trades.map(t=>`${new Date(t.time).toISOString()},${t.direction},${t.entry},${t.exit},${t.pnl},${t.reason}`)];
    const url=URL.createObjectURL(new Blob([rows.join("\n")],{type:"text/csv"}));const a=document.createElement("a");a.href=url;a.download=`${coin}-${frame}-paper-trades.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <section className="panel strategy-panel" id="strategy">
    <div className="strategy-heading"><div><p className="eyebrow">MARKET STRUCTURE · FVG + ORDER BLOCK</p><h2>ទិសដៅ និងពេលចូលទីផ្សារ</h2><p>{name} · វិភាគលើ candle បិទ · {confirm ? `HTF confirmation ${higherFrames[frame].label}` : "Single timeframe"}</p></div><span className="paper-badge">PAPER · គ្មាន order ពិត</span></div>
    <EaBotPanel />
    <div className="smc-toolbar smc-controls"><label>Timeframe<select value={frame} onChange={e=>setFrame(e.target.value as Frame)}><option value="30m">30m · 1 ថ្ងៃ</option><option value="4h">4h · 30 ថ្ងៃ</option><option value="4d">4d · 1 ឆ្នាំ</option></select></label><label>ដើមទុន $<input type="number" min="1" max="1000000000" value={capital} onChange={e=>setCapital(Math.min(1e9,Math.max(1,Number(e.target.value)||1)))}/></label><label>Risk % (≤ 2)<input type="number" min="0.1" max="2" step="0.1" value={risk} onChange={e=>setRisk(Math.min(2,Math.max(.1,Number(e.target.value)||.1)))}/></label><label>Reward / Risk<input type="number" min="1" max="5" step="0.5" value={rr} onChange={e=>setRr(Math.min(5,Math.max(1,Number(e.target.value)||1)))}/></label><ControlButton onClick={()=>setRefresh(v=>v+1)} disabled={loading}>↻ Refresh</ControlButton><ControlButton onClick={()=>void toggleAlerts()}>{alerts ? "● Alerts ON" : "Alerts OFF"}</ControlButton></div>
    <div className="smc-toolbar"><label><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/> បញ្ជាក់ទិសដៅ HTF ({higherFrames[frame].label})</label><label><input type="checkbox" checked={discount} disabled={!confirm} onChange={e=>setDiscount(e.target.checked)}/> Discount / Premium filter</label><span>HTF: {higher.length<20 ? "ទិន្នន័យមិនគ្រប់" : higherAnalysis.trend} · {higher.length} candles</span></div>
    <div className="smc-quality"><label htmlFor="signal-readiness">លក្ខខណ្ឌបានបំពេញ {passed} / {signal.checks.length} · មិនមែនជាភាគរយឈ្នះ</label><progress id="signal-readiness" value={passed} max={Math.max(1,signal.checks.length)}/></div>
    {alertMessage && <p role="status">{alertMessage}</p>}
    {error && <p className="strategy-error" role="alert">{error} សូមចុច Refresh។</p>}
    <div className="smc-summary"><article><small>ទិសដៅ</small><strong>{!candles.length ? "—" : analysis.trend==="BULLISH" ? "↗ ឡើង" : analysis.trend==="BEARISH" ? "↘ ចុះ" : "↔ មិនច្បាស់"}</strong><span>Structure + EMA 20</span></article><article><small>សញ្ញានៅ candle បិទ</small><strong className={action==="BUY" ? "text-positive" : action==="SELL" ? "text-negative" : ""}>{action}</strong><span>{loading ? "កំពុងទាញទិន្នន័យ…" : stale ? "ទិន្នន័យយឺត — ផ្អាកសញ្ញា" : action==="SELL" ? "សញ្ញាចុះ / paper short" : "បញ្ជាក់តាមច្បាប់"}</span></article><article><small>Support / Resistance</small><strong>{fmt(analysis.support)} / {fmt(analysis.resistance)}</strong><span>Confirmed swings</span></article><article><small>ATR 14 · បម្រែបម្រួល</small><strong>{fmt(analysis.atr || null)}</strong><span>{candles.length} candles</span></article></div>
    <CandleChart key={key} candles={candles} analysis={analysis} signal={displayedSignal} markers={markers}/>
    <div className="smc-decision"><div><h3>{action==="BUY" ? "លក្ខខណ្ឌទិញបានបំពេញ" : action==="SELL" ? "លក្ខខណ្ឌលក់បានបំពេញ" : "រង់ចាំការបញ្ជាក់"}</h3><p>{error ? "ផ្អាកសញ្ញាដោយសារទិន្នន័យបរាជ័យ។" : stale ? "Candles ចាស់ពេកសម្រាប់បង្ហាញសញ្ញាថ្មី។" : loading ? "កំពុងផ្ទៀងផ្ទាត់ទិន្នន័យថ្មី។" : signal.reason}</p><ul className="smc-checks">{signal.checks.map(c=><li key={c.label}>{c.passed ? "✓" : "○"} {c.label}</li>)}</ul></div><div className="signal-levels"><div><span>Entry · candle close</span><strong>{fmt(displayedSignal.entry)}</strong></div><div><span>Stop loss · OB + ATR</span><strong>{fmt(displayedSignal.stopLoss)}</strong></div><div><span>Take profit · {rr}R</span><strong>{fmt(displayedSignal.takeProfit)}</strong></div><div><span>Quantity · exposure ≤ ដើមទុន</span><strong>{fmt(displayedSignal.quantity)}</strong></div><div><span>Risk រួមថ្លៃនៅ SL $</span><strong>{fmt(action==="WAIT" ? capital*risk/100 : signal.riskAmount)}</strong></div><div><span>Notional $</span><strong>{fmt(displayedSignal.notional)}</strong></div></div></div>
    <p className="smc-data-note">Candle បិទចុងក្រោយ: {candles.length ? date(candles.at(-1)!.time) : "—"} · ទាញទិន្នន័យ: {data?.key===key ? date(data.at) : "—"} · Refresh 60s · <a href="https://docs.coingecko.com/reference/coins-id-ohlc" target="_blank" rel="noreferrer">CoinGecko OHLC</a></p>
    <details className="smc-rules"><summary>របៀបអានសញ្ញា និងច្បាប់</summary><p>BUY: structure ឡើង និង close លើ EMA 20; SELL: structure ចុះ និង close ក្រោម EMA 20។ FVG ត្រូវកើតក្នុង 3 candles ក្រោយ break ហើយរក OB ពណ៌ផ្ទុយក្នុង 8 candles មុន។ រង់ចាំ first touch និង close ត្រឡប់ចេញពី FVG។ Zone ផុតកំណត់ក្រោយ 40 candles ឬបែក OB។ Pivot បញ្ជាក់ក្រោយ 2 candles ខាងស្តាំ។</p><p>ប្រអប់ចាប់ផ្តើមនៅពេលបញ្ជាក់; ពណ៌ស្រអាប់សម្គាល់ zone ដែលបានប៉ះ ឬលុបចោល។ HTF confirmation ប្រើតែ candle ធំដែលបានបិទមុនពេលសញ្ញា។ Discount/Premium យោង midpoint នៃ HTF 20 candles។ មិនទាន់មាន news filter។ SELL ជាសញ្ញាទិសចុះ; ការលក់ short អាស្រ័យលើទីផ្សារ និង broker។ សញ្ញាគឺតាមច្បាប់ មិនមែនការធានាតម្លៃអនាគត។</p></details>
    <div className="backtest-section"><div className="backtest-heading"><h3>Backtest · BUY + SELL</h3><ControlButton onClick={download} disabled={!backtest.trades.length}>↓ Export trades CSV</ControlButton></div><label className="smc-cost">Fee + slippage ក្នុងមួយជើង (bps)<input type="number" min="0" max="100" value={cost} onChange={e=>setCost(Math.min(100,Math.max(0,Number(e.target.value)||0)))}/></label><div className="backtest-grid"><div><span>Trades</span><strong>{backtest.trades.length}</strong></div><div><span>Win rate</span><strong>{backtest.trades.length ? `${backtest.winRate.toFixed(1)}%` : "—"}</strong></div><div><span>Net return</span><strong>{backtest.netReturn.toFixed(2)}%</strong></div><div><span>Profit factor</span><strong>{backtest.profitFactor===null ? "?" : backtest.profitFactor.toFixed(2)}</strong></div><div><span>Expectancy / trade $</span><strong>{fmt(backtest.expectancy)}</strong></div><div><span>Max drawdown</span><strong>{backtest.maxDrawdown.toFixed(2)}%</strong></div></div><p className="backtest-disclaimer">ប្រើច្បាប់ដូចសញ្ញាខាងលើ; ចូលនៅ open នៃ candle បន្ទាប់។ ប៉ះ SL និង TP ក្នុង candle តែមួយ គិត SL មុន; gap កាត់ SL ប្រើ open។ បិទ trade នៅចុងទិន្នន័យ។ គិតថ្លៃទាំងពីរជើង; មិនគិត funding/borrow fees។ Drawdown គិតត្រឹម trade បិទ។ គំរូតូចមិនអាចបញ្ជាក់ប្រសិទ្ធភាពយុទ្ធសាស្ត្រ។</p>
    <EquityChart values={backtest.equityCurve}/><p className="smc-data-note">{backtest.trades.length<30 ? "មាន trades តិចជាង 30 — លទ្ធផលអាចប្រែប្រួលខ្លាំង។" : "លទ្ធផលនេះមិនមែនជា out-of-sample validation ទេ។"} {confirm ? "Backtest ប្រើ HTF filter ដូចសញ្ញាផ្ទាល់។" : "HTF filter បិទ។"}</p>
    <details><summary>ប្រវត្តិ trades ({backtest.trades.length})</summary><div className="table-scroll"><table><thead><tr><th>ពេលវេលា</th><th>ទិសដៅ</th><th>Entry</th><th>Exit</th><th>P/L $</th><th>Exit reason</th></tr></thead><tbody>{backtest.trades.map(t=><tr key={t.time}><td>{date(t.time)}</td><td>{t.direction}</td><td>{fmt(t.entry)}</td><td>{fmt(t.exit)}</td><td>{fmt(t.pnl)}</td><td>{t.reason}</td></tr>)}</tbody></table></div></details></div>
  </section>;
}

function EquityChart({values}:{values:number[]}) {
  if(values.length<2)return null;
  const low=Math.min(...values),span=Math.max(...values)-low || 1;
  const points=values.map((v,i)=>`${20+i/(values.length-1)*940},${130-(v-low)/span*100}`).join(" ");
  return <div className="smc-equity"><h4>Equity curve · trade បិទ</h4><svg viewBox="0 0 980 160" role="img" aria-label="Closed-trade equity curve"><title>Start {fmt(values[0])}, end {fmt(values.at(-1)!)}</title><polyline points={points} fill="none" stroke="#468bff" strokeWidth="2"/><text x="20" y="155" fill="currentColor" fontSize="12">Start $ {fmt(values[0])}</text><text x="750" y="155" fill="currentColor" fontSize="12">End $ {fmt(values.at(-1)!)}</text></svg></div>;
}
