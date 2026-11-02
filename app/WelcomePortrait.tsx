"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Image from "next/image";
import { portraitOrbitPoint } from "./portrait-orbit";

const ORIGINAL_VISIBLE_BOUNDS = { left: 135 / 1024, right: 924 / 1024, top: 37 / 1536 };
const TRANSFORMED_VISIBLE_BOUNDS = { left: 13 / 604, right: 592 / 604, top: 13 / 725 };

export default function WelcomePortrait() {
  const host = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLCanvasElement>(null);
  const front = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(0);
  const [fullTransform, setFullTransform] = useState(false);
  function trackTransformPointer(event: ReactPointerEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const scale = Number.parseFloat(getComputedStyle(event.currentTarget).getPropertyValue("--transform-scale")) || 1;
    const offsetX = Number.parseFloat(getComputedStyle(event.currentTarget).getPropertyValue("--transform-offset-x")) || 0;
    const offsetY = Number.parseFloat(getComputedStyle(event.currentTarget).getPropertyValue("--transform-offset-y")) || 0;
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    event.currentTarget.style.setProperty("--original-transform-x", `${x}px`);
    event.currentTarget.style.setProperty("--original-transform-y", `${y}px`);
    event.currentTarget.style.setProperty("--transform-x", `${(x - bounds.width / 2 - offsetX) / scale + bounds.width / 2}px`);
    event.currentTarget.style.setProperty("--transform-y", `${(y - offsetY) / scale}px`);
    event.currentTarget.dataset.transforming = "true";
  }
  function clearTransformPointer(event: ReactPointerEvent<HTMLButtonElement>) {
    event.currentTarget.dataset.transforming = "false";
  }
  useEffect(() => {
    const node = host.current, rear = back.current, fore = front.current;
    if (!node || !rear || !fore) return;
    const b = rear.getContext("2d"), f = fore.getContext("2d");
    if (!b || !f) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = true, frame = 0, phase = phaseRef.current, last = 0;
    const person = node.querySelector<HTMLButtonElement>(".welcome-portrait-person");
    const images = person?.querySelectorAll<HTMLImageElement>("img");
    function syncCharacterSize() {
      const original = images?.[0], transformed = images?.[1];
      if (!person || !original?.naturalWidth || !transformed?.naturalWidth) return;
      const width = person.clientWidth, height = person.clientHeight;
      const originalFit = Math.min(width / original.naturalWidth, height / original.naturalHeight);
      const transformedFit = Math.min(width / transformed.naturalWidth, height / transformed.naturalHeight);
      const originalHeight = original.naturalHeight * originalFit;
      const transformedHeight = transformed.naturalHeight * transformedFit;
      const scale = originalHeight / transformedHeight;
      const originalWidth = original.naturalWidth * originalFit;
      const transformedWidth = transformed.naturalWidth * transformedFit;
      const originalCenterX = width / 2 + ((ORIGINAL_VISIBLE_BOUNDS.left + ORIGINAL_VISIBLE_BOUNDS.right) / 2 - 0.5) * originalWidth;
      const transformedCenterX = width / 2 + ((TRANSFORMED_VISIBLE_BOUNDS.left + TRANSFORMED_VISIBLE_BOUNDS.right) / 2 - 0.5) * transformedWidth * scale;
      const originalTop = height - originalHeight + ORIGINAL_VISIBLE_BOUNDS.top * originalHeight;
      const transformedTop = (height - transformedHeight + TRANSFORMED_VISIBLE_BOUNDS.top * transformedHeight) * scale;
      person.style.setProperty("--transform-scale", String(scale));
      person.style.setProperty("--transform-offset-x", `${originalCenterX - transformedCenterX - width * 0.15}px`);
      person.style.setProperty("--transform-offset-y", `${originalTop - transformedTop}px`);
    }
    images?.forEach((image) => image.addEventListener("load", syncCharacterSize));
    const styles = getComputedStyle(node);
    const orbitColors = ["--orbit-cyan", "--orbit-blue", "--orbit-purple", "--orbit-pink"]
      .map((name) => styles.getPropertyValue(name).trim());
    const orbitGlow = styles.getPropertyValue("--orbit-glow").trim();
    const guardianOrbitColors = ["#9ab2c9", "#dce4ec", "#657b94", "#c5a873"];
    const guardianOrbitGlow = "#8eaac5";
    const noise = (seed: number) => {
      const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
      return value - Math.floor(value);
    };
    const particleCount = window.matchMedia("(max-width: 650px)").matches ? 560 : 900;
    const particles = Array.from({ length: particleCount }, (_, index) => ({
      u: (index + noise(index * 3 + 1) * 0.7) / particleCount,
      v: noise(index * 3 + 2),
      size: 0.45 + noise(index * 3 + 3) * 0.8,
      glow: index % 43 === 0,
    }));
    function point(u: number, v: number) {
      return portraitOrbitPoint(u, v, phase);
    }
    function draw() {
      if (!node || !rear || !fore || !b || !f) return;
      const width=node.clientWidth, height=node.clientHeight, ratio=Math.min(window.devicePixelRatio||1,1.5);
      for (const canvas of [rear,fore]) {
        if (canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)) {
          canvas.width=Math.round(width*ratio); canvas.height=Math.round(height*ratio);
        }
      }
      for (const context of [b,f]) {
        context.setTransform(1,0,0,1,0,0); context.clearRect(0,0,rear.width,rear.height);
        context.setTransform(width*ratio/600,0,0,height*ratio/740,0,0);
      }
      const palette = fullTransform ? guardianOrbitColors : orbitColors;
      const glow = fullTransform ? guardianOrbitGlow : orbitGlow;
      for (const [index, particle] of particles.entries()) {
        const location = point(particle.u, particle.v);
        const context = location.z > 0 ? f : b;
        const band = Math.sin(particle.u * Math.PI * 12 + Math.sin(particle.v * Math.PI * 4) * 2 + phase * 0.35);
        const color=palette[band>.55?2:band<-.55?3:band>.1?1:0];
        context.fillStyle=color;
        context.globalAlpha = (location.z > 0 ? 0.78 : 0.35) * (0.72 + Math.sin(phase * 2 + index) * 0.18);
        context.shadowColor = color;
        context.shadowBlur = fullTransform ? 0 : particle.glow ? 7 : 0;
        context.beginPath();
        context.arc(location.x, location.y, particle.size, 0, Math.PI * 2);
        context.fill();
        context.shadowBlur = 0;
      }
      if (fullTransform) {
        for (const [radiusX, radiusY, rotation] of [[268, 96, -0.08], [255, 87, 0.1]]) {
          for (let i = 0; i < 180; i++) {
            const start = i / 180 * Math.PI * 2 + phase * 0.035;
            const end = (i + 1) / 180 * Math.PI * 2 + phase * 0.035;
            const context = Math.sin((start + end) / 2) > 0 ? f : b;
            context.save();
            context.translate(300, 365);
            context.rotate(rotation);
            context.beginPath();
            context.ellipse(0, 0, radiusX, radiusY, 0, start, end);
            context.strokeStyle = guardianOrbitColors[i % 4];
            context.globalAlpha = 0.38;
            context.lineWidth = i % 12 === 0 ? 1.15 : 0.55;
            context.stroke();
            context.restore();
          }
        }
      }
      const drawPlanet = (
        u: number,
        v: number,
        radius: number,
        kind: "earth" | "violet" | "rose" | "ice",
        spinSpeed: number,
        spinOffset: number,
      ) => {
        const location = point(u, v), context = location.z > 0 ? f : b;
        context.save();
        context.globalAlpha = 1;
        context.translate(location.x, location.y);
        const colors = fullTransform ? ["#f0e2c5", "#8796a7", "#263342"]
          : kind === "earth" ? ["#a9f6ff", "#1687d5", "#092a64"]
          : kind === "violet" ? ["#f2d5ff", "#9a57dc", "#40215f"]
          : kind === "rose" ? ["#ffe0ce", "#e77865", "#6b3446"]
          : ["#ecfcff", "#81bcd4", "#365375"];
        const sphere = context.createRadialGradient(-radius * 0.38, -radius * 0.42, radius * 0.08, 0, 0, radius);
        sphere.addColorStop(0, colors[0]);
        sphere.addColorStop(0.58, colors[1]);
        sphere.addColorStop(1, colors[2]);
        context.shadowColor = glow;
        context.shadowBlur = radius * 1.35;
        context.beginPath();
        context.arc(0, 0, radius, 0, Math.PI * 2);
        context.fillStyle = sphere;
        context.fill();
        context.shadowBlur = 0;

        context.save();
        context.beginPath();
        context.arc(0, 0, radius * 0.94, 0, Math.PI * 2);
        context.clip();
        context.rotate(phase * spinSpeed + spinOffset);
        if (kind === "earth") {
          context.fillStyle = fullTransform ? "#c4ab76" : "#72e5b3";
          context.beginPath();
          context.ellipse(-radius * 0.23, -radius * 0.12, radius * 0.24, radius * 0.4, -0.48, 0, Math.PI * 2);
          context.fill();
          context.beginPath();
          context.ellipse(radius * 0.31, radius * 0.25, radius * 0.16, radius * 0.28, 0.36, 0, Math.PI * 2);
          context.fill();
          context.strokeStyle = fullTransform ? "#f0e2c580" : "#e9ffff80";
          context.lineWidth = Math.max(1, radius * 0.08);
          context.beginPath();
          context.ellipse(-radius * 0.48, radius * 0.48, radius * 0.5, radius * 0.13, -0.25, 0, Math.PI * 2);
          context.stroke();
        } else if (kind === "violet") {
          context.strokeStyle = fullTransform ? "#e1c892" : "#e8c9ff99";
          context.lineWidth = Math.max(1, radius * 0.09);
          context.beginPath();
          context.ellipse(radius * 0.12, -radius * 0.18, radius * 0.68, radius * 0.28, -0.45, 0.2, Math.PI * 1.6);
          context.stroke();
          context.fillStyle = fullTransform ? "#f0e2c5" : "#f4d7ff";
          context.beginPath();
          context.ellipse(-radius * 0.36, radius * 0.22, radius * 0.12, radius * 0.07, 0.4, 0, Math.PI * 2);
          context.fill();
        } else {
          context.strokeStyle = fullTransform ? "#d9c59a" : kind === "rose" ? "#ffd9a780" : "#e8fbff80";
          context.lineWidth = Math.max(1, radius * 0.1);
          for (const band of [-0.38, 0.05, 0.42]) {
            context.beginPath();
            context.ellipse(0, radius * band, radius * 0.92, radius * 0.18, 0, 0.12, Math.PI - 0.12);
            context.stroke();
          }
        }
        context.restore();
        if (kind === "rose") {
          context.save();
          context.rotate(phase * spinSpeed + spinOffset);
          context.strokeStyle = fullTransform ? "#d7c292" : "#f1ca8c";
          context.lineWidth = 1.5;
          context.beginPath();
          context.ellipse(0, 0, radius * 1.65, radius * 0.38, -0.3, 0, Math.PI * 2);
          context.stroke();
          context.restore();
        }
        context.strokeStyle = "#eafaff99";
        context.lineWidth = 0.7;
        context.beginPath();
        context.arc(0, 0, radius, 0, Math.PI * 2);
        context.stroke();
        context.restore();
      };
      drawPlanet(0.29, 0.12, 25, "earth", 1.4, 0);
      drawPlanet(0.58, 0.88, 16, "violet", -1.8, 1.2);
      drawPlanet(0.79, 0.12, 14, "rose", 1.1, 2.4);
      drawPlanet(0.94, 0.88, 12, "ice", -1.35, 0.7);
      const satellite = point(0.08, 0), context = satellite.z > 0 ? f : b;
      const satelliteGlow = context.createRadialGradient(satellite.x - 2, satellite.y - 2, 0.5, satellite.x, satellite.y, 5);
      satelliteGlow.addColorStop(0, fullTransform ? "#fff0ce" : "#e5ffff");
      satelliteGlow.addColorStop(0.45, palette[1]);
      satelliteGlow.addColorStop(1, fullTransform ? "#453927" : "#173d70");
      context.beginPath();
      context.arc(satellite.x, satellite.y, 5, 0, Math.PI * 2);
      context.fillStyle = satelliteGlow;
      context.shadowColor = glow;
      context.shadowBlur = fullTransform ? 3 : 10;
      context.fill();
      context.shadowBlur = 0;
      for (const context of [b, f]) context.globalAlpha=1;
    }
    function tick(now:number) {
      frame=0; if(last)phase+=Math.min(now-last,50)*.0005; last=now; draw();
      if(!motion.matches&&visible&&!document.hidden)frame=requestAnimationFrame(tick);
    }
    function sync() {
      cancelAnimationFrame(frame); frame=0; last=0; syncCharacterSize(); draw();
      if (node) node.dataset.running = String(!motion.matches && visible && !document.hidden);
      if(!motion.matches&&visible&&!document.hidden)frame=requestAnimationFrame(tick);
    }
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();});
    const resize=new ResizeObserver(sync);
    observer.observe(node); resize.observe(node);
    motion.addEventListener("change",sync); document.addEventListener("visibilitychange",sync); sync();
    return ()=>{phaseRef.current=phase;cancelAnimationFrame(frame);observer.disconnect();resize.disconnect();images?.forEach((image) => image.removeEventListener("load", syncCharacterSize));motion.removeEventListener("change",sync);document.removeEventListener("visibilitychange",sync);};
  },[fullTransform]);
  return <div ref={host} className="welcome-portrait">
    <div className="welcome-portrait-halo" aria-hidden="true"/>
    <canvas ref={back} className="welcome-ribbon welcome-ribbon-back" aria-hidden="true"/>
    <button
      type="button"
      className="welcome-portrait-person"
      data-full-transform={fullTransform}
      aria-pressed={fullTransform}
      aria-label={fullTransform ? "Return to the original portrait" : "Show the complete transformation"}
      onClick={() => setFullTransform((current) => !current)}
      onPointerEnter={trackTransformPointer}
      onPointerMove={trackTransformPointer}
      onPointerLeave={clearTransformPointer}
    >
      <Image src="/images/rith-welcome-cutout.png" alt="RITH wearing a black suit" fill sizes="(max-width:650px) 95vw, 52vw" priority className="welcome-cutout"/>
      <Image src="/images/rith-transformation-cutout.png" alt="" aria-hidden="true" fill sizes="(max-width:650px) 95vw, 52vw" className="welcome-transformed-cutout"/>
    </button>
    <canvas ref={front} className="welcome-ribbon welcome-ribbon-front" aria-hidden="true"/>
    <span className="welcome-portrait-index" aria-hidden="true">01 — RITH / CAMBODIA</span>
  </div>;
}
