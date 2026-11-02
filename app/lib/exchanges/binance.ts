import { createHmac } from "node:crypto";

export type BinanceCredentials = { apiKey: string; apiSecret: string };
export type SpotBalance = { asset: string; available: string; locked: string };
export class BinanceConnectionError extends Error {}

export function parseCredentials(value: unknown): BinanceCredentials | null {
  if (!value || typeof value !== "object") return null;
  const { apiKey, apiSecret } = value as Record<string, unknown>;
  if (typeof apiKey !== "string" || typeof apiSecret !== "string") return null;
  if (![apiKey, apiSecret].every(v => /^[A-Za-z0-9]{16,256}$/.test(v))) return null;
  return { apiKey, apiSecret };
}

async function signedGet(path: string, credentials: BinanceCredentials, timestamp: number, fetcher: typeof fetch) {
  const query = new URLSearchParams({ timestamp: String(timestamp), recvWindow: "5000" }).toString();
  const signature = createHmac("sha256", credentials.apiSecret).update(query).digest("hex");
  const response = await fetcher(`https://api.binance.com${path}?${query}&signature=${signature}`, {
    method: "GET", headers: { "X-MBX-APIKEY": credentials.apiKey }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new BinanceConnectionError("Binance rejected the request. Check API key, IP restrictions, permissions and regional availability.");
  return response.json();
}

export function assertReadOnlyPermissions(value: unknown) {
  if (!value || typeof value !== "object") throw new BinanceConnectionError("Cannot verify API permissions.");
  const p = value as Record<string, unknown>;
  const dangerous = ["enableWithdrawals", "enableInternalTransfer", "enableMargin", "enableFutures", "permitsUniversalTransfer", "enableVanillaOptions", "enableFixApiTrade", "enableSpotAndMarginTrading", "enablePortfolioMarginTrading"];
  if (p.enableReading !== true || p.enableWithdrawals !== false || p.enableSpotAndMarginTrading !== false || dangerous.some(name => p[name] !== undefined && p[name] !== false)) {
    throw new BinanceConnectionError("Use a read-only API key. Disable trading, withdrawals, margin, futures and transfer permissions.");
  }
}

export async function readBinanceAccount(credentials: BinanceCredentials, fetcher: typeof fetch = fetch) {
  try {
    const response = await fetcher("https://api.binance.com/api/v3/time", { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new BinanceConnectionError("Binance server time is unavailable.");
    const time = await response.json();
    if (!Number.isSafeInteger(time.serverTime) || time.serverTime <= 0) throw new BinanceConnectionError("Invalid provider time.");
    const startedAt = Date.now();
    assertReadOnlyPermissions(await signedGet("/sapi/v1/account/apiRestrictions", credentials, time.serverTime, fetcher));
    const data = await signedGet("/api/v3/account", credentials, time.serverTime + Date.now() - startedAt, fetcher);
    if (!Array.isArray(data.balances)) throw new BinanceConnectionError("Invalid account response.");
    const balances: SpotBalance[] = data.balances.map((b: Record<string, unknown>) => {
      if (typeof b.asset !== "string" || !/^[A-Za-z0-9]{1,32}$/.test(b.asset) || typeof b.free !== "string" || typeof b.locked !== "string" || ![b.free, b.locked].every(v => /^\d+(\.\d+)?$/.test(v) && Number.isFinite(Number(v)))) throw new BinanceConnectionError("Invalid balance response.");
      return { asset: b.asset, available: b.free, locked: b.locked };
    }).filter((b: SpotBalance) => Number(b.available) > 0 || Number(b.locked) > 0);
    return { balances, observedAt: new Date().toISOString() };
  } catch (error) {
    if (error instanceof BinanceConnectionError) throw error;
    throw new BinanceConnectionError("Unable to contact Binance. Please retry later.");
  }
}
