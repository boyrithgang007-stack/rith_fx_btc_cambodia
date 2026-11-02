"use client";
import {useEffect,useState} from "react";
import type {NewsHeadline} from "./lib/bloomberg";
export default function BloombergNews({language}:{language:"km"|"en"}){
  const km=language==="km";
  const [data,setData]=useState<{headlines:NewsHeadline[];checkedAt:number}|null>(null);
  const [error,setError]=useState(false),[loading,setLoading]=useState(true),[request,setRequest]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    async function load(){try{
      const response=await fetch("/api/news",{signal:controller.signal});const payload=await response.json();
      if(!response.ok||!Array.isArray(payload.headlines)||!Number.isFinite(payload.checkedAt))throw Error();
      if(!controller.signal.aborted){setData(payload);setError(false);}
    }catch{if(!controller.signal.aborted)setError(true);}finally{if(!controller.signal.aborted)setLoading(false);}}
    void load();const timer=window.setInterval(()=>void load(),600_000);
    return()=>{controller.abort();window.clearInterval(timer);};
  },[request]);
  const date=(value:string|number)=>new Date(value).toLocaleString(km?"km-KH":"en-GB",{timeZone:"Asia/Bangkok",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",hour12:false});
  return <section className="welcome-news" id="economic-news" aria-labelledby="economic-news-title">
    <div className="welcome-section-label"><span>03 / ECONOMIC NEWS</span><a href="https://www.bloomberg.com/economics" target="_blank" rel="noreferrer">Bloomberg Economics ↗</a></div>
    <div className="welcome-news-heading"><div><p className="welcome-kicker">GLOBAL ECONOMY / ORIGINAL HEADLINES</p><h2 id="economic-news-title">{km?"ព័ត៌មានសេដ្ឋកិច្ច":"Economic news"}</h2></div><button type="button" disabled={loading} onClick={()=>{setLoading(true);setRequest(value=>value+1);}}>↻ {km?"ធ្វើបច្ចុប្បន្នភាព":"Refresh"}</button></div>
    {loading&&!data&&<p role="status" className="welcome-news-status">{km?"កំពុងទាញព័ត៌មានពី Bloomberg…":"Loading Bloomberg headlines…"}</p>}
    {error&&<p role="status" className="welcome-news-status">{km?"មិនអាចទាញព័ត៌មានថ្មីបានឥឡូវនេះ។ សូមសាកល្បងម្ដងទៀត ឬបើក Bloomberg។":"Headlines could not be refreshed. Retry or open Bloomberg."} {data&&(km?"កំពុងបង្ហាញទិន្នន័យដែលទាញបានចុងក្រោយ។":"Showing last loaded headlines.")}</p>}
    {data&&<><div className="welcome-news-grid">{data.headlines.map((item,index)=><a key={item.url} href={item.url} target="_blank" rel="noreferrer" className="welcome-news-card"><span className="welcome-news-index">0{index+1} / BLOOMBERG</span><h3 lang="en">{item.title}</h3><div><time dateTime={item.publishedAt}>{date(item.publishedAt)} · UTC+7</time><span aria-hidden="true">↗</span></div></a>)}</div><p className="welcome-news-meta">{km?"បានពិនិត្យ":"Checked"}: {date(data.checkedAt)} · UTC+7 · {km?"Refresh រៀងរាល់ ១០ នាទី":"10-minute refresh"}</p></>}
    <p className="welcome-news-meta">{km?"ចំណងជើងដើមពី Bloomberg RSS។ អត្ថបទពេញអាននៅ Bloomberg; អត្ថបទខ្លះអាចត្រូវការជាវ។":"Original headlines from Bloomberg RSS. Read full articles at Bloomberg; some may require a subscription."}</p>
  </section>;
}
