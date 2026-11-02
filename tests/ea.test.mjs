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

process.env.EXCHANGE_ENCRYPTION_KEY = '42'.repeat(32);
const vault = load('app/lib/exchanges/vault.ts');
const Database = require('better-sqlite3');
const authDb = new Database(':memory:');
authDb.exec(`CREATE TABLE users (
  id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'approved',
  access_enabled INTEGER NOT NULL DEFAULT 1, email_verified INTEGER NOT NULL DEFAULT 1
);
INSERT INTO users (id) VALUES ('alice'), ('bob');`);
const store = load('app/lib/ea/store.ts', { '../auth': { database: authDb }, '../exchanges/vault': vault });
const futures = load('app/lib/ea/binance-futures.ts');
const strategy = load('app/strategy.ts');
const risk = load('app/lib/ea/risk.ts', { '../../strategy': strategy, './binance-futures': futures });

const credentials = { apiKey: 'a'.repeat(32), apiSecret: 'b'.repeat(32) };
const settings = { symbol: 'BTCUSDT', capitalUsd: 1000, riskPercent: 1, leverage: 5, enabled: false };

test('EA settings enforce bounded risk, supported symbols and disabled defaults', () => {
  assert.deepEqual(store.getEaSettings('alice'), { symbol: 'BTCUSDT', capitalUsd: 100, riskPercent: 1, leverage: 3, enabled: false, updatedAt: null });
  assert.deepEqual(store.parseEaSettings(settings), settings);
  assert.equal(store.parseEaSettings({ ...settings, riskPercent: 1.1 }), null);
  assert.equal(store.parseEaSettings({ ...settings, leverage: 6 }), null);
  assert.equal(store.parseEaSettings({ ...settings, symbol: 'DOGEUSDT' }), null);
  assert.equal(store.parseEaSettings({ ...settings, capitalUsd: 1.001 }), null);
  assert.equal(store.parseEaCredentials({ ...credentials, apiSecret: 'short' }), null);
});

test('EA credentials are encrypted per user and re-keying disables the bot until reverified', () => {
  store.saveEaSettings('alice', settings, credentials);
  assert.equal(store.hasEaCredentials('alice'), true);
  assert.deepEqual(store.getEaCredentials('alice'), credentials);
  assert.equal(store.getEaCredentials('bob'), null);
  const encrypted = authDb.prepare('SELECT encrypted_credentials FROM ea_bot_credentials WHERE user_id=?').get('alice').encrypted_credentials;
  assert.ok(!encrypted.includes(credentials.apiSecret));
  assert.throws(() => store.saveEaSettings('alice', { ...settings, enabled: true }));
  store.markEaTestnetVerified('alice');
  store.saveEaSettings('alice', { ...settings, enabled: true });
  assert.equal(store.getEaSettings('alice').enabled, true);
  store.saveEaSettings('alice', settings, { ...credentials, apiSecret: 'c'.repeat(32) });
  assert.equal(store.getEaSettings('alice').enabled, false);
  assert.equal(store.isEaTestnetVerified('alice'), false);
  assert.equal(store.listEnabledEaUsers().length, 0);
});

test('Binance Futures requests are pinned to Testnet and sign private calls', async () => {
  const requests = [];
  const client = new futures.BinanceFuturesTestnet(credentials, async (url, options) => {
    requests.push([String(url), options]);
    if (String(url).endsWith('/fapi/v1/time')) return Response.json({ serverTime: Date.now() });
    if (String(url).includes('/fapi/v2/account')) return Response.json({ availableBalance: '1000', totalWalletBalance: '1000', totalUnrealizedProfit: '0', positions: [] });
    if (String(url).includes('/positionSide/dual')) return Response.json({ dualSidePosition: false });
    return Response.json([]);
  });
  await client.verifyAccount();
  assert.ok(requests.every(([url]) => url.startsWith('https://testnet.binancefuture.com/')));
  const accountCall = requests.find(([url]) => url.includes('/fapi/v2/account'));
  assert.match(accountCall[0], /signature=[a-f0-9]{64}/);
  assert.equal(accountCall[1].headers['X-MBX-APIKEY'], credentials.apiKey);
});

test('Testnet PnL includes trading income, rejects incomplete history and uses Phnom Penh day boundaries', async () => {
  const start = Date.UTC(2026, 0, 1, 17);
  const now = start + 86400000;
  const client = new futures.BinanceFuturesTestnet(credentials, async url => {
    if (String(url).endsWith('/fapi/v1/time')) return Response.json({ serverTime: now });
    return Response.json([
      { incomeType: 'REALIZED_PNL', income: '12.5', time: start + 1 },
      { incomeType: 'COMMISSION', income: '-1.5', time: start + 2 },
      { incomeType: 'TRANSFER', income: '500', time: start + 3 },
    ]);
  });
  assert.equal(await client.getDailyRealizedPnl(start, now), 11);
  assert.equal(futures.phnomPenhDayKey(Date.UTC(2026, 0, 1, 18)), '2026-01-02');
  assert.equal(futures.phnomPenhDayStart(Date.UTC(2026, 0, 1, 18)), Date.UTC(2026, 0, 1, 17));
  const full = new futures.BinanceFuturesTestnet(credentials, async url => String(url).endsWith('/fapi/v1/time')
    ? Response.json({ serverTime: now })
    : Response.json(Array.from({ length: 1000 }, () => ({ incomeType: 'REALIZED_PNL', income: '1', time: start + 1 }))));
  await assert.rejects(full.getDailyRealizedPnl(start, now), /history is incomplete/);
  const unknown = new futures.BinanceFuturesTestnet(credentials, async url => String(url).endsWith('/fapi/v1/time')
    ? Response.json({ serverTime: now })
    : Response.json([{ incomeType: 'NEW_UNKNOWN_TYPE', income: '1', time: start + 1 }]));
  await assert.rejects(unknown.getDailyRealizedPnl(start, now), /unsupported income type/);
});

test('order sizing respects daily guards, margin, leverage, and lot size', () => {
  const signal = { action: 'BUY', entry: 100, stopLoss: 95, takeProfit: 110 };
  const account = { availableBalance: 1000, totalWalletBalance: 1010, totalUnrealizedProfit: 0, positions: [] };
  const rules = { stepSize: 0.01, minQty: 0.01, tickSize: 0.1, minNotional: 5 };
  const decision = risk.decideEaOrder({ signal, settings, account, baselineEquity: 1000, markPrice: 100, rules });
  assert.equal(decision.allowed, true);
  assert.equal(Math.round(decision.quantity * 100), decision.quantity * 100);
  assert.ok(decision.quantity * (5 + (100 + 95) * 0.001) <= 10);
  assert.equal(risk.decideEaOrder({ signal, settings, account: { ...account, totalWalletBalance: 1000 }, baselineEquity: 1000, markPrice: 100, rules }).allowed, false);
  assert.match(risk.decideEaOrder({ signal, settings, account: { ...account, totalWalletBalance: 970 }, baselineEquity: 1000, markPrice: 100, rules }).reason, /3%/);
  assert.equal(risk.decideEaOrder({ signal, settings, account: { ...account, positions: [{ symbol: 'ETHUSDT', positionAmt: 1, positionSide: 'BOTH' }] }, baselineEquity: 1000, markPrice: 100, rules }).allowed, false);
  assert.equal(risk.decideEaOrder({ signal, settings, account, baselineEquity: 1000, markPrice: 101, rules }).allowed, false);
});

test('protective order tick rounding and quantity formatting remain decimal strings', async () => {
  const calls = [];
  const client = new futures.BinanceFuturesTestnet(credentials, async (url, options) => {
    calls.push([String(url), options]);
    if (String(url).endsWith('/fapi/v1/time')) return Response.json({ serverTime: Date.now() });
    return Response.json({ orderId: 7, clientOrderId: 'RFXtest', status: 'NEW', executedQty: '0', avgPrice: '0' });
  });
  await client.placeCloseProtection('BTCUSDT', 'SELL', 'STOP_MARKET', 100.05, 0.1, 'RFXstop');
  await client.placeCloseProtection('BTCUSDT', 'SELL', 'TAKE_PROFIT_MARKET', 110.01, 0.1, 'RFXtake');
  await client.placeMarketOrder('BTCUSDT', 'BUY', 0.00000001, 'RFXentry');
  const stops = calls.filter(([url]) => url.includes('/fapi/v1/order?'));
  assert.match(stops[0][0], /stopPrice=100\.0/);
  assert.match(stops[1][0], /stopPrice=110\.1/);
  assert.match(stops[2][0], /quantity=0\.00000001/);
  assert.ok(stops.every(([url]) => url.startsWith('https://testnet.binancefuture.com/')));
});
