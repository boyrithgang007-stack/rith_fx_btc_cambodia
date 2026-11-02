import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compiled={exports:{}};
new Function('exports','module',ts.transpileModule(fs.readFileSync('app/galaxy-quotes.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(compiled.exports,compiled);
const {buildGalaxyQuotes}=compiled.exports;
test('missing quote values are unavailable rather than simulated or zero prices',()=>{
  const rows=buildGalaxyQuotes([],[],null,false,false);assert.equal(rows.length,4);assert.ok(rows.every(q=>q.price===null));
});
test('galaxies preserve real units, timestamps and failed-refresh labels',()=>{
  const rows=buildGalaxyQuotes([{id:'bitcoin',current_price:80000,last_updated:'2026-10-29T02:00:00Z'}],[{id:'gold',price:4000,asOf:1000},{id:'wti',price:70,asOf:2000},{id:'silver',price:NaN,asOf:3000}],5000,true,true);
  assert.equal(rows[0].price,80000);assert.equal(rows[0].asOf,Date.parse('2026-10-29T02:00:00Z'));assert.equal(rows[0].timeLabel,'As of');
  assert.equal(rows.find(q=>q.id==='gold').unit,'USD / troy oz');assert.equal(rows.find(q=>q.id==='wti').unit,'USD / barrel');assert.equal(rows.find(q=>q.id==='silver').price,null);assert.ok(rows.every(q=>q.stale));
  const btc=buildGalaxyQuotes([{id:'bitcoin',current_price:80000}],[],5000,false,false)[0];assert.equal(btc.timeLabel,'Fetched');assert.equal(btc.asOf,5000);
});
