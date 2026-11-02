"use client";

import { useRef } from "react";

export default function ImmersiveScene() {
  const scene = useRef<HTMLDivElement>(null);
  return <div className="depth-experience">
    <div ref={scene} className="depth-scene" onPointerMove={event => {
      if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      scene.current?.style.setProperty("--turn-x", `${-(event.clientY - bounds.top - bounds.height / 2) / bounds.height * 12}deg`);
      scene.current?.style.setProperty("--turn-y", `${(event.clientX - bounds.left - bounds.width / 2) / bounds.width * 16}deg`);
    }} onPointerLeave={() => { scene.current?.style.setProperty("--turn-x", "0deg"); scene.current?.style.setProperty("--turn-y", "0deg"); }} aria-hidden="true">
      <div className="depth-grid"/><div className="depth-world">
        <div className="depth-halo halo-a"/><div className="depth-halo halo-b"/>
        <div className="depth-core"><span>NR</span><strong>Beyond<br/>the numbers.</strong><i>MARKET INTELLIGENCE</i></div>
        <div className="depth-tile tile-cpi"><span>◎</span><div><small>MACRO RADAR</small><b>CPI insights</b></div></div>
        <div className="depth-tile tile-fx"><span>↗</span><div><small>GLOBAL MARKETS</small><b>Forex & Crypto</b></div></div>
        <div className="depth-bars">{[32,56,40,76,61,95,82].map((height,i) => <i key={i} style={{height:`${height}%`}}/>)}</div>
        <span className="depth-spark spark-a"/><span className="depth-spark spark-b"/><span className="depth-spark spark-c"/>
      </div>
    </div>
    <div className="depth-caption"><span>EXPLORE A NEW PERSPECTIVE</span></div>
  </div>;
}
