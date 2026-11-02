import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, deps = {}) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('exports','module','require',code)(loaded.exports,loaded,name => name in deps ? deps[name] : require(name));
  return loaded.exports;
}
process.env.EXCHANGE_ENCRYPTION_KEY = '42'.repeat(32);
const vault = load('app/lib/exchanges/vault.ts');
const binance = load('app/lib/exchanges/binance.ts');
const accounts = load('app/lib/exchanges/accounts.ts', {'./binance': binance});
const credentials = { provider:'binance', apiKey:'a'.repeat(32), apiSecret:'b'.repeat(32) };
const Database = require('better-sqlite3');
const db = new Database(':memory:');
db.pragma('foreign_keys = ON');
db.exec("CREATE TABLE users (id TEXT PRIMARY KEY); INSERT INTO users VALUES ('alice'), ('bob')");
const store = load('app/lib/exchanges/store.ts', {'../auth':{database:db}, './vault':vault, './accounts':accounts});

test('vault authenticates ciphertext and binds credentials to owner/connection', () => {
  const sealed = vault.sealCredentials(credentials,'alice:1');
  assert.ok(!sealed.includes(credentials.apiSecret));
  assert.deepEqual(vault.openCredentials(sealed,'alice:1'),credentials);
  assert.throws(() => vault.openCredentials(sealed,'bob:1'));
  assert.throws(() => vault.openCredentials(sealed.slice(0,-2)+'ff','alice:1'));
  const original = process.env.EXCHANGE_ENCRYPTION_KEY;
  delete process.env.EXCHANGE_ENCRYPTION_KEY;
  assert.throws(() => vault.sealCredentials(credentials,'alice:1'),vault.VaultConfigurationError);
  process.env.EXCHANGE_ENCRYPTION_KEY = original;
});
test('connections isolate users, redact secrets, replace credentials and audit disconnects', () => {
  store.saveConnection('alice',credentials);
  const connection = store.listConnections('alice')[0];
  assert.equal(store.listConnections('bob').length,0);
  assert.equal(store.connectionCredentials('bob',connection.id),null);
  assert.equal(store.removeConnection('bob',connection.id),false);
  assert.ok(!JSON.stringify(connection).includes('apiSecret'));
  const updated = {...credentials,apiSecret:'c'.repeat(32)};
  store.saveConnection('alice',updated);
  assert.equal(store.listConnections('alice').length,1);
  assert.equal(store.listConnections('alice')[0].id,connection.id);
  assert.deepEqual(store.connectionCredentials('alice',connection.id),updated);
  assert.equal(store.removeConnection('alice',connection.id),true);
  assert.equal(store.connectionCredentials('alice',connection.id),null);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM connection_audit').get().n,3);
});
test('per-user trading risk settings persist exact USD limits and reject invalid caps', () => {
  const tradingDb = new Database(':memory:');
  tradingDb.exec("CREATE TABLE users (id TEXT PRIMARY KEY); INSERT INTO users VALUES ('alice'), ('bob')");
  const settings = load('app/lib/trading/settings.ts', {'../auth':{database:tradingDb}});
  assert.deepEqual(settings.getTradingRiskSettings('alice'),{maxOrderUsd:50,dailyLimitUsd:200,updatedAt:null});
  assert.deepEqual(settings.parseTradingRiskSettings({maxOrderUsd:125.5,dailyLimitUsd:500}),{maxOrderUsd:125.5,dailyLimitUsd:500});
  assert.equal(settings.parseTradingRiskSettings({maxOrderUsd:0.99,dailyLimitUsd:200}),null);
  assert.equal(settings.parseTradingRiskSettings({maxOrderUsd:100001,dailyLimitUsd:200000}),null);
  assert.equal(settings.parseTradingRiskSettings({maxOrderUsd:100,dailyLimitUsd:99}),null);
  assert.equal(settings.parseTradingRiskSettings({maxOrderUsd:1.001,dailyLimitUsd:200}),null);
  const saved = settings.saveTradingRiskSettings('alice',{maxOrderUsd:125.5,dailyLimitUsd:500});
  assert.equal(saved.maxOrderUsd,125.5);
  assert.equal(settings.getTradingRiskSettings('alice').dailyLimitUsd,500);
  assert.deepEqual(settings.getTradingRiskSettings('bob'),{maxOrderUsd:50,dailyLimitUsd:200,updatedAt:null});
  tradingDb.close();
});
test('credential validation rejects unsupported providers and injected headers', () => {
  assert.equal(accounts.parseAccountCredentials({...credentials,provider:'bank'}),null);
  assert.equal(accounts.parseAccountCredentials({...credentials,provider:'okx',passphrase:'bad\r\nheader'}),null);
  assert.equal(accounts.parseAccountCredentials({provider:'mt5',apiKey:'12345',apiSecret:'investor',passphrase:'OtherBroker'}),null);
  assert.ok(accounts.parseAccountCredentials({provider:'mt5',apiKey:'12345',apiSecret:'investor',passphrase:'Exness-MT5Real1'}));
});
test('Binance verifies permissions before requesting balances; signs GET requests', async () => {
  const requests=[];
  const mock = async (url,options) => {
    requests.push([String(url),options]);
    if(String(url).endsWith('/time'))return Response.json({serverTime:Date.now()});
    if(String(url).includes('apiRestrictions'))return Response.json({enableReading:true,enableWithdrawals:false,enableSpotAndMarginTrading:false});
    return Response.json({balances:[{asset:'BTC',free:'0.001',locked:'0.0002'},{asset:'ETH',free:'0',locked:'0'}]});
  };
  const snapshot=await binance.readBinanceAccount(credentials,mock);
  assert.equal(snapshot.balances.length,1);
  assert.equal(snapshot.balances[0].available,'0.001');
  assert.match(requests[1][0],/signature=[a-f0-9]{64}/);
  assert.equal(requests[1][1].headers['X-MBX-APIKEY'],credentials.apiKey);
  assert.ok(requests.every(([,options]) => !options.method || options.method==='GET'));
  assert.throws(() => binance.assertReadOnlyPermissions({enableReading:true,enableWithdrawals:true,enableSpotAndMarginTrading:false}));
  let accountRequested=false;
  await assert.rejects(binance.readBinanceAccount(credentials, async url => {
    if(String(url).endsWith('/time'))return Response.json({serverTime:Date.now()});
    if(String(url).includes('apiRestrictions'))return Response.json({enableReading:true,enableWithdrawals:false,enableSpotAndMarginTrading:true});
    accountRequested=true;return Response.json({balances:[]});
  }));
  assert.equal(accountRequested,false);
});
test('provider errors never expose credentials or raw provider response', async () => {
  await assert.rejects(binance.readBinanceAccount(credentials,async () => {throw new Error(credentials.apiSecret);}), error => !error.message.includes(credentials.apiSecret));
});
test('OKX enforces read-only permission and preserves balance strings', async () => {
  const c={provider:'okx',apiKey:'key-12345678',apiSecret:'secret-12345678',passphrase:'pass'};
  const calls=[];
  const snapshot=await accounts.readAccount(c,async (url,options) => {
    calls.push([url,options]);
    if(url.includes('/config'))return Response.json({code:'0',data:[{perm:'read_only'}]});
    return Response.json({code:'0',data:[{details:[{ccy:'USDT',availBal:'10.12345678',frozenBal:'2'}]}]});
  });
  assert.equal(snapshot.balances[0].available,'10.12345678');
  assert.ok(calls.every(([,o])=>o.method==='GET'));
  await assert.rejects(accounts.readAccount(c,async ()=>Response.json({code:'0',data:[{perm:'read_only,trade'}]})));
});
test('Bitget rejects write permissions and preserves locked/frozen separately', async () => {
  const c={provider:'bitget',apiKey:'key12345678',apiSecret:'secret12345678',passphrase:'pass'};
  const snapshot=await accounts.readAccount(c,async url => url.includes('/info') ? Response.json({code:'00000',data:{authorities:['readonly']}}) : Response.json({code:'00000',data:[{coin:'BTC',available:'0.1',locked:'0.2',frozen:'0.3'}]}));
  assert.equal(snapshot.balances[0].frozen,'0.3');
  await assert.rejects(accounts.readAccount(c,async ()=>Response.json({code:'00000',data:{authorities:['spot_trade']}})));
});
test('MT5 reads only configured bridge and validates account identity', async () => {
  process.env.MT5_BRIDGE_TOKEN='t'.repeat(32);
  process.env.MT5_BRIDGE_URL='http://127.0.0.1:8787';
  const c={provider:'mt5',apiKey:'12345',apiSecret:'investor',passphrase:'Exness-MT5Real1'};
  const snapshot=await accounts.readAccount(c,async (url, options) => {
    assert.equal(String(url),'http://127.0.0.1:8787/account');
    assert.equal(options.method,'POST');
    return Response.json({login:'12345',server:c.passphrase,currency:'USD',balance:'100',equity:'99',margin:'5',freeMargin:'94'});
  });
  assert.equal(snapshot.summary.equity,'99');
  await assert.rejects(accounts.readAccount(c,async ()=>Response.json({login:'999',server:c.passphrase})));
});
test('connection API rejects unauthenticated and cross-origin writes without contacting provider', async () => {
  const http=load('app/lib/auth-http.ts');
  let user=null,reads=0;
  const route=load('app/api/connections/route.ts', {'@/app/lib/auth':{getCurrentUser:async()=>user,allowAuthAttempt:()=>true},'@/app/lib/auth-http':http,'@/app/lib/exchanges/accounts':{...accounts,readAccount:async()=>{reads++;}},'@/app/lib/exchanges/binance':binance,'@/app/lib/exchanges/store':store,'@/app/lib/exchanges/vault':vault});
  assert.equal((await route.GET()).status,401);
  assert.equal((await route.POST(new Request('http://localhost/api/connections',{method:'POST',headers:{origin:'https://evil.example'}}))).status,403);
  assert.equal(reads,0);
  user={id:'alice'};
  assert.equal((await route.POST(new Request('http://localhost/api/connections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(credentials)}))).status,201);
  assert.equal(reads,1);
});
