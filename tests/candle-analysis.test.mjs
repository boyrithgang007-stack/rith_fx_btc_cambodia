import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url),cache=new Map();
let currentUser=null,allow=true,network=async()=>{throw Error('Unexpected network request');};
let routeFeed=null,routeSignal=null,routeReview=null;
const savedReports=new Map();
function load(file){
  file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;
  const compiled={exports:{}};cache.set(file,compiled);
  const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('exports','module','require','fetch',js)(compiled.exports,compiled,name=>{
    if(name==='../../lib/auth')return {getCurrentUser:async()=>currentUser,allowAuthAttempt:()=>allow};
    if(file.endsWith(path.join('candle-analysis','route.ts'))&&name.endsWith('lib/candle-feed'))return {...load('app/lib/candle-feed.ts'),loadCandleFeed:(...args)=>routeFeed(...args)};
    if(file.endsWith(path.join('candle-analysis','route.ts'))&&name.endsWith('lib/candle-signal'))return {closedCandleSignal:(...args)=>routeSignal(...args)};
    if(file.endsWith(path.join('candle-analysis','route.ts'))&&name.endsWith('lib/candle-review'))return {...load('app/lib/candle-review.ts'),reviewCandleEvidence:(...args)=>routeReview(...args)};
    if(file.endsWith(path.join('candle-analysis','route.ts'))&&name.endsWith('lib/candle-analysis-store'))return {listCandleAnalysisReports:userId=>savedReports.get(userId)??[],saveCandleAnalysisReport:(userId,report)=>savedReports.set(userId,[report,...(savedReports.get(userId)??[])])};
    return name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name);
  },(...args)=>network(...args));return compiled.exports;
}
const feed=load('app/lib/candle-feed.ts'),engine=load('app/lib/candle-signal.ts'),reviewer=load('app/lib/candle-review.ts'),route=load('app/api/candle-analysis/route.ts');
const interval=900000,now=1_800_000_000_000;
const rows=()=>Array.from({length:81},(_,i)=>{const open=now-(80-i)*interval;return [open,'100','102','99','101','10',open+interval-1];});
test('Binance uses close timestamps, drops the unclosed candle and rejects malformed/future OHLC',()=>{
  const parsed=feed.parseBinanceCandles(rows(),interval,now);assert.equal(parsed.length,80);assert.equal(parsed.at(-1).time,now);assert.equal(parsed[0].volume,10);
  for(const mutate of [a=>a[3][2]='90',a=>a[3][5]='-1',a=>a[3][6]+=1,a=>a[3][0]=now+1]){const data=rows();mutate(data);assert.throws(()=>feed.parseBinanceCandles(data,interval,now));}
});
test('Twelve Data enforces symbol/timeframe and treats UTC timestamps as candle opens',()=>{
  const data={status:'ok',meta:{symbol:'XAU/USD',interval:'15min'},values:[{datetime:'2027-01-15 08:00:00',open:'100',high:'102',low:'99',close:'101'}]};
  const after=Date.parse('2027-01-15T08:20:00Z');const result=feed.parseTwelveCandles(data,'XAU/USD','15m',after);assert.equal(result[0].time,Date.parse('2027-01-15T08:15:00Z'));assert.equal(result[0].volume,0);
  assert.throws(()=>feed.parseTwelveCandles(data,'XAG/USD','15m',after));assert.throws(()=>feed.parseTwelveCandles(data,'XAU/USD','1h',after));
});
test('missing Forex provider configuration never falls back to invented or mismatched prices',async()=>{
  const saved=process.env.TWELVEDATA_API_KEY;delete process.env.TWELVEDATA_API_KEY;let calls=0;
  try{await assert.rejects(()=>feed.loadCandleFeed('XAUUSD','15m',now,async()=>{calls++;}),/TWELVEDATA_API_KEY/);assert.equal(calls,0);}finally{if(saved===undefined)delete process.env.TWELVEDATA_API_KEY;else process.env.TWELVEDATA_API_KEY=saved;}
});
test('insufficient, stale, gapped and future candle sets fail closed with no entry levels',()=>{
  const candles=feed.parseBinanceCandles(rows(),interval,now);
  for(const data of [candles.slice(0,10),candles.slice(0,-2),candles.filter((_,i)=>i!==60),[...candles,{...candles.at(-1),time:now+1}]]){
    const result=engine.closedCandleSignal(data,interval,now);assert.equal(result.signal.action,'WAIT');for(const key of ['entry','stopLoss','takeProfit'])assert.equal(result.signal[key],null);
  }
  assert.equal(engine.closedCandleSignal(candles,interval,now).expiresAt,now+interval);
});
test('Gemini reviewer uses structured public inputs, rejects incomplete/invalid output and never leaks provider errors',async()=>{
  const oldKey=process.env.GEMINI_API_KEY,oldModel=process.env.GEMINI_ANALYSIS_MODEL;
  process.env.GEMINI_API_KEY='test-only-key';process.env.GEMINI_ANALYSIS_MODEL='gemini-test-model';
  const input={symbol:'BTCUSDT',frame:'15m',source:'Binance',asOf:now,expiresAt:now+interval,trend:'RANGE',signal:{action:'WAIT',reason:'No setup',entry:null,stopLoss:null,takeProfit:null,checks:[]},candles:[]};
  try{
    const good={consistent:true,summary:'Observed range',risks:['No news input'],observations:['No entry setup']};
    const result=await reviewer.reviewCandleEvidence(input,async(url,options)=>{assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent');assert.equal(options.headers['x-goog-api-key'],'test-only-key');const body=JSON.parse(options.body);assert.equal(body.generationConfig.responseMimeType,'application/json');assert.equal(body.generationConfig.responseSchema.type,'object');assert.equal(body.systemInstruction.parts[0].text.includes('never invent an entry'),true);assert.equal(body.contents[0].parts[0].text,JSON.stringify(input));return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(good)}]}}]});});
    assert.equal(result.status,'reviewed');assert.equal(result.consistent,true);
    for(const payload of [{candidates:[]},{candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:JSON.stringify(good)}]}}]},{candidates:[{finishReason:'STOP',content:{parts:[{text:'not JSON'}]}}]}])assert.equal((await reviewer.reviewCandleEvidence(input,async()=>Response.json(payload))).status,'unavailable');
    const failed=await reviewer.reviewCandleEvidence(input,async()=>{throw Error('secret test-only-key');});assert.equal(failed.status,'unavailable');assert.ok(!JSON.stringify(failed).includes('test-only-key'));
  }finally{for(const [key,value] of [['GEMINI_API_KEY',oldKey],['GEMINI_ANALYSIS_MODEL',oldModel]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
const request=(body={},origin='http://localhost')=>new Request('http://localhost/api/candle-analysis',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
test('origin check uses the browser-facing Host without trusting cross-site or forwarded headers',()=>{
  const {isSameOriginRequest}=load('app/lib/auth-http.ts');
  const make=(origin,host,extra={})=>new Request('http://localhost:3000/api/candle-analysis',{headers:{origin,host,...extra}});
  assert.equal(isSameOriginRequest(make('http://127.0.0.1:3000','127.0.0.1:3000')),true);
  assert.equal(isSameOriginRequest(make('https://evil.example','127.0.0.1:3000',{'x-forwarded-host':'evil.example'})),false);
  assert.equal(isSameOriginRequest(make('http://127.0.0.1:3000','127.0.0.1:3000',{'sec-fetch-site':'cross-site'})),false);
  assert.equal(isSameOriginRequest(make('null','127.0.0.1:3000')),false);
});
test('candle endpoint protects auth, origin, rate limits, symbols and AI configuration',async()=>{
  currentUser=null;assert.equal((await route.GET()).status,401);assert.equal((await route.POST(request())).status,401);
  currentUser={id:'owner'};assert.equal((await route.POST(request({},'https://evil.example'))).status,403);
  assert.equal((await route.POST(request({market:'http://internal',frame:'15m',includeAi:false}))).status,400);
  allow=false;assert.equal((await route.POST(request())).status,429);allow=true;
  const key=process.env.GEMINI_API_KEY,model=process.env.GEMINI_ANALYSIS_MODEL;delete process.env.GEMINI_API_KEY;
  try{
    assert.equal((await route.POST(request({market:'BTCUSDT',frame:'15m',includeAi:true}))).status,503);
    process.env.GEMINI_API_KEY='test';process.env.GEMINI_ANALYSIS_MODEL='gemini-test-model';
    const status=await(await route.GET()).json();assert.equal(status.aiConfigured,true);assert.equal(status.aiProvider,'Google Gemini (server configuration required)');assert.ok(Array.isArray(status.reports));
  }finally{for(const [name,value] of [['GEMINI_API_KEY',key],['GEMINI_ANALYSIS_MODEL',model]]){if(value===undefined)delete process.env[name];else process.env[name]=value;}}
});
test('AI cannot promote WAIT and disagreement vetoes an otherwise directional technical setup',async()=>{
  const key=process.env.GEMINI_API_KEY,model=process.env.GEMINI_ANALYSIS_MODEL;process.env.GEMINI_API_KEY='test';process.env.GEMINI_ANALYSIS_MODEL='gemini-test-model';currentUser={id:'owner'};
  routeFeed=async()=>({candles:feed.parseBinanceCandles(rows(),interval,now),source:'Test',volumeAvailable:true});
  const check=(action)=>({signal:{action,reason:'Rule result',entry:100,stopLoss:99,takeProfit:102,checks:[]},analysis:{trend:'BULLISH',ema:[]},expiresAt:Date.now()+60000});
  try{
    routeSignal=()=>check('BUY');routeReview=async()=>({status:'reviewed',consistent:false,model:'test',summary:'Uncertain',risks:[],observations:[]});let result=await(await route.POST(request({market:'BTCUSDT',frame:'15m',includeAi:true}))).json();assert.equal(result.signal.action,'WAIT');assert.equal(result.signal.entry,null);assert.equal(savedReports.get('owner').at(-1).id,result.id);
    routeSignal=()=>({...check('WAIT'),signal:{...check('WAIT').signal,entry:null,stopLoss:null,takeProfit:null}});routeReview=async()=>({status:'reviewed',consistent:true,model:'test',summary:'WAIT supported',risks:[],observations:[]});result=await(await route.POST(request({market:'BTCUSDT',frame:'15m',includeAi:true}))).json();assert.equal(result.signal.action,'WAIT');assert.equal(result.signal.entry,null);assert.equal('quantity' in result.signal,false);assert.equal(savedReports.get('owner').length,2);
  }finally{for(const [k,v] of [['GEMINI_API_KEY',key],['GEMINI_ANALYSIS_MODEL',model]]){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
