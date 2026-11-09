import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const markets={exports:{}};
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
new Function('exports','module',compile('app/candle-markets.ts'))(markets.exports,markets);
const mod={exports:{}};new Function('exports','module','require',compile('app/lib/binance-stream.ts'))(mod.exports,mod,()=>markets.exports);
const now=1800000000000;
const tick=()=>({e:'kline',E:now,s:'BTCUSDT',k:{s:'BTCUSDT',i:'15m',t:now-900000,T:now-1,x:true,o:'100',h:'102',l:'99',c:'101',v:'5'}});
test('stream accepts matching closed and forming candles without promoting forming bars',()=>{
 const parsed=mod.exports.parseStreamCandle(tick(),'BTCUSDT','15m',now);
 assert.equal(parsed.closed,true);assert.equal(parsed.candle.time,now);
 const open=tick();open.k.x=false;assert.equal(mod.exports.parseStreamCandle(open,'BTCUSDT','15m',now).closed,false);
});
test('stream rejects mismatched markets, stale/future events, invalid bounds and intervals',()=>{
 for(const change of [v=>v.s='ETHUSDT',v=>v.k.i='1h',v=>v.E-=20000,v=>v.E+=10000,v=>v.k.h='90',v=>v.k.v='-1',v=>v.k.T-=1,v=>v.k.c='',v=>v.k.x='true']){
  const v=tick();change(v);assert.equal(mod.exports.parseStreamCandle(v,'BTCUSDT','15m',now),null);
 }
});
