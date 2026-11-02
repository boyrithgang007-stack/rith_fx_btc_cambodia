import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compiled = { exports:{} };
new Function('exports','module',ts.transpileModule(fs.readFileSync('app/research-analysis.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(compiled.exports,compiled);
const { analyzeResearch }=compiled.exports;
const now=1_800_000_000_000;
const points=(direction=1)=>Array.from({length:30},(_,i)=>({time:now-(29-i)*3600000,price:100+direction*i}));
test('missing, stale, future and malformed histories never produce directional percentages',()=>{
  for(const data of [[],points().slice(0,3),points().map(p=>({...p,time:p.time-100000000})),[...points(),{time:now+1,price:150}],points().map((p,i)=>i===5?{...p,price:NaN}:p),[...points()].reverse()]) {
    const r=analyzeResearch(data,now,36e5);assert.equal(r.status,'insufficient');assert.equal(r.up,null);assert.equal(r.down,null);
  }
});
test('rising, falling and flat observations yield bounded historical evidence indices',()=>{
  const up=analyzeResearch(points(1),now,36e5),down=analyzeResearch(points(-1),now,36e5),flat=analyzeResearch(points(0),now,36e5);
  assert.ok(up.up>50);assert.ok(down.up<50);assert.equal(flat.up,50);
  for(const r of [up,down,flat]){assert.equal(r.up+r.down,100);assert.ok(r.up>=0&&r.up<=100);assert.match(r.reason,/no empirical probability/);}
});
test('missing breadth is omitted and cannot masquerade as neutral measured data',()=>{
  const base=analyzeResearch(points(0),now,36e5);
  const invalid=analyzeResearch(points(0),now,36e5,{advancing:NaN,declining:1});
  assert.equal(base.evidence.length,2);assert.equal(invalid.evidence.length,2);
  assert.equal(analyzeResearch(points(0),now,36e5,{advancing:0,declining:0}).evidence.length,2);
  const withBreadth=analyzeResearch(points(0),now,36e5,{advancing:10,declining:0});assert.equal(withBreadth.evidence.length,3);assert.ok(withBreadth.up>base.up);
});
test('price units do not alter a dimensionless evidence index',()=>{
  const original=analyzeResearch(points(),now,36e5);const scaled=analyzeResearch(points().map(p=>({...p,price:p.price*1000})),now,36e5);assert.equal(original.up,scaled.up);
});
