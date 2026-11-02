"use client";
import { useEffect, useState } from "react";
import ControlButton from "./ControlButton";
import type { OrbitStory } from "./orbit-stories";
export default function OrbitNewsCard({title,stories,loading,paused,motionPaused,onPause}:{title:string;stories:OrbitStory[];loading:boolean;paused:boolean;motionPaused:boolean;onPause:(paused:boolean)=>void}) {
  const [index,setIndex]=useState(0);
  useEffect(()=>{
    if(paused||motionPaused||stories.length<2)return;
    const media=window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer:ReturnType<typeof setInterval>|undefined;
    const sync=()=>{clearInterval(timer);if(!media.matches)timer=setInterval(()=>setIndex(i=>(i+1)%stories.length),9000);};
    sync();media.addEventListener("change",sync);
    return()=>{clearInterval(timer);media.removeEventListener("change",sync);};
  },[paused,motionPaused,stories.length]);
  const story=stories.length?stories[index%stories.length]:null;
  return <section className="orbit-news-card" aria-label={title} aria-live="off">
    <div className="orbit-news-top"><span>{title}</span><span>{stories.length?index%stories.length+1:0} / {stories.length}</span></div>
    {story?<article key={story.id} className="orbit-news-content"><a className="orbit-news-title" href={story.url} target="_blank" rel="noreferrer">{story.title} ↗</a><p className="orbit-news-time">{story.timeLabel}: <time dateTime={new Date(story.time).toISOString()}>{new Date(story.time).toLocaleString("en-GB",{timeZone:"Asia/Bangkok",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",hour12:false})} · UTC+7</time></p>{story.detail&&<p className="orbit-news-detail">{story.detail}</p>}<p className="orbit-news-source">{story.source}{story.stale?" · Last loaded / refresh failed":""}</p></article>:<p className="orbit-news-empty" role="status">{loading?"កំពុងទាញព័ត៌មាន…":"មិនមានទិន្នន័យដែលទាញបាន។ ចុច Refresh ខាងក្រោម។"}</p>}
    <div className="orbit-news-controls"><ControlButton controlSize="sm" aria-label={`Previous ${title}`} disabled={stories.length<2} onClick={()=>setIndex(i=>(i-1+stories.length)%stories.length)}>←</ControlButton><ControlButton controlSize="sm" aria-pressed={paused} onClick={()=>onPause(!paused)}>{paused?"▶ បន្ត":"Ⅱ ផ្អាក"}</ControlButton><ControlButton controlSize="sm" aria-label={`Next ${title}`} disabled={stories.length<2} onClick={()=>setIndex(i=>(i+1)%stories.length)}>→</ControlButton></div>
  </section>;
}
