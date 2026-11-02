"use client";

import { useEffect, useRef } from "react";
import DesktopExperience from "./DesktopExperience";

/** A projected particle sculpture; no external model, video or WebGL dependency. */
function ParticleSculpture() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0, height = 0, frame = 0, rotation = 0, previous = 0;
    let visible = true;
    const pointer = { x: 0, y: 0 };
    const points = Array.from({ length: 1500 }, (_, i) => {
      const a = i * 2.399963, b = i * .618034;
      const tube = .23 + .045 * Math.sin(a * 3);
      return { x: (1 + tube * Math.cos(b)) * Math.cos(a), y: (1 + tube * Math.cos(b)) * Math.sin(a), z: tube * Math.sin(b), tint: i % 5 };
    });
    function draw(time: number) {
      if (!context || !element) return;
      if (!reduced.matches && visible && !document.hidden) rotation += Math.min(time - (previous || time), 40) * .00016;
      previous = time;
      context.clearRect(0, 0, width, height);
      const mobile = width < 700;
      const cx = width * (mobile ? .52 : .69), cy = height * (mobile ? .48 : .48);
      const size = Math.min(width * (mobile ? .34 : .245), height * .43);
      const angle = rotation + .5 + pointer.x * .22;
      const tilt = .65 + pointer.y * .15;
      const stride = mobile ? 2 : 1;
      for (let i = 0; i < points.length; i += stride) {
        const p = points[i];
        const x = p.x * Math.cos(angle) + p.z * Math.sin(angle);
        const z = -p.x * Math.sin(angle) + p.z * Math.cos(angle);
        const y = p.y * Math.cos(tilt) - z * Math.sin(tilt);
        const depth = p.y * Math.sin(tilt) + z * Math.cos(tilt);
        const perspective = 3.8 / (3.8 - depth);
        const opacity = .22 + (depth + 1.3) / 2.6 * .7;
        context.fillStyle = p.tint ? `rgba(184,166,225,${opacity})` : `rgba(150,140,205,${opacity})`;
        context.beginPath();context.arc(cx + x * size * perspective, cy + y * size * perspective, Math.max(.5, perspective * (mobile ? 1.05 : 1.25)), 0, Math.PI * 2);context.fill();
      }
      // Sparse orbital trails give depth without filling the reading area.
      for (let i = 0; i < 65; i++) {
        const a = i * 2.39996 + rotation * .3;
        const spread = 1.45 + (i % 7) * .13;
        const x = cx + Math.cos(a) * size * spread;
        const y = cy + Math.sin(a) * size * spread * .56;
        context.fillStyle = `rgba(150,155,195,${.15 + (i % 4) * .12})`;
        context.fillRect(x, y, i % 3 === 0 ? 2 : 1, 2);
      }
      if (!reduced.matches && visible && !document.hidden) frame = requestAnimationFrame(draw);
    }
    function restart() { cancelAnimationFrame(frame); previous = 0; draw(performance.now()); }
    const resize = new ResizeObserver(() => {
      width = element.clientWidth; height = element.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
      element.width = Math.round(width * ratio);element.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);restart();
    });
    const intersection = new IntersectionObserver(entries => { visible = entries[0].isIntersecting;restart(); });
    function move(event: PointerEvent) {
      if (event.pointerType !== "mouse" || reduced.matches) return;
      const rect = element!.getBoundingClientRect();pointer.x = (event.clientX - rect.left) / rect.width - .5;pointer.y = (event.clientY - rect.top) / rect.height - .5;
    }
    function leave() { pointer.x = 0; pointer.y = 0; }
    const parent = element.parentElement!;
    parent.addEventListener("pointermove", move);parent.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", restart);reduced.addEventListener("change", restart);
    resize.observe(element);intersection.observe(element);
    return () => { cancelAnimationFrame(frame);resize.disconnect();intersection.disconnect();parent.removeEventListener("pointermove", move);parent.removeEventListener("pointerleave", leave);document.removeEventListener("visibilitychange", restart);reduced.removeEventListener("change", restart); };
  }, []);
  return <canvas ref={canvas} className="home-particles" aria-hidden="true" />;
}

export default function HomeExperience({signedIn=false}:{signedIn?:boolean}) {
  return <div id="home" className="home-experience">
    <DesktopExperience signedIn={signedIn} />
    <header className="home-nav"><a href="#home" className="home-wordmark" aria-label="NR home"><span className="home-logo-mark">NR</span><small>MARKET OBSERVATORY</small></a><nav aria-label="Home navigation"><a href="#home-features" className="home-nav-explore">Explore</a><a href="#account-access" className="home-login">ចូលគណនី <span>↗</span></a></nav></header>
    <section className="cinematic-hero" id="home-mobile" aria-labelledby="home-title">
      <ParticleSculpture/><div className="home-haze" aria-hidden="true"/>
      <div className="home-hero-copy"><p className="home-eyebrow"><span/> YOUR WORLD. YOUR PERSPECTIVE.</p><h1 id="home-title">A NEW<br/>MARKET<br/><em>DIMENSION.</em></h1><p className="home-description">មើលទីផ្សារពីមុំថ្មី។<br/><span>តាមដាន CPI, Forex និង Crypto ក្នុងកន្លែងតែមួយ។</span></p><a href="#account-access" className="home-primary">ចាប់ផ្តើមប្រើប្រាស់ <span>↗</span></a></div>
      <div className="home-orbit-label" aria-hidden="true"><span>01 — CONNECT THE SIGNALS</span><b>CPI / FX / CRYPTO</b><i>Research beyond the headline</i></div>
      <div className="home-hero-bottom"><a href="#home-features">↓ <span>SCROLL TO DISCOVER</span></a><span className="home-device-label"><span className="desktop-label">DESIGNED FOR YOUR DESKTOP</span><span className="phone-label">YOUR MARKET. IN YOUR POCKET.</span></span></div>
    </section>
    <section className="home-features" id="home-features" aria-label="Workspace features"><div className="home-feature-intro"><span className="home-eyebrow">ONE WORKSPACE / EVERY SCREEN</span><h2>Stay curious.<br/><span>See the context.</span></h2><p>ពី Computer ទៅទូរស័ព្ទ — តាមដានទិន្នន័យបានងាយស្រួល។</p></div><a href="#account-access" className="home-feature-card feature-mint"><span>01 / MACRO</span><div className="feature-art art-radar" aria-hidden="true"><i/><i/><i/><b>◎</b></div><h3>Follow the event.</h3><p>ប្រតិទិន CPI និងការប្រៀបធៀបទិន្នន័យ</p><small>Explore CPI radar ↗</small></a><a href="#account-access" className="home-feature-card feature-violet"><span>02 / MARKETS</span><div className="feature-art art-wave" aria-hidden="true">{[25,48,32,70,44,88,60].map((h,i)=><i key={i} style={{height:`${h}%`}}/>)}</div><h3>Read the movement.</h3><p>ក្រាប Crypto និងអត្រាយោង Forex</p><small>Explore market charts ↗</small></a><a href="#account-access" className="home-feature-card feature-blue"><span>03 / RESEARCH</span><div className="feature-art art-chat" aria-hidden="true"><span>?</span><i>sources → context</i></div><h3>Question the noise.</h3><p>ពិនិត្យប្រភព និងសំណួរអំពីទីផ្សារ</p><small>Explore the research desk ↗</small></a></section>
  </div>;
}
