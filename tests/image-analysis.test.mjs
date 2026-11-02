import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import sharp from 'sharp';
import ts from 'typescript';
const require=createRequire(import.meta.url),cache=new Map();let user=null,allowed=true,calls=0;
const evidence={kind:'chart',readability:'partial',symbol:'BTCUSDT',timeframe:null,trend:'unclear',summary:'Some labels are unreadable.',visibleText:['BTCUSDT'],visibleValues:[{label:'Price',value:null,unit:'USDT'}],observations:['Candles visible'],limitations:['No readable timeframe']};
let network=async()=>{calls++;return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(evidence)}]}}]});};
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const compiled={exports:{}};cache.set(file,compiled);new Function('exports','module','require','fetch',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(compiled.exports,compiled,name=>name==='../../lib/auth'?{getCurrentUser:async()=>user,allowAuthAttempt:()=>allowed}:name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name),(...args)=>network(...args));return compiled.exports;}
const helper=load('app/lib/image-analysis.ts'),route=load('app/api/image-analysis/route.ts');
const image=async(format='png',width=120)=>{const bytes=await sharp({create:{width,height:100,channels:3,background:'#0b3d91'}}).toFormat(format).toBuffer();return `data:image/${format};base64,${bytes.toString('base64')}`;};
async function withConfig(fn){const saved={GEMINI_API_KEY:process.env.GEMINI_API_KEY,GEMINI_VISION_MODEL:process.env.GEMINI_VISION_MODEL,GEMINI_ANALYSIS_MODEL:process.env.GEMINI_ANALYSIS_MODEL};process.env.GEMINI_API_KEY='test-only-private-key';process.env.GEMINI_VISION_MODEL='gemini-test-vision-model';try{return await fn();}finally{for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}}
test('image validation decodes real PNG/WebP and checks declared MIME and dimension bounds',async()=>{
  const png=await image(),webp=await image('webp');assert.equal((await helper.validateAnalysisImage(png)).width,120);assert.equal((await helper.validateAnalysisImage(webp)).height,100);
  await assert.rejects(()=>helper.validateAnalysisImage(png.replace('image/png','image/jpeg')),error=>error.status===422);
  const wide=await image('png',4100);await assert.rejects(()=>helper.validateAnalysisImage(wide),error=>error.status===422);
});
test('remote URLs, SVG, malformed data, oversized files and truncated pixels are rejected before AI',async()=>{
  for(const bad of ['https://example.com/a.png','data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,!!!','data:image/png;base64,AAAA'])await assert.rejects(()=>helper.validateAnalysisImage(bad));
  const huge='data:image/png;base64,'+'A'.repeat(Math.ceil(helper.IMAGE_BYTES_LIMIT*4/3)+120);await assert.rejects(()=>helper.validateAnalysisImage(huge),e=>e.status===413);
  const bytes=Buffer.from((await image()).split(',')[1],'base64').subarray(0,55);await assert.rejects(()=>helper.validateAnalysisImage('data:image/png;base64,'+bytes.toString('base64')));
});
test('image output validation preserves missing values and rejects invalid numeric/array output',()=>{
  assert.equal(helper.validImageEvidence(evidence),true);assert.equal(helper.validImageEvidence({...evidence,visibleValues:[{label:'Price',value:123,unit:null}]}),false);assert.equal(helper.validImageEvidence({...evidence,readability:'guaranteed'}),false);
  assert.equal(helper.validImageEvidence({...evidence,entry:123,action:'BUY'}),false);
});
test('Gemini vision request uses inline image data with structured output and no remote URL fetching',async()=>withConfig(async()=>{
  const data=await image();let captured=false;
  const result=await helper.analyzeDataImage(data,'Read visible labels',async(url,options)=>{captured=true;assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-test-vision-model:generateContent');assert.equal(options.headers['x-goog-api-key'],'test-only-private-key');const body=JSON.parse(options.body);assert.equal(body.generationConfig.responseMimeType,'application/json');assert.equal(body.generationConfig.responseSchema.properties.symbol.nullable,true);assert.equal(body.contents[0].parts[1].inlineData.mimeType,'image/png');assert.equal(body.contents[0].parts[1].inlineData.data,data.split(',')[1]);return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(evidence)}]}}]});});assert.equal(captured,true);assert.equal(result.visibleValues[0].value,null);
}));
test('unreadable image output cannot expose invented values, symbols or direction; provider errors are sanitized',async()=>withConfig(async()=>{
  const bad={...evidence,readability:'unreadable',trend:'up',visibleValues:[{label:'Price',value:'1234',unit:'USD'}]};
  const result=await helper.analyzeDataImage(await image(),'',async()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(bad)}]}}]}));assert.equal(result.trend,'unclear');assert.equal(result.symbol,null);assert.deepEqual(result.visibleValues,[]);
  await assert.rejects(()=>helper.analyzeDataImage('data:image/png;base64,AAAA','',async()=>{throw Error('test-only-private-key');}),error=>error.status===502&&!error.message.includes('test-only-private-key'));
  await assert.rejects(()=>helper.analyzeDataImage('data:image/png;base64,AAAA','',async()=>Response.json({candidates:[]})),error=>error.status===502);
}));
const request=body=>new Request('http://localhost/api/image-analysis',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify(body)});
test('image route requires approved auth, same origin, rate limit and a vision configuration',async()=>{
  user=null;assert.equal((await route.POST(request({}))).status,401);user={id:'member'};
  assert.equal((await route.POST(new Request('http://localhost/api/image-analysis',{method:'POST',headers:{origin:'https://evil.example'}}))).status,403);
  allowed=false;assert.equal((await route.POST(request({}))).status,429);allowed=true;
  const key=process.env.GEMINI_API_KEY;delete process.env.GEMINI_API_KEY;try{assert.equal((await route.POST(request({}))).status,503);}finally{if(key!==undefined)process.env.GEMINI_API_KEY=key;}
});
test('image route only submits validated files and returns a non-executable image-only report',async()=>withConfig(async()=>{
  user={id:'member'};calls=0;
  assert.equal((await route.POST(request({image:'https://internal.local',question:''}))).status,400);assert.equal(calls,0);
  const data=await image();const response=await route.POST(request({image:data,question:'Read labels'}));const report=await response.json();assert.equal(response.status,200);assert.equal(calls,1);assert.equal(report.tradeAction,'WAIT');assert.equal(report.basis,'image-only');assert.equal(report.width,120);assert.equal(JSON.stringify(report).includes('base64'),false);assert.equal('entry' in report,false);
}));
