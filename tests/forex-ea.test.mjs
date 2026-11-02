import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(file, deps = {}) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function('exports', 'module', 'require', code)(loaded.exports, loaded, name => name in deps ? deps[name] : require(name));
  return loaded.exports;
}

const rules = load('app/lib/ea/forex-rules.ts');
const Database = require('better-sqlite3');
const authDb = new Database(':memory:');
authDb.exec(`CREATE TABLE users (id TEXT PRIMARY KEY);
INSERT INTO users (id) VALUES ('alice'), ('bob');`);
const strategyStore = load('app/lib/ea/forex-store.ts', {
  '../auth': { database: authDb },
  './forex-rules': rules,
});
class AdapterError extends Error {}
const accounts = load('app/lib/exchanges/accounts.ts', {
  './binance': {
    BinanceConnectionError: AdapterError,
    parseCredentials: () => null,
    readBinanceAccount: async () => null,
  },
});
const rule = {
  name: 'EMA + RSI',
  symbol: 'EURUSD',
  timeframe: '15m',
  higherTimeframe: '1h',
  buy: [{ left: { indicator: 'close' }, operator: 'above', right: { value: 0 } }],
  sell: [{ left: { indicator: 'close' }, operator: 'below', right: { value: 0 } }],
  stopAtr: 1.5,
};

function candles(count, direction = 1) {
  const timeframe = 15 * 60 * 1000;
  const baseTime = Math.floor((Date.now() - count * timeframe) / timeframe) * timeframe;
  return Array.from({ length: count }, (_, index) => {
    const close = 1.1 + (direction * index * 0.0001);
    return {
      time: baseTime + (index + 1) * timeframe,
      open: close - direction * 0.00002,
      high: close + 0.00005,
      low: close - 0.00005,
      close,
      volume: 100,
    };
  });
}

test('Forex visual rules accept only supported markets, periods and 1h confirmation', () => {
  assert.deepEqual(rules.parseForexRule(rule), rule);
  assert.equal(rules.parseForexRule({ ...rule, symbol: 'US30' }), null);
  assert.equal(rules.parseForexRule({ ...rule, higherTimeframe: '4h' }), null);
  assert.equal(rules.parseForexRule({ ...rule, buy: [{ ...rule.buy[0], left: { indicator: 'ema', period: 101 } }] }), null);
  assert.equal(rules.parseForexRule({ ...rule, buy: [{ left: { value: 3 }, operator: 'above', right: { value: 4 } }] }), null);
});

test('Forex signal is calculated only after 1h trend confirmation and applies fixed 2R levels', () => {
  const signal = rules.evaluateForexRule(candles(500), rule);
  assert.equal(signal.action, 'BUY');
  assert.equal(signal.candleTime, candles(500).at(-1).time);
  assert.ok(signal.stopLoss < signal.entry);
  assert.ok(signal.takeProfit > signal.entry);
  assert.ok(Math.abs((signal.takeProfit - signal.entry) / (signal.entry - signal.stopLoss) - 2) < 1e-8);
});

test('Forex signal waits when the 1h EMA20 trend disagrees', () => {
  const signal = rules.evaluateForexRule(candles(500, -1), rule);
  assert.equal(signal.action, 'WAIT');
  assert.match(signal.reason, /trend 1h/);
});

test('Forex signal rejects malformed or insufficient candles', () => {
  assert.equal(rules.evaluateForexRule(candles(100), rule).action, 'WAIT');
  const duplicateTime = candles(120);
  duplicateTime[100].time = duplicateTime[99].time;
  assert.equal(rules.evaluateForexRule(duplicateTime, rule).action, 'WAIT');
  const stale = candles(120);
  stale.forEach(candle => { candle.time -= 3 * 60 * 60 * 1000; });
  assert.equal(rules.evaluateForexRule(stale, rule).action, 'WAIT');
});

test('Forex strategies are user-scoped and admin templates can be cloned', () => {
  const personal = strategyStore.saveForexStrategy('alice', rule);
  assert.equal(strategyStore.listForexStrategies('alice').length, 1);
  assert.equal(strategyStore.listForexStrategies('bob').length, 0);
  assert.throws(() => strategyStore.saveForexStrategy('bob', rule, personal.id));
  const shared = strategyStore.saveForexStrategy('alice', { ...rule, name: 'Approved template' }, undefined, true, true);
  assert.equal(strategyStore.listForexStrategies('bob')[0].isTemplate, true);
  assert.throws(() => strategyStore.deleteForexStrategy('bob', shared.id, false));
  assert.equal(strategyStore.deleteForexStrategy('alice', shared.id, true), true);
  assert.throws(() => strategyStore.deleteForexStrategy('bob', personal.id, false));
});

test('MT5 candle adapter calls only the private closed-candle route and validates the response', async () => {
  process.env.MT5_BRIDGE_TOKEN = 't'.repeat(40);
  const credentials = { provider: 'mt5', apiKey: '12345', apiSecret: 'investor-password', passphrase: 'Exness-MT5Trial' };
  let calledUrl;
  const response = await accounts.readMt5ForexCandles(credentials, 'XAUUSD', async (url, options) => {
    calledUrl = String(url);
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.equal(JSON.parse(options.body).symbol, 'XAUUSD');
    const data = { symbol: 'XAUUSD', brokerSymbol: 'XAUUSDm', timeframe: '15m', candles: candles(120) };
    return { ok: true, json: async () => data };
  });
  assert.equal(calledUrl, 'http://127.0.0.1:8787/candles');
  assert.equal(response.brokerSymbol, 'XAUUSDm');
  assert.equal(response.candles.length, 120);
  await assert.rejects(() => accounts.readMt5ForexCandles({ ...credentials, provider: 'binance' }, 'XAUUSD'), AdapterError);
  await assert.rejects(() => accounts.readMt5ForexCandles(credentials, 'XAUUSD', async () => ({
    ok: true, json: async () => ({ symbol: 'XAUUSD', brokerSymbol: 'XAUUSDm', timeframe: '15m', candles: [] }),
  })), AdapterError);
});
