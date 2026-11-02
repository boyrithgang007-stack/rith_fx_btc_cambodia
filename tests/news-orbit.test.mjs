import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compiled={exports:{}};
new Function('exports','module',ts.transpileModule(fs.readFileSync('app/news-orbit.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(compiled.exports,compiled);
const {newsOrbitPosition,dualNewsOrbit,galaxyOrbit}=compiled.exports;
test('linked satellite completes an orbit while keeping its card within desktop and mobile bounds',()=>{
  for(const [w,h,cw,ch] of [[640,640,300,260],[320,620,270,300],[220,620,196,330]])for(let i=0;i<360;i++){
    const p=newsOrbitPosition(w,h,cw,ch,i*Math.PI/180);
    assert.ok(Object.values(p).every(Number.isFinite));
    assert.ok(p.left>=12&&p.left+cw<=w-12+.001);assert.ok(p.top>=12&&p.top+ch<=h-12+.001);
    assert.equal(p.targetX,p.left+cw/2);assert.equal(p.targetY,p.top);
  }
});
test('the node follows both sides of the globe and returns to the same position',()=>{
  const a=newsOrbitPosition(640,640,300,260,0),b=newsOrbitPosition(640,640,300,260,Math.PI),c=newsOrbitPosition(640,640,300,260,Math.PI*2);
  assert.ok(a.nodeX>a.cx);assert.ok(b.nodeX<b.cx);assert.ok(Math.abs(a.nodeX-c.nodeX)<.0001);assert.ok(Math.abs(a.nodeY-c.nodeY)<.0001);
});
test('two news panels stay separate and their nodes share the same direction',()=>{
  for(const [w,h,cw,ch] of [[900,860,280,300],[600,860,280,330],[320,1020,270,350]])for(let i=0;i<360;i++){
    const [a,b]=dualNewsOrbit(w,h,[{width:cw,height:ch},{width:cw,height:ch}],i*Math.PI/180);
    assert.ok(a.left+cw<=b.left||b.left+cw<=a.left||a.top+ch<=b.top||b.top+ch<=a.top);
    for(const p of [a,b]){assert.ok(p.left>=12&&p.left+cw<=w-12+.001);assert.ok(p.top>=12&&p.top+ch<=h-12+.001);}
    assert.ok(Math.abs((a.nodeX-a.cx)+(b.nodeX-b.cx))<.001);
    assert.ok(Math.abs((a.nodeY-a.cy)+(b.nodeY-b.cy))<.001);
  }
});
test('four quote galaxies remain finite and inside the scene',()=>{
  for(const w of [220,320,900])for(let i=0;i<4;i++)for(let j=0;j<360;j++){
    const p=galaxyOrbit(w,1020,j*Math.PI/180,i);assert.ok(Number.isFinite(p.left)&&Number.isFinite(p.top));assert.ok(p.left>=8&&p.left+140<=w-8+.001);assert.ok(p.top>=8&&p.top+104<=1012);
  }
});
test('compact quote galaxies use their rendered dimensions and stay within the scene',()=>{
  for(const [w,h,cw,ch] of [[220,620,112,90],[320,760,120,90],[900,520,120,90]])for(let i=0;i<4;i++)for(let j=0;j<360;j++){
    const p=galaxyOrbit(w,h,j*Math.PI/180,i,cw,ch);
    assert.ok(Number.isFinite(p.left)&&Number.isFinite(p.top));
    assert.ok(p.left>=8&&p.left+cw<=w-8+.001);
    assert.ok(p.top>=8&&p.top+ch<=h-8+.001);
  }
});
