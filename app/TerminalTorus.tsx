"use client";

import { useEffect, useRef, useState } from "react";

const vertexShader = `
attribute vec3 aPosition;
uniform float uTime;
uniform float uAspect;
uniform float uPointSize;
uniform float uParticle;
varying float vHeight;
varying float vParticle;
void main() {
  float angle = uTime * 0.075;
  float c = cos(angle);
  float s = sin(angle);
  vec3 p = aPosition;
  p.z += sin(uTime * 0.38 + p.x * 4.0 + p.y * 3.0) * 0.018;
  float x = p.x * c - p.z * s;
  float z = p.x * s + p.z * c;
  float y = p.y * cos(0.6) - z * sin(0.6);
  z = p.y * sin(0.6) + z * cos(0.6);
  float perspective = 2.8 / (3.4 - z);
  float scale = min(1.8, uAspect * 1.3);
  gl_Position = vec4(x * perspective * scale / max(uAspect, 0.1), y * perspective * scale, 0.0, 1.0);
  gl_PointSize = uPointSize * (uParticle > 0.5 ? 1.0 : 1.0);
  vHeight = y;
  vParticle = uParticle;
}`;

const fragmentShader = `
precision mediump float;
varying float vHeight;
varying float vParticle;
uniform float uTime;
void main() {
  vec3 blue = vec3(0.17, 0.48, 1.0);
  vec3 cyan = vec3(0.08, 0.89, 0.91);
  vec3 green = vec3(0.20, 0.88, 0.52);
  vec3 yellow = vec3(0.95, 0.84, 0.25);
  float h = clamp((vHeight + 0.72) / 1.44, 0.0, 1.0);
  vec3 color = h > 0.55
    ? mix(cyan, blue, smoothstep(0.55, 1.0, h))
    : mix(yellow, green, smoothstep(0.0, 0.5, h));
  if (vParticle > 0.5) {
    vec2 point = gl_PointCoord - vec2(0.5);
    float radius = length(point);
    float glow = exp(-radius * 8.0);
    float core = 1.0 - smoothstep(0.16, 0.5, radius);
    float pulse = 0.78 + 0.22 * sin(uTime * 0.65 + vHeight * 9.0);
    gl_FragColor = vec4(color, (glow * 0.48 + core * 0.78) * pulse);
  } else {
    gl_FragColor = vec4(color, 0.22);
  }
}`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not create the particle shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(message || "Could not compile the particle shader.");
  }
  return shader;
}

function createTorusPoints(majorCount: number, minorCount: number) {
  const points = new Float32Array(majorCount * minorCount * 3);
  let offset = 0;
  for (let major = 0; major < majorCount; major += 1) {
    const u = (major / majorCount) * Math.PI * 2;
    for (let minor = 0; minor < minorCount; minor += 1) {
      const v = (minor / minorCount) * Math.PI * 2;
      const radius = 0.62 + 0.2 * Math.cos(v);
      points[offset] = radius * Math.cos(u);
      points[offset + 1] = 0.2 * Math.sin(v);
      points[offset + 2] = radius * Math.sin(u);
      offset += 3;
    }
  }
  return points;
}

function createTorusLines(majorCount: number, minorCount: number) {
  const points = new Float32Array(majorCount * minorCount * 12);
  let offset = 0;
  const write = (major: number, minor: number) => {
    const u = (major / majorCount) * Math.PI * 2;
    const v = (minor / minorCount) * Math.PI * 2;
    const radius = 0.62 + 0.2 * Math.cos(v);
    points[offset++] = radius * Math.cos(u);
    points[offset++] = 0.2 * Math.sin(v);
    points[offset++] = radius * Math.sin(u);
  };
  for (let major = 0; major < majorCount; major += 1) {
    for (let minor = 0; minor < minorCount; minor += 1) {
      write(major, minor);
      write((major + 1) % majorCount, minor);
      write(major, minor);
      write(major, (minor + 1) % minorCount);
    }
  }
  return points;
}

export default function TerminalTorus() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [unavailable, setUnavailable] = useState(false);
  const elapsed = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: true });
    if (!gl) {
      setUnavailable(true);
      return;
    }

    let program: WebGLProgram | null = null;
    let frame = 0;
    let resizeObserver: ResizeObserver | null = null;
    let resizeHandler = () => {};
    let removeMotionListener = () => {};
    let removeSceneListeners = () => {};
    let refreshScene = () => {};

    try {
      const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShader);
      const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
      program = gl.createProgram();
      if (!program) throw new Error("Could not create the particle program.");
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || "Could not link the particle program.");
      }

      const smallScreen = window.matchMedia("(max-width: 700px)").matches;
      const majorCount = smallScreen ? 38 : 72;
      const minorCount = smallScreen ? 12 : 24;
      const particleCount = majorCount * minorCount;
      const locations = {
        position: gl.getAttribLocation(program, "aPosition"),
        time: gl.getUniformLocation(program, "uTime"),
        aspect: gl.getUniformLocation(program, "uAspect"),
        pointSize: gl.getUniformLocation(program, "uPointSize"),
        particle: gl.getUniformLocation(program, "uParticle"),
      };
      const createBuffer = (data: Float32Array) => {
        const buffer = gl.createBuffer();
        if (!buffer) throw new Error("Could not create the particle buffer.");
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        return buffer;
      };
      const particleBuffer = createBuffer(createTorusPoints(majorCount, minorCount));
      const lineBuffer = createBuffer(createTorusLines(majorCount, minorCount));
      const lineVertexCount = majorCount * minorCount * 4;
      const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

      gl.useProgram(program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.clearColor(0, 0, 0, 0);

      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.max(1, Math.round(rect.width * pixelRatio));
        const height = Math.max(1, Math.round(rect.height * pixelRatio));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        gl.viewport(0, 0, width, height);
        refreshScene();
      };
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
      resizeHandler = resize;
      window.addEventListener("resize", resizeHandler);
      resize();

      let visible = true, lastTime = 0;
      const running = () => !motionPreference.matches && visible && !document.hidden;
      const render = (time: number) => {
        frame = 0;
        if (running() && lastTime) elapsed.current += Math.min(time - lastTime, 50) / 1000;
        lastTime = time;
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);
        gl.uniform1f(locations.time, elapsed.current);
        gl.uniform1f(locations.aspect, canvas.clientWidth / Math.max(canvas.clientHeight, 1));
        gl.uniform1f(locations.pointSize, Math.max(1.5, Math.min(3.2, canvas.clientWidth / 300)));

        gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
        gl.enableVertexAttribArray(locations.position);
        gl.vertexAttribPointer(locations.position, 3, gl.FLOAT, false, 0, 0);
        gl.uniform1f(locations.particle, 0);
        gl.drawArrays(gl.LINES, 0, lineVertexCount);

        gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
        gl.vertexAttribPointer(locations.position, 3, gl.FLOAT, false, 0, 0);
        gl.uniform1f(locations.particle, 1);
        gl.drawArrays(gl.POINTS, 0, particleCount);

        if (running()) frame = requestAnimationFrame(render);
      };
      frame = requestAnimationFrame(render);

      const onMotionChange = () => {
        cancelAnimationFrame(frame);
        lastTime = 0;
        frame = requestAnimationFrame(render);
      };
      refreshScene = onMotionChange;
      const visibilityObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; onMotionChange(); });
      visibilityObserver.observe(canvas);
      document.addEventListener("visibilitychange", onMotionChange);
      removeSceneListeners = () => { visibilityObserver.disconnect(); document.removeEventListener("visibilitychange", onMotionChange); };
      motionPreference.addEventListener("change", onMotionChange);
      removeMotionListener = () => motionPreference.removeEventListener("change", onMotionChange);

      return () => {
        cancelAnimationFrame(frame);
        resizeObserver?.disconnect();
        window.removeEventListener("resize", resizeHandler);
        removeMotionListener();
        removeSceneListeners();
        gl.deleteBuffer(particleBuffer);
        gl.deleteBuffer(lineBuffer);
        if (program) gl.deleteProgram(program);
      };
    } catch (error) {
      console.error("Particle torus failed to initialize.", error);
      setUnavailable(true);
      if (program) gl.deleteProgram(program);
      return () => {
        cancelAnimationFrame(frame);
        resizeObserver?.disconnect();
        window.removeEventListener("resize", resizeHandler);
        removeMotionListener();
        removeSceneListeners();
      };
    }
  }, []);

  return (
    <div className="td-torus-visual">
      <canvas ref={canvasRef} className="td-torus-canvas" aria-label="Animated 3D market particle torus" />
      {unavailable && <span className="td-webgl-message" role="status">WebGL visualization is unavailable in this browser.</span>}
      <span className="td-torus-orbit td-orbit-one" />
      <span className="td-torus-orbit td-orbit-two" />
      <span className="td-torus-tag td-tag-top">MARKET FLOW <i>◈</i></span>
      <span className="td-torus-tag td-tag-left">VOLATILITY <i>↗</i></span>
      <span className="td-torus-tag td-tag-right">MOMENTUM <i>◎</i></span>
      <span className="td-torus-tag td-tag-bottom">LIQUIDITY <i>⌁</i></span>
      <span className="td-torus-core-label">ASSET<br />NETWORK</span>
    </div>
  );
}
