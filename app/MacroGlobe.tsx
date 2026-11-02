"use client";
import {useEffect,useRef,useState} from "react";

export default function MacroGlobe({language}:{language:"km"|"en"}){
  const ref=useRef<HTMLDivElement>(null);
  const [active,setActive]=useState(true);
  const [hovered,setHovered]=useState(false);
  const labels=[
    {title:"FOREX",symbol:"$",description:language==="km"?"គោលនយោបាយ និងអត្រា":"Policy & rates"},
    {title:"CRYPTO",symbol:"₿",description:language==="km"?"ហានិភ័យ និងសាច់ប្រាក់":"Risk & liquidity"},
    {title:"CPI",symbol:"◎",description:language==="km"?"តាមដានអតិផរណា":"Inflation watch"},
  ];
  useEffect(()=>{
    let visible=true;
    const update=()=>setActive(visible&&!document.hidden);
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;update();});
    if(ref.current)observer.observe(ref.current);
    document.addEventListener("visibilitychange",update);update();
    return()=>{observer.disconnect();document.removeEventListener("visibilitychange",update);};
  },[]);
  return <div ref={ref} className={`macro-cosmic-scene ${!active||hovered?"is-paused":""}`} role="group" aria-label="CPI, Forex and crypto context">
    <svg viewBox="0 0 420 420" aria-hidden="true">
      <g className="macro-cosmic-stars" fill="#d8ecff">{Array.from({length:45},(_,i)=><circle key={i} cx={(i*79+11)%420} cy={(i*i*31+17)%420} r={i%7===0?1.3:.65} opacity={.2+(i%5)*.12}/>)}</g>
      <g fill="none" stroke="#65aff5" strokeWidth=".8" opacity=".55"><circle cx="210" cy="210" r="155"/><ellipse cx="210" cy="210" rx="185" ry="115" transform="rotate(-25 210 210)"/><ellipse cx="210" cy="210" rx="185" ry="115" transform="rotate(35 210 210)"/></g>
      <circle cx="210" cy="210" r="104" fill="#0b3d91" opacity=".7"/>
      <image className="macro-earth-image" href="/images/market-earth-digital-v1.png" x="90" y="90" width="240" height="240" preserveAspectRatio="xMidYMid meet"/>
      <text x="210" y="395" textAnchor="middle" className="macro-cosmic-caption">CPI · FOREX · CRYPTO</text>
    </svg>
    {labels.map((label,i)=><div key={label.title} className={`macro-context-orbit macro-context-phase-${i}`}>
      <div className="macro-context-anchor"><div className="macro-context-upright" onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}>
        <span className="macro-context-galaxy" aria-hidden="true"/>
        <div className="macro-context-label"><strong><span aria-hidden="true">{label.symbol}</span> {label.title}</strong><p>{label.description}</p></div>
      </div></div>
    </div>)}
  </div>;
}
