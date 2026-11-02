import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const mod = { exports: {} };
new Function('exports', 'module', ts.transpileModule(fs.readFileSync('app/strategy.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(mod.exports,mod);
const { analyzeMarket, evaluateSignal, backtestStrategy, validCandles } = mod.exports;
function fixture() {
  let seed=12345,price=100;
  const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/2**32;};
  return Array.from({length:450},(_,i)=>{const open=price;price=Math.max(20,open+(rand()-.48)*8);return {time:(i+1)*14400000,open,close:price,high:Math.max(open,price)+rand()*2,low:Math.min(open,price)-rand()*2,volume:0};});
}
const candles=fixture();
test('validates OHLC and rejects nonmonotonic times / non-finite data',()=>{
  assert.ok(validCandles(candles));assert.equal(validCandles([{...candles[0],high:NaN}]),false);
  assert.equal(validCandles([candles[1],candles[0]]),false);
});
test('confirmed events and zone creation remain unchanged when future candles arrive',()=>{
  const full=analyzeMarket(candles);
  assert.ok(full.events.length>0);assert.ok(full.zones.length>0);
  for(let n=20;n<450;n+=7){
    const past=analyzeMarket(candles.slice(0,n));
    assert.deepEqual(past.events,full.events.filter(e=>e.index<n));
    assert.deepEqual(past.zones.map(z=>({id:z.id,direction:z.direction,index:z.index,obIndex:z.obIndex,top:z.top,bottom:z.bottom,obTop:z.obTop,obBottom:z.obBottom})),full.zones.filter(z=>z.index<n).map(z=>({id:z.id,direction:z.direction,index:z.index,obIndex:z.obIndex,top:z.top,bottom:z.bottom,obTop:z.obTop,obBottom:z.obBottom})));
    for(const e of past.events)assert.ok(e.index>=e.pivotIndex+2);
  }
});
test('BUY and SELL require first touch and rejection; risk is capped at 2%',()=>{
  const directions=new Set();
  const mirrored=candles.map(c=>({...c,open:1000-c.open,close:1000-c.close,high:1000-c.low,low:1000-c.high}));
  for(const series of [candles,mirrored]) for(let n=20;n<=series.length;n++){
    const signal=evaluateSignal(series.slice(0,n),10000,99,2);
    assert.ok(signal.riskAmount<=200+1e-8);
    if(signal.action==='WAIT')continue;
    directions.add(signal.action);assert.ok(signal.checks.every(c=>c.passed));
    assert.equal(signal.zone.touchedAt,n-1);assert.ok(signal.notional<=10000+1e-8);
    if(signal.action==='BUY')assert.ok(signal.stopLoss<signal.entry && signal.entry<signal.takeProfit);
    else assert.ok(signal.takeProfit<signal.entry && signal.entry<signal.stopLoss);
  }
  assert.deepEqual([...directions].sort(),['BUY','SELL']);
});
test('backtest fills at next open and fees reduce return',()=>{
  const free=backtestStrategy(candles,10000,1,2,0),paid=backtestStrategy(candles,10000,1,2,10);
  assert.ok(free.trades.length>0);assert.ok(paid.netReturn<free.netReturn);
  for(const t of free.trades){const index=candles.findIndex(c=>c.time===t.time);assert.equal(t.entry,candles[index].open);assert.equal(evaluateSignal(candles.slice(0,index),10000,1,2).action,t.direction);}
});
test('empty / insufficient data returns WAIT and no trades',()=>{
  assert.equal(evaluateSignal([]).action,'WAIT');assert.equal(evaluateSignal(candles.slice(0,19)).action,'WAIT');assert.equal(backtestStrategy([],10000,1,2).trades.length,0);
});

test('same-bar SL/TP uses stop first and gaps beyond SL fill at open',()=>{
  const result=backtestStrategy(candles,10000,1,2,0);
  const trade=result.trades[0],index=candles.findIndex(c=>c.time===trade.time);
  const signal=evaluateSignal(candles.slice(0,index),10000,1,2);
  const distance=Math.abs(trade.entry-signal.stopLoss),sign=trade.direction==='BUY' ? 1 : -1;
  const tp=trade.entry+sign*distance*2;
  const both={...candles[index],high:Math.max(tp,signal.stopLoss,trade.entry)+1,low:Math.min(tp,signal.stopLoss,trade.entry)-1};
  const ambiguous=backtestStrategy([...candles.slice(0,index),both],10000,1,2,0);
  assert.equal(ambiguous.trades[0].exit,signal.stopLoss);assert.equal(ambiguous.trades[0].reason,'SL');
  const entryBar={...candles[index],high:trade.entry+distance*.1,low:trade.entry-distance*.1,close:trade.entry};
  const gapOpen=signal.stopLoss-sign*distance*.5;
  const gap={time:entryBar.time+14400000,open:gapOpen,close:gapOpen,high:gapOpen+.01,low:gapOpen-.01,volume:0};
  const gapped=backtestStrategy([...candles.slice(0,index),entryBar,gap],10000,1,2,0);
  assert.equal(gapped.trades[0].exit,gapOpen);assert.equal(gapped.trades[0].reason,'SL gap');
});

const { aggregateCandles, hasContinuousCandles, evaluateConfirmedSignal } = mod.exports;
test('aggregation omits incomplete UTC groups and groups with a missing candle',()=>{
  const base=candles.slice(0,17),grouped=aggregateCandles(base,14400000,86400000);
  assert.equal(grouped.length,2);assert.equal(grouped[0].time,86400000);
  assert.equal(grouped[0].open,base[0].open);assert.equal(grouped[0].close,base[5].close);
  assert.equal(grouped[0].high,Math.max(...base.slice(0,6).map(c=>c.high)));
  assert.equal(aggregateCandles(base.filter((_,i)=>i!==2),14400000,86400000).length,1);
  assert.equal(hasContinuousCandles(base.filter((_,i)=>i!==2),14400000),false);
});
test('HTF gating excludes future bars, blocks missing/opposing HTF and includes fees in risk',()=>{
  const shifted=candles.map(c=>({...c,time:c.time+1e12}));
  const trade=backtestStrategy(shifted,10000,1,2,0).trades[0];
  const index=shifted.findIndex(c=>c.time===trade.time),base=shifted.slice(0,index);
  const initial=evaluateSignal(base,10000,1,2);
  assert.equal(initial.action,'BUY');
  let source;
  for(let n=20;n<candles.length;n++){if(analyzeMarket(candles.slice(0,n)).trend==='BULLISH'){source=candles.slice(0,n);break;}}
  const ms=86400000,at=base.at(-1).time;
  const higher=source.map((c,i)=>({...c,time:at-(source.length-1-i)*ms}));
  const config={candles:higher,intervalMs:ms,baseIntervalMs:14400000};
  const confirmed=evaluateConfirmedSignal(base,10000,1,2,config,25);
  assert.equal(confirmed.action,'BUY');assert.ok(confirmed.riskAmount<=100+1e-8);
  const plannedRisk=confirmed.quantity*(Math.abs(confirmed.entry-confirmed.stopLoss)+(confirmed.entry+confirmed.stopLoss)*.0025);
  assert.ok(Math.abs(plannedRisk-confirmed.riskAmount)<1e-8);
  const future={...higher.at(-1),time:at+ms,open:1,close:1,high:1,low:1};
  assert.deepEqual(evaluateConfirmedSignal(base,10000,1,2,{...config,candles:[...higher,future]},25),confirmed);
  assert.equal(evaluateConfirmedSignal(base,10000,1,2,{...config,candles:[]}).action,'WAIT');
  const opposite=higher.map(c=>({...c,open:1000-c.open,close:1000-c.close,high:1000-c.low,low:1000-c.high}));
  assert.equal(evaluateConfirmedSignal(base,10000,1,2,{...config,candles:opposite}).action,'WAIT');
  const stale=higher.map(c=>({...c,time:c.time-ms}));
  assert.equal(evaluateConfirmedSignal(base,10000,1,2,{...config,candles:stale}).action,'WAIT');
  assert.equal(backtestStrategy(base,10000,1,2,10,{...config,candles:[]}).trades.length,0);
});
test('backtest reports equity and expectancy consistently and handles invalid inputs',()=>{
  const result=backtestStrategy(candles,10000,1,2,10);
  assert.equal(result.equityCurve.length,result.trades.length+1);
  assert.ok(Math.abs(result.equityCurve.at(-1)-(10000+result.trades.reduce((s,t)=>s+t.pnl,0)))<1e-8);
  assert.ok(Math.abs(result.expectancy-result.trades.reduce((s,t)=>s+t.pnl,0)/result.trades.length)<1e-8);
  const invalid=backtestStrategy([{...candles[0],close:NaN}],NaN,NaN,NaN,NaN);
  assert.equal(invalid.trades.length,0);assert.equal(invalid.netReturn,0);
});

test('market API rejects malformed candles and exposes validated interval metadata',async()=>{
  const route={exports:{}};
  let payload=[[14400000,100,110,90,105],[28800000,105,115,100,110]];
  const fakeFetch=async()=>Response.json(payload);
  new Function('exports','module','require','fetch',ts.transpileModule(fs.readFileSync('app/api/market/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(route.exports,route,(name)=>name.includes("lib/auth") ? {getCurrentUser:async()=>({id:"test"})} : mod.exports,fakeFetch);
  const request=new Request('http://localhost/api/market?candles=1&coin=bitcoin&days=30');
  const response=await route.exports.GET(request),body=await response.json();
  assert.equal(response.status,200);assert.equal(body.interval,'4h');assert.equal(body.intervalMs,14400000);assert.equal(body.asOf,28800000);
  payload=[[14400000,100,80,90,105]];
  assert.equal((await route.exports.GET(request)).status,502);
  payload=[[14400000,100,110,90,105],[43200000,105,115,100,110]];
  assert.equal((await route.exports.GET(request)).status,502);
  payload={unexpected:true};
  assert.equal((await route.exports.GET(request)).status,502);
});

test('market API keeps the optional CoinGecko key on the upstream request',async()=>{
  const previousKey=process.env.COINGECKO_API_KEY;
  process.env.COINGECKO_API_KEY='test-server-only-key';
  try{
    const route={exports:{}};
    let requestOptions;
    new Function('exports','module','require','fetch',ts.transpileModule(fs.readFileSync('app/api/market/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(route.exports,route,(name)=>name.includes("lib/auth") ? {getCurrentUser:async()=>({id:"test"})} : mod.exports,async(_url,options)=>{requestOptions=options;return Response.json({prices:[[1,2]]});});
    const response=await route.exports.GET(new Request('http://localhost/api/market?coin=bitcoin&days=1'));
    assert.equal(response.status,200);
    assert.equal(new Headers(requestOptions.headers).get('x-cg-demo-api-key'),'test-server-only-key');
    assert.equal(JSON.stringify(await response.json()).includes('test-server-only-key'),false);
  }finally{
    if(previousKey===undefined)delete process.env.COINGECKO_API_KEY;
    else process.env.COINGECKO_API_KEY=previousKey;
  }
});

test('chart markers match closed-prefix signals and never use future candles',()=>{
  const markers=mod.exports.chartSignals(candles,10000,1,2,undefined,10);
  assert.ok(markers.length>0);
  for(const marker of markers){
    assert.equal(marker.time,candles[marker.index].time);
    assert.deepEqual(marker.signal,mod.exports.evaluateConfirmedSignal(candles.slice(0,marker.index+1),10000,1,2,undefined,10));
  }
  const n=markers[0].index+1;
  assert.deepEqual(mod.exports.chartSignals(candles.slice(0,n),10000,1,2,undefined,10),markers.filter(m=>m.index<n));
  assert.deepEqual(mod.exports.chartSignals(candles,10000,1,2,{candles:[],intervalMs:86400000}),[]);
  assert.deepEqual(mod.exports.chartSignals([],10000,1,2),[]);
});
