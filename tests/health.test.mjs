import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

test('health endpoint checks production auth configuration and database availability', async () => {
  const source = ts.transpileModule(fs.readFileSync('app/api/health/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const route = { exports: {} };
  let configured = true;
  const dependencies = () => ({
    assertAuthConfigured: () => { if (!configured) throw Error('missing configuration'); },
    database: { prepare: query => ({ get: () => { assert.equal(query, 'SELECT 1'); return { 1: 1 }; } }) },
  });
  new Function('exports', 'module', 'require', source)(route.exports, route, dependencies);
  const ready = route.exports.GET();
  assert.equal(ready.status, 200);
  assert.deepEqual(await ready.json(), { status: 'ok' });
  assert.equal(ready.headers.get('cache-control'), 'no-store');
  configured = false;
  assert.equal(route.exports.GET().status, 503);
});
