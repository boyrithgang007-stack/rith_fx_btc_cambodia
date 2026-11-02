import type { MacroData } from "./lib/macro";
import type { NewsHeadline } from "./lib/bloomberg";

export type OrbitStory = { id:string; category:string; title:string; time:number; timeLabel:string; source:string; url:string; detail?:string; stale:boolean };

/** Interleave actual source items; a missing feed never becomes an invented headline. */
export function buildOrbitStories(macro:MacroData|null, headlines:NewsHeadline[], errors:{macro:boolean;news:boolean}):OrbitStory[] {
  const cpi:OrbitStory[]=[];
  const official=macro?.events.filter(e=>Number.isFinite(e.time)&&e.time>=macro.checkedAt).sort((a,b)=>a.time-b.time)[0];
  if(official)cpi.push({id:`bls:${official.time}`,category:"CPI / SCHEDULE",title:official.title,time:official.time,timeLabel:"Scheduled",source:"BLS · US CPI",url:"https://www.bls.gov/schedule/news_release/cpi.htm",stale:errors.macro});
  for(const e of [...(macro?.forexFactory?.events??[])].filter(e=>e.isCpi&&Number.isFinite(e.time)).sort((a,b)=>a.time-b.time).slice(0,4)) {
    cpi.push({id:`ff:${e.id}`,category:"CPI / WEEKLY CALENDAR",title:`${e.currency} · ${e.title}`,time:e.time,timeLabel:"Event time",source:"Forex Factory",url:"https://www.forexfactory.com/calendar",detail:`Actual ${e.actual??"—"} · Forecast ${e.forecast??"—"} · Previous ${e.previous??"—"}`,stale:errors.macro||macro?.forexFactory?.status!=="connected"});
  }
  const seen=new Set<string>();
  const news:OrbitStory[]=headlines.flatMap(item=>{
    try {
      const url=new URL(item.url),time=Date.parse(item.publishedAt);
      if(!Number.isFinite(time)||!item.title.trim()||url.protocol!=="https:"||!["bloomberg.com","www.bloomberg.com"].includes(url.hostname)||url.username||url.password||seen.has(url.href))return [];
      seen.add(url.href);
      return [{id:url.href,category:"ECONOMIC NEWS",title:item.title,time,timeLabel:"Published",source:"Bloomberg",url:url.href,stale:errors.news}];
    }catch{return [];}
  }).sort((a,b)=>b.time-a.time).slice(0,6);
  const stories:OrbitStory[]=[];
  for(let i=0;i<Math.max(cpi.length,news.length);i++){if(cpi[i])stories.push(cpi[i]);if(news[i])stories.push(news[i]);}
  return stories;
}
