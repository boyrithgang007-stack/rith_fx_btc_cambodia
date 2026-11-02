"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ControlButton from "./ControlButton";
import { analyzeResearch, type ResearchPoint, type ResearchResult } from "./research-analysis";
import type { MacroData } from "./lib/macro";
import type { NewsHeadline } from "./lib/bloomberg";
import { validTerminalAssets, type TerminalAsset, type CommodityQuote } from "./terminal-data";

type Source = { name:string; ok:boolean; detail:string };
type Snapshot = { target:string; checkedAt:number; sources:Source[]; result:ResearchResult; macro:MacroData|null; headlines:NewsHeadline[] };
const targets = [ ["crypto:bitcoin","Bitcoin / USD"], ["crypto:ethereum","Ethereum / USD"], ["commodity:gold","Gold futures / USD"], ["commodity:silver","Silver futures / USD"], ["commodity:wti","WTI oil / USD"], ["commodity:brent","Brent oil / USD"], ...["EUR/USD","GBP/USD","USD/JPY","USD/CHF","USD/CAD","AUD/USD","NZD/USD"].map(pair=>[`forex:${pair}`,pair]) ];
const displayTime=(n:number|string)=>new Date(n).toLocaleString("en-GB",{timeZone:"Asia/Bangkok",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",hour12:false});

export default function ResearchWorkbench() {
  const [target,setTarget]=useState("crypto:bitcoin");
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  async function run() {
    controller.current?.abort();
    const abort=new AbortController(); controller.current=abort;
    setBusy(true); setMessage(""); setSnapshot(null);
    const [kind,id]=target.split(":");
    const requests=[
      ["CoinGecko markets","/api/market"],
      [kind === "crypto" ? "Selected crypto history" : "Bitcoin context history (not scored)",`/api/market?coin=${encodeURIComponent(kind==="crypto"?id:"bitcoin")}&days=30`],
      ["Metals & energy / Yahoo","/api/commodities"],
      ["Forex / ECB via Frankfurter","/api/forex"],
      ["CPI / BLS + Forex Factory","/api/macro"],
      ["Bloomberg economics","/api/news"],
    ];
    try {
      const replies=await Promise.allSettled(requests.map(async([,url])=>{
        const response=await fetch(url,{cache:"no-store",signal:AbortSignal.any([abort.signal,AbortSignal.timeout(25_000)])});
        if(!response.ok)throw Error(`HTTP ${response.status}`);
        return response.json();
      }));
      if(abort.signal.aborted)return;
      const checkedAt=Date.now();
      const sources:Source[]=requests.map(([name],i)=>({name,ok:replies[i].status==="fulfilled",detail:replies[i].status==="fulfilled"?"Response received; provider may cache or delay data.":"Unavailable / request failed"}));
      const data=replies.map(r=>r.status==="fulfilled"?r.value:null);
      const invalid=(i:number,detail:string)=>{sources[i].ok=false;sources[i].detail=detail;};
      let assets:TerminalAsset[]=[];
      if(data[0]&&validTerminalAssets(data[0].assets)&&data[0].assets.length){assets=data[0].assets;sources[0].detail=`${assets.length} tracked assets; not the whole market.`;}else if(data[0])invalid(0,"Empty or invalid market response");
      let points:ResearchPoint[]=[];
      let maxAge=36*3600_000;
      if(kind==="crypto") {
        if(Array.isArray(data[1]?.prices))points=data[1].prices.map((p:{time:number;price:number})=>({time:p.time,price:p.price}));
        else if(data[1])invalid(1,"Invalid price history");
      }
      if(!Array.isArray(data[2]?.commodities)) {if(data[2])invalid(2,"Invalid commodity response");}
      else {
        sources[2].detail=`${data[2].commodities.length} reference quotes; daily history, may be delayed.`;
        if(kind==="commodity") {const quote=data[2].commodities.find((q:CommodityQuote)=>q.id===id);points=quote?.history??[];maxAge=96*3600_000;}
      }
      if(!Array.isArray(data[3]?.history)) {if(data[3])invalid(3,"Invalid Forex history");}
      else {
        sources[3].detail=`Daily reference rates as of ${data[3].asOf}; not broker quotes.`;
        if(kind==="forex"){points=data[3].history.filter((p:{date:string;rates:Record<string,number>})=>Number.isFinite(p.rates?.[id])).map((p:{date:string;rates:Record<string,number>})=>({time:Date.parse(p.date+"T00:00:00Z"),price:p.rates[id]}));maxAge=7*86400_000;}
      }
      const macro:MacroData|null=Array.isArray(data[4]?.events)&&Number.isFinite(data[4]?.checkedAt)?data[4]:null;
      if(macro){sources[4].detail=`${macro.calendarStatus}; Forex Factory: ${macro.forexFactory?.status??"unavailable"}`;sources[4].ok=macro.calendarStatus==="BLS calendar connected"&&macro.forexFactory?.status==="connected";}else if(data[4])invalid(4,"Invalid calendar response");
      const headlines:NewsHeadline[]=Array.isArray(data[5]?.headlines)?data[5].headlines:[];
      if(data[5]&&!Array.isArray(data[5].headlines))invalid(5,"Invalid news response");
      else if(data[5])sources[5].detail=`${headlines.length} Bloomberg headlines; one publisher, not all world news.`;
      const freshAssets=assets.filter(a=>{
        const updated=Date.parse((a as TerminalAsset & {last_updated?:string}).last_updated??"");
        return Number.isFinite(updated)&&updated<=checkedAt&&checkedAt-updated<=36*3600_000;
      });
      const breadth=kind==="crypto"&&sources[0].ok?{advancing:freshAssets.filter(a=>(a.price_change_percentage_24h??0)>0).length,declining:freshAssets.filter(a=>(a.price_change_percentage_24h??0)<0).length}:undefined;
      if(kind==="crypto"&&sources[0].ok)sources[0].detail+=` ${freshAssets.length} assets have a valid timestamp within 36h for breadth scoring.`;
      const result=analyzeResearch(points,checkedAt,maxAge,breadth);
      if(result.status==="insufficient") {const index=kind==="crypto"?1:kind==="commodity"?2:3;invalid(index,result.reason);}
      setSnapshot({target,checkedAt,sources,result,macro,headlines});
    } catch { if(!abort.signal.aborted)setMessage("មិនអាចបញ្ចប់ការវិភាគបាន។ សូមសាកល្បងម្ដងទៀត។"); }
    finally {if(!abort.signal.aborted)setBusy(false);}
  }
  const result=snapshot?.result;
  const next=snapshot?.macro?.events.filter(e=>e.time>=snapshot.checkedAt).sort((a,b)=>a.time-b.time)[0];
  const events=snapshot?.macro?.forexFactory?.events.filter(e=>e.isCpi).slice(0,4)??[];
  return <section className="research-workbench panel" aria-labelledby="research-title">
    <div className="research-header"><div><p className="eyebrow">MULTI-SOURCE RESEARCH / REFERENCE DATA</p><h2 id="research-title">មជ្ឈមណ្ឌលវិភាគទីផ្សារ</h2><p>ប្រមូលទិន្នន័យតម្លៃ CPI និងព័ត៌មានពីប្រភពដែលបានភ្ជាប់ រួចវិភាគភស្តុតាងជាមួយក្រាប។</p></div></div>
    <div className="research-toolbar"><label htmlFor="research-market">ទីផ្សារសម្រាប់វិភាគ<select id="research-market" value={target} disabled={busy} onChange={e=>{setTarget(e.target.value);setSnapshot(null);setMessage("");}}>{targets.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><ControlButton variant="primary" disabled={busy} onClick={()=>void run()}>{busy?"កំពុងប្រមូល និងវិភាគ…":"ចាប់ផ្ដើមវិភាគ"}</ControlButton></div>
    <p className="research-note">ការគ្របដណ្ដប់មានកំណត់៖ CoinGecko, Yahoo, ECB/Frankfurter, BLS, Forex Factory និង Bloomberg។ មិនមែនទិន្នន័យទាំងអស់លើពិភពលោកទេ។</p>
    {busy&&<p role="status">កំពុងទាញប្រភពនីមួយៗ… សំណើដែលយឺតនឹងបញ្ឈប់ក្រោយ 25 វិនាទី។</p>}
    {message&&<p role="alert">{message}</p>}
    {snapshot&&<><p className="research-note">Snapshot: {displayTime(snapshot.checkedAt)} · UTC+7 · {targets.find(([value])=>value===snapshot.target)?.[1]}</p>
      <div className="research-score" role="status"><h3>ពិន្ទុភស្តុតាងប្រវត្តិសាស្ត្រ / Evidence index</h3>{result?.status==="ready"?<><div className="research-percent"><strong>ឡើង {result.up}%</strong><strong>ចុះ {result.down}%</strong></div><div className="research-meter"><i style={{width:`${result.up}%`}}/></div><p>ភាគរយនេះជាពិន្ទុ heuristic ពីតម្លៃកន្លងមក។ មិនមែនជា % ឱកាសឈ្នះ ឬការធានាទិសដៅក្រោយព័ត៌មានទេ។</p></>:<p>មិនគ្រប់ទិន្នន័យសម្រាប់គណនាពិន្ទុ។ {result?.reason}</p>}</div>
      {result?.status==="ready"&&<><ResearchChart points={result.points}/><details className="research-method"><summary>មូលហេតុ និងវិធីគណនាពិន្ទុ</summary><p>ពិន្ទុឡើង = 50 + 50 × ផលបូកសញ្ញាដែលមានទម្ងន់ / ទម្ងន់សរុប។ សញ្ញានីមួយៗកំណត់ពី −1 ដល់ +1។ ទម្ងន់នេះមិនទាន់បានបញ្ជាក់ដោយ backtest សម្រាប់ទស្សន៍ទាយទេ។</p>{result.evidence.map(e=><p key={e.name}><b>{e.name} · weight {e.weight}</b><br/>{e.detail}</p>)}<p>News និង CPI ជាបរិបទសម្រាប់ពិនិត្យ មិនត្រូវបានបម្លែងដោយស្វ័យប្រវត្តិទៅជាសញ្ញាទិញ/លក់ទេ។</p></details></>}
      <div className="research-grid"><section><h3>ស្ថានភាពប្រភព / Coverage</h3>{snapshot.sources.map(source=><div className="research-source" key={source.name}><b>{source.ok?"✓":"!"} {source.name}</b><p>{source.detail}</p></div>)}</section>
      <section><h3>CPI / Event context</h3>{next&&<p>US CPI បន្ទាប់៖ <time dateTime={new Date(next.time).toISOString()}>{displayTime(next.time)} · UTC+7</time> {next.time-snapshot.checkedAt<86400_000?"· ក្នុងរយៈពេល 24 ម៉ោង":""}</p>}{events.map(e=><div className="research-source" key={e.id}><b>{e.currency} · {e.title}</b><p>{displayTime(e.time)} · Actual {e.actual??"—"} / Forecast {e.forecast??"—"} / Previous {e.previous??"—"}</p></div>)}{!next&&!events.length&&<p>មិនមានព្រឹត្តិការណ៍ CPI ដែលទាញបានក្នុង snapshot នេះ។</p>}<p className="research-note">កាលវិភាគមិនមែនជាលទ្ធផលចេញផ្សាយទេ។ Actual ដែលមិនមាននឹងបង្ហាញ «—»។</p><Link href="/markets/macro">បើក CPI / Macro ↗</Link></section></div>
      <section className="research-news"><h3>ព័ត៌មានក្នុង snapshot / Bloomberg</h3>{snapshot.headlines.map(item=><a key={item.url} href={item.url} target="_blank" rel="noreferrer"><time dateTime={item.publishedAt}>{displayTime(item.publishedAt)} · UTC+7</time><strong lang="en">{item.title} ↗</strong></a>)}{!snapshot.headlines.length&&<p>មិនមានព័ត៌មានដែលទាញបាន។ ពិនិត្យស្ថានភាពប្រភពខាងលើ។</p>}</section>
    </>}
  </section>;
}

function ResearchChart({points}:{points:ResearchPoint[]}) {
  const values=points.map(p=>p.price),min=Math.min(...values),max=Math.max(...values),span=max-min||max*.01||1;
  const x=(i:number)=>50+i/(points.length-1)*850;
  const y=(price:number)=>240-(price-min)/span*190;
  return <figure className="research-chart"><figcaption>ក្រាបតម្លៃដែលទាញបាន / Historical observations · មិនមានខ្សែទស្សន៍ទាយ</figcaption><svg viewBox="0 0 940 290" role="img" aria-label={`Historical price chart from ${values[0]} to ${values.at(-1)}. No forecast.`}>{[0,1,2,3].map(i=><g key={i}><line x1="50" x2="900" y1={50+i*190/3} y2={50+i*190/3}/><text x="8" y={54+i*190/3}>{(max-i*span/3).toLocaleString("en-US",{maximumFractionDigits:3,notation:"compact"})}</text></g>)}<polyline points={points.map((p,i)=>`${x(i)},${y(p.price)}`).join(" ")} fill="none"/><text x="50" y="275">{displayTime(points[0].time)}</text><text x="900" y="275" textAnchor="end">{displayTime(points.at(-1)!.time)} · UTC+7</text></svg></figure>;
}
