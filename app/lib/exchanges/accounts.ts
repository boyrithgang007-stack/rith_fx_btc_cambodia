import { createHmac } from "node:crypto";
import { BinanceConnectionError, parseCredentials as parseBinance, readBinanceAccount } from "./binance";
import type { ForexSymbol } from "../ea/forex-rules";
import type { Candle } from "../../strategy";

export const providers = ["binance", "okx", "bitget", "mt5"] as const;
export type Provider = typeof providers[number];
export type AccountCredentials = { provider: Provider; apiKey: string; apiSecret: string; passphrase?: string };
export type AccountSnapshot = { balances: { asset: string; available: string; locked: string; frozen?: string }[]; observedAt: string; summary?: { currency: string; balance: string; equity: string; margin: string; freeMargin: string } };

export function parseAccountCredentials(value: unknown): AccountCredentials | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!providers.includes(v.provider as Provider)) return null;
  if (v.provider === "mt5") {
    if (typeof v.apiKey !== "string" || !/^\d{1,15}$/.test(v.apiKey) || Number(v.apiKey) <= 0 || typeof v.apiSecret !== "string" || v.apiSecret.length < 1 || v.apiSecret.length > 256 || typeof v.passphrase !== "string" || !/^Exness[A-Za-z0-9 ._-]{1,100}$/i.test(v.passphrase)) return null;
  } else if (v.provider === "binance") {
    if (!parseBinance(v)) return null;
  } else {
    if (typeof v.apiKey !== "string" || typeof v.apiSecret !== "string" || ![v.apiKey,v.apiSecret].every(s => /^[A-Za-z0-9_-]{8,256}$/.test(s)) || typeof v.passphrase !== "string" || v.passphrase.length < 1 || v.passphrase.length > 128 || /[\r\n\x00-\x1f]/.test(v.passphrase)) return null;
  }
  return { provider: v.provider as Provider, apiKey: v.apiKey as string, apiSecret: v.apiSecret as string, ...(v.provider !== "binance" ? { passphrase: v.passphrase as string } : {}) };
}

function amount(value: unknown, signed = false) {
  if (typeof value !== "string" || !(signed ? /^-?\d+(\.\d+)?$/ : /^\d+(\.\d+)?$/).test(value) || !Number.isFinite(Number(value))) throw new BinanceConnectionError("Invalid provider balance response.");
  return value;
}

function asset(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z0-9]{1,32}$/.test(value)) throw new BinanceConnectionError("Invalid provider asset response.");
  return value;
}

async function providerGet(c: AccountCredentials, path: string, fetcher: typeof fetch) {
  const okx = c.provider === "okx";
  const timestamp = okx ? new Date().toISOString() : String(Date.now());
  const signature = createHmac("sha256", c.apiSecret).update(timestamp + "GET" + path).digest("base64");
  const headers: Record<string,string> = okx ? { "OK-ACCESS-KEY": c.apiKey, "OK-ACCESS-SIGN": signature, "OK-ACCESS-TIMESTAMP": timestamp, "OK-ACCESS-PASSPHRASE": c.passphrase! } : { "ACCESS-KEY": c.apiKey, "ACCESS-SIGN": signature, "ACCESS-TIMESTAMP": timestamp, "ACCESS-PASSPHRASE": c.passphrase! };
  const result = await fetcher(`${okx ? "https://www.okx.com" : "https://api.bitget.com"}${path}`, { headers, method: "GET", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
  if (!result.ok) throw new BinanceConnectionError("Exchange rejected the request. Check credentials, IP restrictions and regional availability.");
  const data = await result.json();
  if (data.code !== (okx ? "0" : "00000")) throw new BinanceConnectionError("Exchange rejected credentials or account permissions.");
  return data.data;
}

export async function readAccount(c: AccountCredentials, fetcher: typeof fetch = fetch): Promise<AccountSnapshot> {
  try {
    if (c.provider === "binance") return await readBinanceAccount(c, fetcher);
    if (c.provider === "mt5") {
      const url = new URL(process.env.MT5_BRIDGE_URL || "http://127.0.0.1:8787");
      if (url.username || url.password || url.search || url.hash || url.pathname !== "/" || !(url.protocol === "https:" || (url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname)))) throw new BinanceConnectionError("MT5 bridge requires HTTPS or local loopback.");
      const token = process.env.MT5_BRIDGE_TOKEN;
      if (!token || token.length < 32) throw new BinanceConnectionError("The administrator must configure the Exness MT5 bridge first.");
      const response = await fetcher(new URL("/account",url), { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ login: c.apiKey, password: c.apiSecret, server: c.passphrase }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(25000) });
      if (!response.ok) throw new BinanceConnectionError("MT5 bridge could not verify this investor account. Check terminal, server and investor password.");
      const data = await response.json();
      if (String(data.login) !== c.apiKey || data.server !== c.passphrase) throw new BinanceConnectionError("MT5 returned a different account.");
      return { balances: [], observedAt: new Date().toISOString(), summary: { currency: asset(data.currency), balance: amount(data.balance,true), equity: amount(data.equity,true), margin: amount(data.margin), freeMargin: amount(data.freeMargin,true) } };
    }
    let balances: AccountSnapshot["balances"];
    if (c.provider === "okx") {
      const config = await providerGet(c, "/api/v5/account/config", fetcher);
      if (!Array.isArray(config) || config[0]?.perm !== "read_only") throw new BinanceConnectionError("Use an OKX API key with Read permission only.");
      const data = await providerGet(c, "/api/v5/account/balance", fetcher);
      if (!Array.isArray(data) || !Array.isArray(data[0]?.details)) throw new BinanceConnectionError("Invalid OKX account response.");
      balances = data[0].details.map((b: Record<string,unknown>) => ({ asset: asset(b.ccy), available: amount(b.availBal === "" ? "0" : b.availBal), locked: amount(b.frozenBal === "" ? "0" : b.frozenBal) }));
    } else {
      const config = await providerGet(c, "/api/v2/spot/account/info", fetcher);
      if (!Array.isArray(config?.authorities) || !config.authorities.length || config.authorities.some((p: unknown) => typeof p !== "string" || !["readonly", "read_only", "spot_read", "contract_read"].includes(p))) throw new BinanceConnectionError("Use a Bitget API key with read-only permissions. Trading, withdrawals and transfers must be disabled.");
      const data = await providerGet(c, "/api/v2/spot/account/assets", fetcher);
      if (!Array.isArray(data)) throw new BinanceConnectionError("Invalid Bitget account response.");
      balances = data.map((b: Record<string,unknown>) => ({ asset: asset(b.coin), available: amount(b.available), locked: amount(b.locked), frozen: amount(b.frozen) }));
    }
    return { balances: balances.filter(b => Number(b.available) !== 0 || Number(b.locked) !== 0 || Number(b.frozen ?? 0) !== 0), observedAt: new Date().toISOString() };
  } catch(error) {
    if (error instanceof BinanceConnectionError) throw error;
    throw new BinanceConnectionError("Unable to contact the account provider. Retry later.");
  }
}

export async function readMt5ForexCandles(c: AccountCredentials, symbol: ForexSymbol, fetcher: typeof fetch = fetch) {
  if (c.provider !== "mt5") throw new BinanceConnectionError("Choose a connected Exness MT5 account.");
  try {
    const url = new URL(process.env.MT5_BRIDGE_URL || "http://127.0.0.1:8787");
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/" || !(url.protocol === "https:" || (url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname)))) {
      throw new BinanceConnectionError("MT5 bridge requires HTTPS or local loopback.");
    }
    const token = process.env.MT5_BRIDGE_TOKEN;
    if (!token || token.length < 32) throw new BinanceConnectionError("The administrator must configure the Exness MT5 bridge first.");
    const response = await fetcher(new URL("/candles", url), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ login: c.apiKey, password: c.apiSecret, server: c.passphrase, symbol, count: 1000 }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new BinanceConnectionError(typeof body?.error === "string" ? body.error : "MT5 bridge could not retrieve Forex candles.");
    }
    const data = await response.json();
    if (data.symbol !== symbol || data.timeframe !== "15m" || typeof data.brokerSymbol !== "string"
      || !Array.isArray(data.candles) || data.candles.length < 100 || data.candles.length > 1000) {
      throw new BinanceConnectionError("MT5 returned an invalid Forex candle response.");
    }
    const candles = data.candles as Candle[];
    if (candles.some(candle => !candle || ![candle.time, candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite)
      || candle.time <= 0 || candle.open <= 0 || candle.high < Math.max(candle.open, candle.close)
      || candle.low > Math.min(candle.open, candle.close) || candle.low <= 0)
      || candles.some((candle, index) => index > 0 && candle.time <= candles[index - 1].time)) {
      throw new BinanceConnectionError("MT5 returned invalid or unordered Forex candles.");
    }
    return { candles, brokerSymbol: data.brokerSymbol as string };
  } catch (error) {
    if (error instanceof BinanceConnectionError) throw error;
    throw new BinanceConnectionError("Unable to contact the Exness MT5 candle bridge. Check that the local terminal and bridge are running.");
  }
}
