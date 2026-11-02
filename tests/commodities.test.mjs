import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
let currentUser = null;
let fetcher = async () => Response.json({});
const route = { exports: {} };
new Function(
  'exports',
  'module',
  'require',
  'fetch',
  ts.transpileModule(fs.readFileSync('app/api/commodities/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
)(
  route.exports,
  route,
  (name) => name.includes('lib/auth') ? { getCurrentUser: async () => currentUser } : require(name),
  (...args) => fetcher(...args),
);

function providerResponse(symbol) {
  const prices = { 'GC=F': 4100, 'SI=F': 48, 'CL=F': 72, 'BZ=F': 77 };
  const price = prices[symbol];
  return Response.json({
    chart: {
      result: [{
        meta: {
          currency: 'USD',
          regularMarketPrice: price,
          regularMarketTime: 1_800_000_000,
          previousClose: price - 2,
          chartPreviousClose: price - 20,
        },
        timestamp: [1_799_827_200, 1_799_913_600],
        indicators: { quote: [{ close: [price - 4, price - 2] }] },
      }],
    },
  });
}

test('commodities endpoint requires an approved signed-in user', async () => {
  currentUser = null;
  const response = await route.exports.GET();
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('commodities endpoint returns validated gold, silver, WTI and Brent reference quotes', async () => {
  currentUser = { id: 'test-user' };
  const requested = [];
  fetcher = async (url) => {
    const symbol = decodeURIComponent(new URL(url).pathname.split('/').at(-1));
    requested.push(symbol);
    return providerResponse(symbol);
  };

  const response = await route.exports.GET();
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.source, 'Yahoo Finance futures reference');
  assert.deepEqual(requested.sort(), ['BZ=F', 'CL=F', 'GC=F', 'SI=F']);
  assert.deepEqual(body.commodities.map(({ id }) => id).sort(), ['brent', 'gold', 'silver', 'wti']);
  assert.equal(body.commodities.find(({ id }) => id === 'gold').price, 4100);
  assert.equal(body.commodities.find(({ id }) => id === 'gold').change, 2);
  assert.equal(body.commodities.find(({ id }) => id === 'gold').changePercent, 2 / 4098 * 100);
  assert.equal(body.commodities.find(({ id }) => id === 'wti').unit, 'USD / barrel');
  assert.equal(body.commodities.find(({ id }) => id === 'brent').history.length, 2);
  assert.deepEqual(body.unavailable, []);
});

test('commodities endpoint reports partial outages and errors when every quote fails', async () => {
  currentUser = { id: 'test-user' };
  fetcher = async (url) => {
    if (decodeURIComponent(new URL(url).pathname.split('/').at(-1)) === 'CL=F') {
      return new Response('Unavailable', { status: 503 });
    }
    return providerResponse(decodeURIComponent(new URL(url).pathname.split('/').at(-1)));
  };

  const partial = await route.exports.GET();
  const partialBody = await partial.json();
  assert.equal(partial.status, 200);
  assert.deepEqual(partialBody.unavailable, ['wti']);
  assert.equal(partialBody.commodities.length, 3);

  fetcher = async () => new Response('Unavailable', { status: 503 });
  const failed = await route.exports.GET();
  assert.equal(failed.status, 502);
  assert.match((await failed.json()).error, /មាស និងប្រេង/);
});

test('daily change uses the prior daily bar when previousClose is absent, never the month baseline', async () => {
  currentUser = { id: 'test-user' };
  fetcher = async (url) => {
    const symbol = decodeURIComponent(new URL(url).pathname.split('/').at(-1));
    const payload = await providerResponse(symbol).json();
    delete payload.chart.result[0].meta.previousClose;
    // Include today's incomplete daily bar: it must not become the comparison close.
    payload.chart.result[0].timestamp.push(1_800_000_000);
    payload.chart.result[0].indicators.quote[0].close.push(9999);
    return Response.json(payload);
  };
  const response = await route.exports.GET();
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.commodities.find(quote => quote.id === 'gold').change, 2);
  assert.equal(body.commodities.find(quote => quote.id === 'silver').unit, 'USD / troy oz');
});
