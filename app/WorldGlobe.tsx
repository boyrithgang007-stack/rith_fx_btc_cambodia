"use client";
import { useEffect, useId, useRef, useState } from "react";
import OrbitNewsCard from "./OrbitNewsCard";
import type { OrbitStory } from "./orbit-stories";
import type { GalaxyQuote } from "./galaxy-quotes";
import { dualNewsOrbit, galaxyOrbit } from "./news-orbit";

export default function WorldGlobe({ stories = [], loading = false, quotes = [] }: { stories?:OrbitStory[]; loading?:boolean; quotes?:GalaxyQuote[] }) {
  const id=useId().replaceAll(":","");
  const ref=useRef<HTMLDivElement>(null);
  const carriers=useRef<(HTMLDivElement|null)[]>([]);
  const nodes=useRef<(SVGCircleElement|null)[]>([]);
  const wires=useRef<(SVGLineElement|null)[]>([]);
  const tracks=useRef<(SVGEllipseElement|null)[]>([]);
  const galaxies=useRef<(HTMLDivElement|null)[]>([]);
  const phase=useRef(Math.PI/2);
  const [active,setActive]=useState(true),[hovered,setHovered]=useState(false),[focused,setFocused]=useState(false),[tickerPaused,setTickerPaused]=useState(false);
  const stopped=!active||hovered||focused||tickerPaused;
  const groups=[stories.filter(s=>s.source!=="Bloomberg"),stories.filter(s=>s.source==="Bloomberg")];
  useEffect(()=>{
    const scene=ref.current;
    if(!scene)return;
    const media=window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame=0,last:number|null=null,width=scene.clientWidth,height=scene.clientHeight;
    let sizes=carriers.current.map(card=>({width:card?.offsetWidth??280,height:card?.offsetHeight??240}));
    const paint=()=>{
      const positions=dualNewsOrbit(width,height,sizes,phase.current);
      positions.forEach((p,i)=>{
        const card=carriers.current[i];if(card)card.style.transform=`translate3d(${p.left}px,${p.top}px,0)`;
        nodes.current[i]?.setAttribute("cx",String(p.nodeX));nodes.current[i]?.setAttribute("cy",String(p.nodeY));
        wires.current[i]?.setAttribute("x1",String(p.nodeX));wires.current[i]?.setAttribute("y1",String(p.nodeY));
        wires.current[i]?.setAttribute("x2",String(p.targetX));wires.current[i]?.setAttribute("y2",String(p.targetY));
        for(const key of ["cx","cy","rx","ry"] as const)tracks.current[i]?.setAttribute(key,String(p[key]));
      });
      galaxies.current.forEach((element,i)=>{if(element){const p=galaxyOrbit(width,height,phase.current*1.4,i,element.offsetWidth,element.offsetHeight);element.style.transform=`translate3d(${p.left}px,${p.top}px,0)`;}});
    };
    const tick=(now:number)=>{if(last!==null)phase.current+=Math.min(now-last,50)/58000*Math.PI*2;last=now;paint();frame=requestAnimationFrame(tick);};
    const sync=()=>{cancelAnimationFrame(frame);last=null;paint();if(!stopped&&!media.matches)frame=requestAnimationFrame(tick);};
    const resize=new ResizeObserver(()=>{sizes=carriers.current.map(card=>({width:card?.offsetWidth??280,height:card?.offsetHeight??240}));scene.style.minHeight=`${sizes.reduce((sum,s)=>sum+s.height,0)+80}px`;width=scene.clientWidth;height=scene.clientHeight;paint();});
    resize.observe(scene);carriers.current.forEach(card=>{if(card)resize.observe(card);});media.addEventListener("change",sync);sync();
    return()=>{cancelAnimationFrame(frame);resize.disconnect();media.removeEventListener("change",sync);};
  },[stopped,quotes.length]);
  useEffect(()=>{
    let visible=true;const update=()=>setActive(visible&&!document.hidden);
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;update();});
    if(ref.current)observer.observe(ref.current);document.addEventListener("visibilitychange",update);update();
    return()=>{observer.disconnect();document.removeEventListener("visibilitychange",update);};
  },[]);
  return <><div ref={ref} className={`world-globe world-news-scene world-multi-orbit ${stopped?"is-paused":""}`}>
    <svg className="world-starfield" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
      {[0,1].map(layer=><g className={`star-layer star-layer-${layer}`} key={layer}>{Array.from({length:80},(_,i)=>{
        const seed=i+layer*80;
        return <circle key={seed} cx={(seed*73+17)%1000} cy={(seed*seed*37+29)%600} r={seed%13===0?1.5:seed%3===0?.9:.55} fill={seed%5===0?"#7fe7d6":"#e8f6ff"} opacity={.25+(seed%6)*.1}/>;
      })}</g>)}
      <g className="star-crosses" fill="none" stroke="#b8dbff" strokeWidth=".7" opacity=".55"><path d="M120 83v10m-5-5h10M861 112v12m-6-6h12M738 509v10m-5-5h10M240 482v8m-4-4h8"/></g>
    </svg>
    <svg viewBox="0 0 640 440" role="img" aria-label="Animated globe with an orbit connected to the sourced CPI and economic news card.">
      <defs>
        <radialGradient id={`${id}-ocean`} cx="32%" cy="25%"><stop stopColor="#3ba7f2"/><stop offset=".65" stopColor="#0b3d91"/><stop offset="1" stopColor="#071a36"/></radialGradient>
        <radialGradient id={`${id}-halo`}><stop stopColor="#3ba7f2" stopOpacity=".22"/><stop offset="1" stopColor="#3ba7f2" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="320" cy="216" r="211" fill={`url(#${id}-halo)`}/>
      <g className="world-orbits" fill="none" stroke="currentColor" strokeWidth="1">
        <ellipse cx="320" cy="216" rx="242" ry="76" transform="rotate(-24 320 216)"/>
        <ellipse cx="320" cy="216" rx="215" ry="104" transform="rotate(38 320 216)"/>
        <circle cx="100" cy="204" r="5" fill="currentColor"/>
        <circle cx="514" cy="278" r="4" fill="currentColor"/>
      </g>
      <circle cx="320" cy="216" r="146" fill={`url(#${id}-ocean)`} stroke="#3ba7f2" strokeWidth="1.5"/>
      <image className="world-earth-bitmap" href="/images/market-earth-digital-v1.png" x="148" y="44" width="344" height="344" preserveAspectRatio="xMidYMid meet" />
      <g className="world-network-sparks" fill="#7fe7d6" aria-hidden="true">{Array.from({length:16},(_,i)=><circle key={i} cx={320+Math.cos(i*2.4)*174} cy={216+Math.sin(i*2.4)*160} r={i%3===0?2:1}/>)}</g>
      <text x="320" y="28" textAnchor="middle" className="world-globe-label">GLOBAL CONTEXT · CPI / ECONOMIC NEWS</text>
    </svg>
    <svg className="news-orbit-overlay" aria-hidden="true">{[0,1].map(i=><g key={i} className={i?"orbit-track-news":"orbit-track-cpi"}><ellipse ref={el=>{tracks.current[i]=el;}} className="news-satellite-track"/><line ref={el=>{wires.current[i]=el;}} className="news-satellite-wire"/><circle ref={el=>{nodes.current[i]=el;}} r="5" className="news-satellite-node"/></g>)}</svg>
    {groups.map((items,i)=><div key={i} ref={el=>{carriers.current[i]=el;}} className={`orbit-news-carrier ${i?"news-carrier-world":"news-carrier-cpi"}`}
      onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocusCapture={()=>setFocused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setFocused(false);}}>
      <OrbitNewsCard title={i?"WORLD ECONOMIC NEWS":"CPI / INFLATION"} stories={items} loading={loading} paused={tickerPaused} motionPaused={stopped} onPause={setTickerPaused}/>
    </div>)}
    {quotes.map((quote,i)=><div key={quote.id} ref={el=>{galaxies.current[i]=el;}} className={`market-galaxy galaxy-${quote.id}`} onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}>
      <span className="galaxy-spiral" aria-hidden="true"/>
      <div className="galaxy-price"><span>{quote.name}</span><strong>{quote.price===null?"?":quote.price.toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2})}</strong><small>{quote.unit}</small></div>
    </div>)}
  </div>
    <div className="galaxy-quote-ledger">{quotes.map(quote=><div key={quote.id}><b>{quote.name}</b><strong>{quote.price===null?"?":quote.price.toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2})} <small>{quote.unit}</small></strong><small>{quote.source}{quote.stale?" ? Last available / refresh failed":""}</small><small>{quote.asOf?quote.timeLabel+" "+new Date(quote.asOf).toLocaleString("en-GB",{timeZone:"Asia/Bangkok",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",hour12:false})+" ? UTC+7":"Timestamp unavailable"}</small></div>)}<p>Reference quotes may be delayed. World economic news currently uses Bloomberg; CPI uses BLS and Forex Factory.</p></div>
  </>;
}
