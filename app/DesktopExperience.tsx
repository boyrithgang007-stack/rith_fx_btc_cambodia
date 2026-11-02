"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// Original procedural artwork: a lit torus and an orbiting particle field.
// Geometry stays on the GPU; only time, pointer and scroll uniforms change.
function SpatialArtwork({ progress }: {progress:React.RefObject<number>}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const [available,setAvailable]=useState(false);
  useEffect(()=>{
    const el=canvas.current;if(!el)return;
    const gl=el.getContext("webgl",{alpha:true,antialias:true,powerPreference:"low-power"});
    if(!gl)return;
    const vertex=`
      attribute vec3 aPosition; attribute vec3 aNormal;
      uniform float uTime,uProgress,uParticles,uAspect,uPixelRatio;
      uniform vec2 uPointer;
      varying vec3 vNormal,vPosition; varying float vSeed;
      mat3 turnY(float a){return mat3(cos(a),0.,-sin(a),0.,1.,0.,sin(a),0.,cos(a));}
      mat3 turnX(float a){return mat3(1.,0.,0.,0.,cos(a),sin(a),0.,-sin(a),cos(a));}
      void main(){
        float gallery=smoothstep(.2,.9,uProgress);
        float portal=smoothstep(1.2,1.95,uProgress);
        vec3 p=aPosition;
        mat3 rotation=turnY(.62+uPointer.x*.18+sin(uTime*.22)*.1+gallery*1.2-portal*.85)*turnX(.22+uPointer.y*.14+sin(uTime*.16)*.07);
        if(uParticles>.5){
          float phase=atan(p.y,p.x)+uTime*.07;
          float r=length(p.xy);
          p.xy=vec2(cos(phase),sin(phase))*r;
          p.x+=sin(p.y*2.+uTime*.35)*gallery*.45;
          p.z+=sin(p.x*2.+uTime*.3)*gallery*.55;
        }
        p=rotation*p;
        p*=1.+portal*.95;
        p.x+=.78*(1.-gallery)+sin(uTime*.12)*gallery*.15;
        p.z-=5.1+gallery*1.1-portal*2.4;
        vNormal=rotation*aNormal;vPosition=p;vSeed=dot(aPosition,vec3(4.2,2.1,5.7));
        gl_Position=vec4(p.x*1.8/uAspect,p.y*1.8,-1.004*p.z-.2004,-p.z);
        gl_PointSize=clamp((1.5+fract(vSeed*12.3)*2.7)*uPixelRatio*3./(-p.z),.6,7.);
      }`;
    const fragment=`
      precision mediump float;
      uniform float uTime,uProgress,uParticles;
      varying vec3 vNormal,vPosition;varying float vSeed;
      void main(){
        vec3 mint=vec3(.72,.66,.94),violet=vec3(.58,.55,.83);
        vec3 hue=mix(mint,violet,smoothstep(.35,1.,uProgress)*(.5+.5*sin(vSeed*.2)));
        if(uParticles>.5){
          float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
          float alpha=pow(1.-r,1.4)*(.2+.65*fract(vSeed*2.7));
          gl_FragColor=vec4(hue,alpha);return;
        }
        vec3 n=normalize(vNormal),view=normalize(-vPosition);
        float diffuse=max(dot(n,normalize(vec3(-.7,1.,2.))),0.);
        float rim=pow(1.-abs(dot(n,view)),2.);
        float spec=pow(max(dot(reflect(-normalize(vec3(-1.,2.,3.)),n),view),0.),45.);
        float band=.5+.5*sin(n.y*13.+n.x*7.+uTime*.14);
        vec3 color=hue*(.14+diffuse*.55)+vec3(.98,.96,1.)*rim*.8+spec*.95+band*.07;
        gl_FragColor=vec4(color,.97);
      }`;
    const shaders:WebGLShader[]=[];
    const compile=(kind:number,source:string)=>{const shader=gl.createShader(kind);if(!shader)return null;shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);return gl.getShaderParameter(shader,gl.COMPILE_STATUS)?shader:null;};
    const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);
    const program=gl.createProgram();
    if(!vs||!fs||!program){shaders.forEach(s=>gl.deleteShader(s));if(program)gl.deleteProgram(program);return;}
    gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)){shaders.forEach(s=>gl.deleteShader(s));gl.deleteProgram(program);return;}
    const mesh:number[]=[],particles:number[]=[];
    function point(u:number,v:number){const tube=.12+.012*Math.sin(u*5);return [(1.17+tube*Math.cos(v))*Math.cos(u),(1.17+tube*Math.cos(v))*Math.sin(u),tube*Math.sin(v),Math.cos(v)*Math.cos(u),Math.cos(v)*Math.sin(u),Math.sin(v)];}
    for(let i=0;i<180;i++)for(let j=0;j<20;j++){
      const u=i/180*Math.PI*2,v=j/20*Math.PI*2,du=Math.PI*2/180,dv=Math.PI*2/20;
      mesh.push(...point(u,v),...point(u+du,v),...point(u,v+dv),...point(u+du,v),...point(u+du,v+dv),...point(u,v+dv));
    }
    let seed=17;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<10000;i++){
      const a=random()*Math.PI*2,r=1.35+Math.pow(random(),2)*2.3;
      particles.push(Math.cos(a)*r,Math.sin(a)*r,(random()-.5)*(.3+r*.45),0,0,0);
    }
    const buffers:WebGLBuffer[]=[];
    const buffer=(values:number[])=>{const b=gl.createBuffer();if(b){buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(values),gl.STATIC_DRAW);}return b;};
    const meshBuffer=buffer(mesh),particleBuffer=buffer(particles);
    const aPosition=gl.getAttribLocation(program,"aPosition"),aNormal=gl.getAttribLocation(program,"aNormal");
    const uniforms=Object.fromEntries(["uTime","uProgress","uParticles","uAspect","uPixelRatio","uPointer"].map(name=>[name,gl.getUniformLocation(program,name)]));
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)"),desktop=window.matchMedia("(min-width: 761px)");
    let frame=0,last=0,time=0,visible=false,lost=false;
    let pointerX=0,pointerY=0;
    const draw=(stamp:number)=>{
      if(lost || !desktop.matches || !visible || document.hidden)return;
      const moving=!reduced.matches;
      if(moving)time+=Math.min(40,stamp-(last||stamp))*.001;last=stamp;
      gl.viewport(0,0,el.width,el.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program);gl.uniform1f(uniforms.uTime,time);gl.uniform1f(uniforms.uProgress,progress.current);gl.uniform1f(uniforms.uAspect,el.clientWidth/Math.max(1,el.clientHeight));gl.uniform1f(uniforms.uPixelRatio,Math.min(devicePixelRatio,1.5));gl.uniform2f(uniforms.uPointer,pointerX,pointerY);
      gl.enable(gl.BLEND);gl.enable(gl.DEPTH_TEST);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      const bind=(b:WebGLBuffer|null)=>{gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.enableVertexAttribArray(aPosition);gl.vertexAttribPointer(aPosition,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(aNormal);gl.vertexAttribPointer(aNormal,3,gl.FLOAT,false,24,12);};
      gl.uniform1f(uniforms.uParticles,0);bind(meshBuffer);gl.drawArrays(gl.TRIANGLES,0,mesh.length/6);
      gl.uniform1f(uniforms.uParticles,1);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.depthMask(false);bind(particleBuffer);gl.drawArrays(gl.POINTS,0,particles.length/6);gl.depthMask(true);
      if(moving)frame=requestAnimationFrame(draw);
    };
    const restart=()=>{cancelAnimationFrame(frame);last=0;draw(performance.now());};
    const resize=new ResizeObserver(()=>{const dpr=Math.min(devicePixelRatio,1.5);el.width=Math.round(el.clientWidth*dpr);el.height=Math.round(el.clientHeight*dpr);restart();});
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;restart();});
    const onScroll=()=>{if(reduced.matches)restart();};
    const onPointer=(event:PointerEvent)=>{if(reduced.matches)return;const rect=el.getBoundingClientRect();pointerX=(event.clientX-rect.left)/rect.width-.5;pointerY=(event.clientY-rect.top)/rect.height-.5;};
    const leave=()=>{pointerX=0;pointerY=0;};
    const contextLost=(event:Event)=>{event.preventDefault();lost=true;cancelAnimationFrame(frame);setAvailable(false);};
    const parent=el.parentElement!;
    resize.observe(el);observer.observe(el);parent.addEventListener("pointermove",onPointer);parent.addEventListener("pointerleave",leave);window.addEventListener("scroll",onScroll,{passive:true});document.addEventListener("visibilitychange",restart);reduced.addEventListener("change",restart);desktop.addEventListener("change",restart);el.addEventListener("webglcontextlost",contextLost);
    // Publish availability from the next frame, after browser initialization.
    const ready=requestAnimationFrame(()=>setAvailable(true));
    return ()=>{cancelAnimationFrame(ready);cancelAnimationFrame(frame);resize.disconnect();observer.disconnect();parent.removeEventListener("pointermove",onPointer);parent.removeEventListener("pointerleave",leave);window.removeEventListener("scroll",onScroll);document.removeEventListener("visibilitychange",restart);reduced.removeEventListener("change",restart);desktop.removeEventListener("change",restart);el.removeEventListener("webglcontextlost",contextLost);buffers.forEach(b=>gl.deleteBuffer(b));shaders.forEach(s=>gl.deleteShader(s));gl.deleteProgram(program);};
  },[progress]);
  return <><div className={`spatial-fallback ${available?"is-rendered":""}`} aria-hidden="true"><i/><i/><i/></div><canvas className="spatial-canvas" ref={canvas} aria-hidden="true"/></>;
}

export default function DesktopExperience({signedIn=false}:{signedIn?:boolean}) {
  const track=useRef<HTMLElement>(null),stage=useRef<HTMLDivElement>(null),progress=useRef(0);
  const [scene,setScene]=useState(0);
  const [reduced,setReduced]=useState(false);
  const access=signedIn?"/":"#account-access";
  useEffect(()=>{
    const media=window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame=0;
    const update=()=>{
      frame=0;if(!track.current||!stage.current)return;
      const range=Math.max(1,track.current.offsetHeight-window.innerHeight);
      const p=media.matches?0:Math.max(0,Math.min(2,-track.current.getBoundingClientRect().top/range*2));progress.current=p;
      stage.current.style.setProperty("--journey",String(p));
      stage.current.style.setProperty("--intro-opacity",String(Math.max(0,1-p*2)));
      stage.current.style.setProperty("--gallery-opacity",String(Math.max(0,Math.min(1,(p-.4)*3,(1.8-p)*3))));
      stage.current.style.setProperty("--portal-opacity",String(Math.max(0,Math.min(1,(p-1.4)*2))));
      const next=p<.55?0:p<1.55?1:2;setScene(next);
      stage.current.querySelectorAll<HTMLElement>("[data-scene]").forEach(el=>{const hidden=Number(el.dataset.scene)!==next&&!media.matches;el.inert=hidden;el.setAttribute("aria-hidden",String(hidden));});
    };
    const scroll=()=>{if(!frame)frame=requestAnimationFrame(update);};
    const motion=()=>{setReduced(media.matches);scroll();};
    window.addEventListener("scroll",scroll,{passive:true});window.addEventListener("resize",scroll);media.addEventListener("change",motion);const init=requestAnimationFrame(motion);
    return ()=>{cancelAnimationFrame(init);cancelAnimationFrame(frame);window.removeEventListener("scroll",scroll);window.removeEventListener("resize",scroll);media.removeEventListener("change",motion);};
  },[]);
  function go(index:number){if(!track.current)return;const top=window.scrollY+track.current.getBoundingClientRect().top;window.scrollTo({top:top+(track.current.offsetHeight-window.innerHeight)*(index/2),behavior:reduced?"instant":"smooth"});}
  return <section className="desktop-journey" ref={track} aria-label="Desktop immersive market experience">
    <div className="desktop-stage" ref={stage} data-active-scene={scene}>
      <div className="spatial-ambient" aria-hidden="true"/><SpatialArtwork progress={progress}/>
      <header className="spatial-header"><Link href="/home" className="spatial-brand"><span className="spatial-brand-mark">NR</span><small>INDEPENDENT MARKET OBSERVATORY</small></Link><div><Link href="#home-features">Explore the workspace</Link><Link className="spatial-access" href={access}>{signedIn?"Open dashboard":"ចូលគណនី"}<span>↗</span></Link></div></header>
      <div className="spatial-intro" data-scene="0"><p className="spatial-eyebrow">CONNECT THE SIGNALS / SEE THE CONTEXT</p><h1>MARKET<br/>INTELLIGENCE.<br/><em>REIMAGINED.</em></h1><div className="spatial-intro-note"><span>01 — A DIFFERENT PERSPECTIVE</span><p>មើលឲ្យលើសពីចលនាតម្លៃ។<br/>ស្វែងយល់ពី CPI, Forex និង Crypto។</p><Link href={access}>Enter your workspace ↗</Link></div></div>
      <div className="spatial-gallery" data-scene="1" inert aria-hidden="true"><div className="spatial-gallery-heading"><p className="spatial-eyebrow">THREE LENSES. ONE BIGGER PICTURE.</p><h2>DISCOVER YOUR<br/><em>MARKET WORLD.</em></h2></div><div className="spatial-card-space">
        <Link href={access} className="spatial-card spatial-card-one"><span>01 / MACRO ECONOMICS</span><div className="spatial-card-art art-inflation" aria-hidden="true"><i/><i/><i/><b>CPI</b></div><h3>THE NEXT<br/>CATALYST.</h3><p>CPI calendar & scenario research</p><small>Explore the event ↗</small></Link>
        <Link href={access} className="spatial-card spatial-card-two"><span>02 / GLOBAL MARKETS</span><div className="spatial-card-art art-market" aria-hidden="true"><svg viewBox="0 0 300 160"><path d="M0 140 30 110 60 120 90 60 120 85 150 40 180 65 210 15 240 38 280 5"/><path d="M0 150 40 130 70 140 120 105 160 125 200 70 245 92 300 30"/></svg></div><h3>FOLLOW<br/>THE MOVEMENT.</h3><p>Crypto charts & Forex reference rates</p><small>Explore the markets ↗</small></Link>
        <Link href={access} className="spatial-card spatial-card-three"><span>03 / SOURCE INTELLIGENCE</span><div className="spatial-card-art art-research" aria-hidden="true"><b>?</b><i>source → context</i></div><h3>BEYOND<br/>THE HEADLINE.</h3><p>Social sources & supported questions</p><small>Explore the research ↗</small></Link>
      </div><p className="spatial-gallery-note">Your research workspace. Decorative artwork, not live market data.</p></div>
      <div className="spatial-portal" data-scene="2" inert aria-hidden="true"><p className="spatial-eyebrow">LESS NOISE. MORE PERSPECTIVE.</p><h2>YOUR NEXT<br/><em>PERSPECTIVE.</em></h2><p>ទីផ្សារមានរឿងច្រើនជាងតម្លៃ។ ចាប់ផ្ដើមស្វែងយល់។</p><Link className="spatial-enter" href={access}>{signedIn?"Open dashboard":"ចូលប្រើប្រាស់"}<span>↗</span></Link></div>
      <footer className="spatial-controls"><div className="spatial-chapters" aria-label="Experience chapters">{["Perspective","Discover","Enter"].map((label,i)=><button type="button" key={label} onClick={()=>go(i)} aria-current={scene===i?"step":undefined}><span>0{i+1}</span>{label}</button>)}</div><div className="spatial-scroll-cue">SCROLL TO EXPLORE <span>↓</span></div></footer>
    </div>
  </section>;
}
