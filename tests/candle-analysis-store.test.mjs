import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import { createDatabase, databaseAdapter } from './helpers/database-adapter.mjs';

const require = createRequire(import.meta.url);

test('candle analysis reports persist per user and retain the newest 100', async () => {
  const database = createDatabase();
  database.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').run('member-a','a@example.com','x');
  database.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').run('member-b','b@example.com','x');

  const compiledModule = { exports: {} };
  const file = path.resolve('app/lib/candle-analysis-store.ts');
  const javascript = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('exports', 'module', 'require', javascript)(
    compiledModule.exports,
    compiledModule,
    (name) => name === './database' ? databaseAdapter(database) : require(name),
  );
  const { listCandleAnalysisReports, saveCandleAnalysisReport } = compiledModule.exports;

  for (let index = 0; index < 101; index += 1) {
    await saveCandleAnalysisReport('member-a', {
      id: `report-${index}`,
      market: 'BTCUSDT',
      frame: '15m',
      generatedAt: index,
      candles: [],
    });
  }
  await saveCandleAnalysisReport('member-b', { id: 'private-report', market: 'BTCUSDT', frame: '15m', generatedAt: 200 });

  const memberReports = await listCandleAnalysisReports('member-a');
  assert.equal(memberReports.length, 100);
  assert.equal(memberReports[0].id, 'report-100');
  assert.equal(memberReports.at(-1).id, 'report-1');
  assert.deepEqual((await listCandleAnalysisReports('member-b')).map(({ id }) => id), ['private-report']);
  database.close();
});
