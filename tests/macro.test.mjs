import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const mod = { exports: {} };
new Function('exports', 'module', ts.transpileModule(fs.readFileSync('app/lib/macro.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(mod.exports,mod);
const {parseCpiCalendar,compareCpi,inspectPost,answerMacro}=mod.exports;
const event=(date,zone='US-Eastern',title='Consumer Price Index')=>`BEGIN:VEVENT\nDTSTART;TZID=${zone}:${date}\nSUMMARY:${title}\nEND:VEVENT\n`;
test('BLS custom timezone observes winter and summer offsets; deduplicates and sorts',()=>{
 const winter=event('20260113T083000'),summer=event('20260714T083000');
 const parsed=parseCpiCalendar(summer+winter+winter+event('20260120T083000','US-Eastern','Employment Situation'));
 assert.deepEqual(parsed.map(e=>new Date(e.time).toISOString()),['2026-01-13T13:30:00.000Z','2026-07-14T12:30:00.000Z']);
});
test('calendar unfolds lines, reads UTC and refuses unknown timezone',()=>{
 assert.equal(parseCpiCalendar(event('20260113T083000','Unknown')).length,0);
 assert.equal(parseCpiCalendar('BEGIN:VEVENT\r\nDTSTART:20260714T123000Z\r\nSUMMARY:Consumer Price \r\n Index\r\nEND:VEVENT')[0].time,Date.parse('2026-07-14T12:30:00Z'));
});
test('manual scenarios distinguish missing and invalid input from zero surprise',()=>{
 for(const [a,f] of [['','2'],['2',''],['NaN','2'],['Infinity','2'],['101','2']])assert.equal(compareCpi(a,f),null);
 assert.equal(compareCpi('0','0').surprise,0);
 assert.equal(compareCpi('3.1','3').surprise,.1);
 assert.equal(compareCpi('2.8','3').label,'Below forecast');
});
test('post inspection extracts claims without verifying them',()=>{
 const result=inspectPost('CPI 3.1%, BTC and USD will rise');
 assert.deepEqual(result.topics,['CPI','USD / Forex','Crypto']);
 assert.deepEqual(result.claims,['3.1%']);assert.match(result.warning,/Unverified/);
});
test('answers never invent release times or a buy signal and use supplied prices',()=>{
 assert.match(answerMacro('When is CPI?',null,0,null,[]),/No verified/);
 assert.match(answerMacro('Buy BTC?',null,0,null,[]),/cannot confirm/);
 assert.match(answerMacro('BTC price',null,0,null,[{symbol:'btc',price:123}]),/\$123/);
 assert.match(answerMacro('social posts',null,0,null,[]),/No live social/);
 assert.match(answerMacro('CPI',null,0,compareCpi('3','2'),[]),/not verified release/);
});
test('macro assistant supports Khmer answers without changing its English default',()=>{
 assert.match(answerMacro('When is CPI?',null,0,null,[],'km'),/មិនមានកាលបរិច្ឆេទ/);
 assert.match(answerMacro('BTC price',null,0,null,[{symbol:'btc',price:123}],'km'),/មិនមែនជាតម្លៃ broker/);
 assert.match(answerMacro('When is CPI?',null,0,null,[]),/No verified/);
});

test('macro endpoint enforces authentication and survives a failed calendar without inventing posts',async()=>{
 const source=ts.transpileModule(fs.readFileSync('app/api/macro/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 let approved=false,calls=0;
 const route={exports:{}};
 const dependencies=(name)=>name.endsWith('/auth')?{getCurrentUser:async()=>approved?{id:1}:null,allowAuthAttempt:()=>true}:name.endsWith('/macro-ai')?{macroAiConfigured:()=>false,answerMacroQuestion:async()=>''}:mod.exports;
 new Function('exports','module','require','fetch','process',source)(route.exports,route,dependencies,async()=>{calls++;throw Error('offline');},{env:{}});
 assert.equal((await route.exports.GET()).status,401);assert.equal(calls,0);
 approved=true;const response=await route.exports.GET();const body=await response.json();
 assert.equal(response.status,200);assert.deepEqual(body.events,[]);assert.deepEqual(body.posts,[]);
 assert.equal(body.aiConfigured,false);
 assert.match(body.calendarStatus,/unavailable/);assert.match(body.socialStatus,/not connected/);assert.equal(calls,2);
 assert.equal(body.forexFactory.status,'unavailable');assert.deepEqual(body.forexFactory.events,[]);
});

test('macro AI endpoint authenticates, validates context and returns only the generated answer',async()=>{
 const source=ts.transpileModule(fs.readFileSync('app/api/macro/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 let approved=false,configured=true,received=null;
 const route={exports:{}};
 const dependencies=name=>name.endsWith('/auth')
   ?{getCurrentUser:async()=>approved?{id:7}:null,allowAuthAttempt:()=>true}
   :name.endsWith('/auth-http')
     ?{isSameOriginRequest:request=>request.headers.get('origin')===new URL(request.url).origin,readLimitedJson:async request=>request.json()}
     :name.endsWith('/macro-ai')
       ?{macroAiConfigured:()=>configured,answerMacroQuestion:async input=>{received=input;return 'CPI answer';}}
       :mod.exports;
 new Function('exports','module','require','fetch','process',source)(route.exports,route,dependencies,async()=>{throw Error('unused');},{env:{}});
 const context={calendar:null,scenario:null,quotes:[],pricesAsOf:null,calendarStatus:'unavailable',socialStatus:'unavailable',socialPostCount:0};
 const makeRequest=(body,origin='http://localhost')=>new Request('http://localhost/api/macro',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
 const body={question:'How can CPI affect markets?',language:'en',context};
 assert.equal((await route.exports.POST(makeRequest(body))).status,401);
 approved=true;
 assert.equal((await route.exports.POST(makeRequest(body,'https://attacker.example'))).status,403);
 assert.equal((await route.exports.POST(makeRequest({...body,context:{...context,quotes:[{symbol:'BTC',price:NaN}]}}))).status,400);
 configured=false;
 assert.equal((await route.exports.POST(makeRequest(body))).status,503);
 configured=true;
 const response=await route.exports.POST(makeRequest(body));const result=await response.json();
 assert.equal(response.status,200);assert.deepEqual(result,{answer:'CPI answer'});
 assert.equal(received.question,body.question);assert.equal(received.language,'en');assert.deepEqual(received.context,context);
 assert.equal(response.headers.get('cache-control'),'private, no-store');
});

test('Forex Factory feed uses explicit timezone offsets, deduplicates and retains missing actual as unavailable',()=>{
 const row={title:'Core CPI m/m',country:'USD',date:'2026-01-13T08:30:00-05:00',impact:'High',forecast:'0.3%',previous:'0.2%'};
 const rows=mod.exports.parseForexFactoryCalendar([row,row,{...row,title:'CPI y/y',actual:0},{...row,title:'FOMC Statement'}, {...row,country:'???'},{...row,date:'2026-01-13T08:30:00'}]);
 assert.equal(rows.length,3);
 assert.equal(new Date(rows[0].time).toISOString(),'2026-01-13T13:30:00.000Z');
 assert.equal(rows.find(e=>e.title==='Core CPI m/m').actual,null);
 assert.equal(rows.find(e=>e.title==='CPI y/y').actual,'0');
 assert.equal(rows.find(e=>e.title==='FOMC Statement').isCpi,false);
 assert.equal(rows.filter(e=>e.isCpi).length,2);
 assert.deepEqual(mod.exports.parseForexFactoryCalendar([]),[]);
 for(const value of [null,{},[{title:'CPI',country:'USD',date:'not a date',impact:'High'}]])assert.throws(()=>mod.exports.parseForexFactoryCalendar(value));
});

test('Forex Factory remains independently connected when BLS fails without inventing Actual',async()=>{
 const source=ts.transpileModule(fs.readFileSync('app/api/macro/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const route={exports:{}};
 const deps=name=>name.endsWith('/auth')?{getCurrentUser:async()=>({id:1}),allowAuthAttempt:()=>true}:name.endsWith('/macro-ai')?{macroAiConfigured:()=>false,answerMacroQuestion:async()=>''}:mod.exports;
 new Function('exports','module','require','fetch','process',source)(route.exports,route,deps,async url=>{
   if(String(url).includes('faireconomy'))return Response.json([{title:'CPI m/m',country:'AUD',date:'2026-10-27T20:30:00-04:00',impact:'High',forecast:'0.7%',previous:'0.4%'}]);
   throw Error('BLS unavailable');
 },{env:{}});
 const response=await route.exports.GET();const body=await response.json();
 assert.equal(response.status,200);assert.equal(body.forexFactory.status,'connected');assert.equal(body.events.length,0);
 assert.equal(body.forexFactory.events[0].forecast,'0.7%');assert.equal(body.forexFactory.events[0].actual,null);
 assert.equal(body.forexFactory.sourceUrl,'https://www.forexfactory.com/calendar');
 assert.equal(response.headers.get('cache-control'),'private, no-store');
});
