import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
function load(path){const compiled={exports:{}};new Function('exports','module',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(compiled.exports,compiled);return compiled.exports;}
const {portraitOrbitPose,portraitOrbitPoint}=load('app/portrait-orbit.ts');
const {lessonRisk,candleDirection}=load('app/learning-model.ts');
test('portrait orbit spins steadily in one flat galactic plane',()=>{
  assert.ok(portraitOrbitPose(0).spinSpeed>0);assert.equal(portraitOrbitPose(0).spinSpeed,portraitOrbitPose(3).spinSpeed);
  const t=2,delta=1e-5;
  const numeric=(portraitOrbitPose(t+delta).spin-portraitOrbitPose(t-delta).spin)/(2*delta);
  assert.ok(Math.abs(numeric-portraitOrbitPose(t).spinSpeed)<1e-6);
});
test('flat orbit projection remains finite, elliptical and rotates around the portrait',()=>{
  for(let time=0;time<40;time+=.5)for(let u=0;u<1;u+=.05)for(let v=0;v<1;v+=.25){
    const p=portraitOrbitPoint(u,v,time);assert.ok([p.x,p.y,p.z].every(Number.isFinite));assert.ok(p.x>25&&p.x<575);assert.ok(p.y>200&&p.y<530);
  }
  const orbit=Array.from({length:80},(_,i)=>portraitOrbitPoint(i/80,.25,0));
  const width=Math.max(...orbit.map(p=>p.x))-Math.min(...orbit.map(p=>p.x));
  const height=Math.max(...orbit.map(p=>p.y))-Math.min(...orbit.map(p=>p.y));
  assert.ok(width>400);assert.ok(height>150);assert.ok(width>height*1.8);
  assert.notDeepEqual(portraitOrbitPoint(.1,.2,0),portraitOrbitPoint(.1,.2,3));
});
test('lesson candles distinguish observed direction and reject malformed OHLC',()=>{
  const c={open:100,high:115,low:90,close:108};assert.equal(candleDirection(c),'up');
  assert.equal(candleDirection({...c,close:95}),'down');assert.equal(candleDirection({...c,close:100}),'flat');
  assert.throws(()=>candleDirection({...c,high:99}));assert.throws(()=>candleDirection({...c,close:NaN}));
});
test('risk lesson computes a long example and caps unleveraged exposure',()=>{
  const r=lessonRisk(1000,1,100,95);assert.equal(r.budget,10);assert.equal(r.quantity,2);assert.equal(r.plannedLoss,10);
  const capped=lessonRisk(1000,5,100,99.99);assert.equal(capped.quantity,10);assert.equal(capped.exposure,1000);assert.ok(capped.plannedLoss<=capped.budget);
  for(const values of [[0,1,100,95],[1000,0,100,95],[1000,101,100,95],[1000,1,100,100],[1000,1,100,105],[Infinity,1,100,95],[1e308,100,1e-308,1e-309]])assert.equal(lessonRisk(...values),null);
});
