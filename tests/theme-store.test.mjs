import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

class StorageEventStub extends Event { constructor(key) { super('storage'); this.key=key; } }
function setup(blocked=false) {
  const data=new Map();
  const events=new EventTarget();
  const win={localStorage:{getItem:key=>{if(blocked)throw Error('Blocked');return data.get(key)??null;},setItem:(key,value)=>{if(blocked)throw Error('Blocked');data.set(key,value);}},addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),dispatchEvent:events.dispatchEvent.bind(events)};
  const compiled={exports:{}};
  new Function('exports','module','window','StorageEvent','CustomEvent',ts.transpileModule(fs.readFileSync('app/theme-store.ts','utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText)(compiled.exports,compiled,win,StorageEventStub,CustomEvent);
  return {...compiled.exports,win,data};
}
test('the shared appearance store accepts only normal and dark; defaults to normal',()=>{
  const s=setup();assert.equal(s.readAppTheme(),'light');assert.equal(s.serverAppTheme(),'light');
  s.data.set('market-theme','wood');assert.equal(s.readAppTheme(),'light');
  s.setAppTheme('dark');assert.equal(s.readAppTheme(),'dark');
  s.setAppTheme('invalid');assert.equal(s.readAppTheme(),'dark');
  s.toggleAppTheme();assert.equal(s.readAppTheme(),'light');
});
test('all subscribers receive local changes and storage changes, then unsubscribe cleanly',()=>{
  const s=setup();let first=0,second=0;
  const stop=s.subscribeAppTheme(()=>first++);s.subscribeAppTheme(()=>second++);
  s.setAppTheme('dark');assert.equal(first,1);assert.equal(second,1);
  s.win.dispatchEvent(new StorageEventStub('unrelated'));assert.equal(first,1);
  s.win.dispatchEvent(new CustomEvent('market-storage-change',{detail:'market-favorites'}));assert.equal(first,1);
  s.win.dispatchEvent(new StorageEventStub('market-theme'));assert.equal(first,2);
  s.win.dispatchEvent(new StorageEventStub(null));assert.equal(first,3);
  stop();s.setAppTheme('light');assert.equal(first,3);assert.equal(second,4);
});
test('appearance switches still work in memory when browser storage is unavailable',()=>{
  const s=setup(true);s.setAppTheme('dark');assert.equal(s.readAppTheme(),'dark');
  s.toggleAppTheme();assert.equal(s.readAppTheme(),'light');
});
