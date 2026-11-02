import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
function compile(path,deps=()=>{throw Error('Unexpected import');},fetcher=fetch){const out={exports:{}};new Function('exports','module','require','fetch',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(out.exports,out,deps,fetcher);return out.exports;}
const lib=compile('app/lib/bloomberg.ts');
const item=(title='Example &amp; news',url='https://www.bloomberg.com/news/articles/example',date='Wed, 28 Oct 2026 08:00:00 GMT')=>`<item><title><![CDATA[${title}]]></title><link>${url}</link><pubDate>${date}</pubDate></item>`;
const rss=body=>`<?xml version="1.0"?><rss version="2.0"><channel>${body}</channel></rss>`;
test('Bloomberg RSS decodes plain titles, validates dates and deduplicates links',()=>{
 const rows=lib.parseBloombergHeadlines(rss(item()+item()+item('Later &#38; news','https://bloomberg.com/news/articles/later','Wed, 28 Oct 2026 09:00:00 GMT')));
 assert.equal(rows.length,2);assert.equal(rows[0].title,'Later & news');assert.equal(rows[1].title,'Example & news');assert.equal(rows[0].publishedAt,'2026-10-28T09:00:00.000Z');
});
test('RSS rejects external/unsafe links, malformed XML and entity definitions; limits public headlines',()=>{
 const invalid=[item('x','javascript:alert(1)'),item('x','https://www.bloomberg.com.evil.test/x'),item('x','https://user@bloomberg.com/x'),item('x','https://bloomberg.com:8443/x'),item('x','https://www.bloomberg.com/x','invalid')].join('');
 const rows=lib.parseBloombergHeadlines(rss(invalid+item()));assert.equal(rows.length,1);
 assert.equal(lib.parseBloombergHeadlines(rss(Array.from({length:12},(_,i)=>item('Example '+i,`https://www.bloomberg.com/news/${i}`)).join(''))).length,6);
 for(const xml of ['<html>Unavailable</html>',rss(''),'<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///secret">]>'+rss(item()),rss(item()).slice(0,-6)])assert.throws(()=>lib.parseBloombergHeadlines(xml));
});
test('public news endpoint reads only the canonical feed and returns safe unavailable state',async()=>{
 let fail=false;let seen;
 const route=compile('app/api/news/route.ts',()=>lib,async(url,options)=>{seen={url,options};return fail?new Response('Unavailable',{status:503}):new Response(rss(item()));});
 const ok=await route.GET();assert.equal(ok.status,200);assert.equal(seen.url,lib.BLOOMBERG_FEED);assert.equal(seen.options.redirect,'error');assert.equal((await ok.json()).headlines.length,1);assert.match(ok.headers.get('cache-control'),/public/);
 fail=true;const unavailable=await route.GET();assert.equal(unavailable.status,503);assert.equal(unavailable.headers.get('cache-control'),'no-store');assert.equal('headlines' in await unavailable.json(),false);
});
