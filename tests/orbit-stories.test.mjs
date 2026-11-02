import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compiled={exports:{}};
new Function('exports','module',ts.transpileModule(fs.readFileSync('app/orbit-stories.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(compiled.exports,compiled);
const {buildOrbitStories}=compiled.exports;
const errors={macro:false,news:false};
test('empty feeds do not invent orbit headlines',()=>assert.deepEqual(buildOrbitStories(null,[],errors),[]));
test('CPI schedule and published news interleave with distinct time semantics',()=>{
  const macro={checkedAt:1000,events:[{title:'Old CPI',time:500},{title:'Next US CPI',time:2000}],forexFactory:{status:'connected',events:[{id:'cpi',title:'CPI m/m',time:1200,currency:'USD',isCpi:true,actual:null,forecast:'0.2%',previous:'0.1%'}]}};
  const stories=buildOrbitStories(macro,[{title:'Economic headline',url:'https://www.bloomberg.com/news/a',publishedAt:'2026-10-29T01:00:00Z'}],errors);
  assert.equal(stories.length,3);assert.equal(stories[0].title,'Next US CPI');assert.equal(stories[0].timeLabel,'Scheduled');assert.equal(stories[1].source,'Bloomberg');assert.equal(stories[1].timeLabel,'Published');assert.match(stories[2].detail,/Actual —/);assert.equal(stories.some(s=>s.title==='Old CPI'),false);
});
test('unsafe or invalid news links are excluded and last loaded items are marked stale',()=>{
  const item={title:'Headline',url:'https://www.bloomberg.com/news/a',publishedAt:'2026-10-29T01:00:00Z'};
  const stories=buildOrbitStories(null,[item,item,{...item,url:'https://example.com/a'},{...item,url:'javascript:alert(1)'},{...item,publishedAt:'invalid'}],{macro:false,news:true});
  assert.equal(stories.length,1);assert.equal(stories[0].stale,true);
});
