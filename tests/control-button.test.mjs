import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const compiled={exports:{}};
new Function('exports','module','require',ts.transpileModule(fs.readFileSync('app/ControlButton.tsx','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
}).outputText)(compiled.exports,compiled,require);
const Button=compiled.exports.default;
test('shared controls default to a non-submitting secondary button',()=>{
 const element=Button({children:'Refresh'});assert.equal(element.type,'button');
 assert.equal(element.props.type,'button');assert.equal(element.props['data-ui-control'],'secondary');assert.equal(element.props.children,'Refresh');
});
test('submit controls remain native submit buttons and use the primary treatment',()=>{
 const element=Button({type:'submit',disabled:true,children:'Save'});
 assert.equal(element.props.type,'submit');assert.equal(element.props.disabled,true);assert.equal(element.props['data-ui-control'],'primary');
});
test('handlers, refs, class names and accessibility state survive migration',()=>{
 const ref={current:null},onClick=()=>{},onKeyDown=()=>{};
 const element=Button({variant:'danger',controlSize:'icon',ref,onClick,onKeyDown,className:'existing-class','aria-label':'Disconnect','aria-pressed':true});
 assert.equal(element.props.ref,ref);assert.equal(element.props.onClick,onClick);assert.equal(element.props.onKeyDown,onKeyDown);
 assert.equal(element.props.className,'existing-class');assert.equal(element.props['aria-label'],'Disconnect');assert.equal(element.props['aria-pressed'],true);
 assert.equal(element.props['data-ui-control'],'danger');assert.equal(element.props['data-ui-size'],'icon');
});
