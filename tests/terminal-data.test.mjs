import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const compiled = { exports: {} };
new Function('exports', 'module', ts.transpileModule(fs.readFileSync('app/terminal-data.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(compiled.exports, compiled);
const { validTerminalAssets, formatChange } = compiled.exports;
const asset = {
  id:'bitcoin', name:'Bitcoin', symbol:'btc', image:'/btc.png', current_price:100,
  market_cap:1000, total_volume:50, price_change_percentage_24h:null,
  price_change_percentage_7d_in_currency:2, sparkline_in_7d:{price:[98,100]},
};
test('missing changes are unavailable rather than a reported zero return', () => {
  assert.equal(formatChange(null), '—');
  assert.equal(formatChange(NaN), '—');
  assert.equal(formatChange(0), '+0.00%');
  assert.equal(formatChange(-1.25), '-1.25%');
});
test('market cards accept valid empty/loading data and reject malformed provider assets', () => {
  assert.equal(validTerminalAssets([]), true);
  assert.equal(validTerminalAssets([asset]), true);
  for (const invalid of [null, {}, [null], [asset,asset], [{...asset,current_price:Infinity}],
    [{...asset,total_volume:-1}], [{...asset,sparkline_in_7d:{price:[NaN]}}],
    [{...asset,price_change_percentage_24h:'2'}]]) {
    assert.equal(validTerminalAssets(invalid), false);
  }
});
