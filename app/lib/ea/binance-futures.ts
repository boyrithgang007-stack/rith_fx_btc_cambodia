import { createHmac } from "node:crypto";
import type { Candle } from "../../strategy";
import type { EaCredentials, EaSymbol } from "./store";

const TESTNET_BASE = "https://testnet.binancefuture.com";

export class EaExchangeError extends Error {}

type FuturesOrder = {
  orderId: number;
  clientOrderId: string;
  status: string;
  executedQty: string;
  avgPrice?: string;
};

export type FuturesAccount = {
  availableBalance: number;
  totalWalletBalance: number;
  totalUnrealizedProfit: number;
  positions: { symbol: string; positionAmt: number; positionSide: string }[];
};

export type SymbolRules = { stepSize: number; minQty: number; tickSize: number; minNotional: number };
const DAILY_PNL_TYPES = new Set(["REALIZED_PNL", "FUNDING_FEE", "COMMISSION", "INSURANCE_CLEAR", "CONTRACT_ADL", "DELIVERED_SETTELMENT", "COMMISSION_REBATE"]);
const NON_TRADING_INCOME_TYPES = new Set(["TRANSFER", "INTERNAL_TRANSFER", "WELCOME_BONUS", "REFERRAL_KICKBACK"]);

function decimal(value: unknown) {
  if (typeof value !== "string" || !/^-?\d+(?:\.\d+)?$/.test(value) || !Number.isFinite(Number(value))) {
    throw new EaExchangeError("Binance Futures returned invalid numeric data.");
  }
  return Number(value);
}

function checkedOrder(value: unknown): FuturesOrder {
  if (!value || typeof value !== "object") throw new EaExchangeError("Binance Futures returned an invalid order response.");
  const order = value as Record<string, unknown>;
  if (!Number.isSafeInteger(order.orderId) || Number(order.orderId) <= 0
    || typeof order.clientOrderId !== "string"
    || typeof order.status !== "string"
    || !/^[A-Z_]{2,30}$/.test(order.status)
    || typeof order.executedQty !== "string") throw new EaExchangeError("Binance Futures returned an invalid order response.");
  if (decimal(order.executedQty) < 0 || (order.avgPrice !== undefined && decimal(order.avgPrice) < 0)) {
    throw new EaExchangeError("Binance Futures returned invalid order quantities.");
  }
  return order as FuturesOrder;
}

function decimalText(value: number) {
  if (!Number.isFinite(value) || value <= 0) throw new EaExchangeError("Invalid Binance Futures order quantity.");
  return value.toFixed(20).replace(/\.?0+$/, "");
}

export class BinanceFuturesTestnet {
  private readonly base: string;
  constructor(private readonly credentials: EaCredentials, private readonly fetcher: typeof fetch = fetch) {
    this.base = TESTNET_BASE;
  }

  private async request<T>(path: string, method: "GET" | "POST" | "DELETE", params: Record<string, string> = {}, signed = false): Promise<T> {
    const query = new URLSearchParams(params);
    if (signed) {
      const timeResponse = await this.fetcher(`${this.base}/fapi/v1/time`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
      if (!timeResponse.ok) throw new EaExchangeError("Binance Futures Testnet time service is unavailable.");
      const timeData = await timeResponse.json();
      if (!Number.isSafeInteger(timeData.serverTime) || timeData.serverTime <= 0) throw new EaExchangeError("Invalid Binance Futures server time.");
      query.set("timestamp", String(timeData.serverTime));
      query.set("recvWindow", "5000");
      const signature = createHmac("sha256", this.credentials.apiSecret).update(query.toString()).digest("hex");
      query.set("signature", signature);
    }
    const response = await this.fetcher(`${this.base}${path}${query.size ? `?${query}` : ""}`, {
      method,
      headers: { "X-MBX-APIKEY": this.credentials.apiKey, "Content-Type": "application/x-www-form-urlencoded" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    let data: unknown;
    try { data = await response.json(); } catch { throw new EaExchangeError("Binance Futures Testnet returned an invalid response."); }
    if (!response.ok) {
      const code = data && typeof data === "object" ? (data as Record<string, unknown>).code : null;
      if (code === -2019) throw new EaExchangeError("Testnet margin is insufficient for this order.");
      if (code === -2021 || code === -2022) throw new EaExchangeError("Binance Futures rejected the order because its price or position state changed.");
      throw new EaExchangeError("Binance Futures Testnet rejected the request. Check Futures permissions and Testnet settings.");
    }
    return data as T;
  }

  async verifyAccount() {
    const account = await this.getAccount();
    const mode = await this.request<{ dualSidePosition: boolean }>("/fapi/v1/positionSide/dual", "GET", {}, true);
    if (mode.dualSidePosition !== false) throw new EaExchangeError("Use Binance Futures one-way position mode on Testnet before enabling the EA.");
    return account;
  }

  async getCandles(symbol: EaSymbol): Promise<Candle[]> {
    const rows = await this.request<unknown[][]>("/fapi/v1/klines", "GET", { symbol, interval: "4h", limit: "200" });
    if (!Array.isArray(rows) || rows.length < 20) throw new EaExchangeError("Insufficient Binance Futures candles for a confirmed signal.");
    const now = Date.now();
    const candles = rows.map(row => {
      if (!Array.isArray(row) || row.length < 6) throw new EaExchangeError("Invalid Binance Futures candle response.");
      const openTime = Number(row[0]);
      const open = decimal(String(row[1])), high = decimal(String(row[2])), low = decimal(String(row[3]));
      const close = decimal(String(row[4])), volume = decimal(String(row[5]));
      return { time: openTime + 4 * 60 * 60 * 1000, open, high, low, close, volume };
    }).filter(candle => candle.time <= now);
    return candles;
  }

  async getAccount(): Promise<FuturesAccount> {
    const data = await this.request<Record<string, unknown>>("/fapi/v2/account", "GET", {}, true);
    if (!Array.isArray(data.positions)) throw new EaExchangeError("Invalid Binance Futures account response.");
    const availableBalance = decimal(String(data.availableBalance));
    const totalWalletBalance = decimal(String(data.totalWalletBalance));
    const totalUnrealizedProfit = decimal(String(data.totalUnrealizedProfit));
    const positions = data.positions.map((position: Record<string, unknown>) => ({
      symbol: String(position.symbol),
      positionAmt: decimal(String(position.positionAmt)),
      positionSide: String(position.positionSide),
    }));
    if (availableBalance < 0 || totalWalletBalance <= 0 || positions.some(p => !/^[A-Z0-9]{3,30}$/.test(p.symbol) || !["BOTH", "LONG", "SHORT"].includes(p.positionSide))) {
      throw new EaExchangeError("Invalid Binance Futures account values.");
    }
    return { availableBalance, totalWalletBalance, totalUnrealizedProfit, positions };
  }

  async getDailyRealizedPnl(dayStart: number, now = Date.now()) {
    if (!Number.isSafeInteger(dayStart) || dayStart <= 0 || !Number.isSafeInteger(now) || now < dayStart) {
      throw new EaExchangeError("Invalid daily PnL time range.");
    }
    const records = await this.request<Record<string, unknown>[]>("/fapi/v1/income", "GET", {
      startTime: String(dayStart),
      endTime: String(now),
      limit: "1000",
    }, true);
    if (!Array.isArray(records) || records.length >= 1000) throw new EaExchangeError("Daily PnL history is incomplete; the EA is paused for safety.");
    return records.reduce((sum, record) => {
      if (typeof record.incomeType !== "string" || !Number.isSafeInteger(record.time) || Number(record.time) < dayStart || Number(record.time) > now) {
        throw new EaExchangeError("Binance Futures returned invalid daily PnL history.");
      }
      if (NON_TRADING_INCOME_TYPES.has(record.incomeType)) return sum;
      if (!DAILY_PNL_TYPES.has(record.incomeType)) throw new EaExchangeError("Binance Futures returned an unsupported income type; daily PnL cannot be verified.");
      return sum + decimal(String(record.income));
    }, 0);
  }

  async getMarkPrice(symbol: EaSymbol) {
    const data = await this.request<{ markPrice: string }>("/fapi/v1/premiumIndex", "GET", { symbol });
    const value = decimal(data.markPrice);
    if (value <= 0) throw new EaExchangeError("Invalid Binance Futures mark price.");
    return value;
  }

  async getSymbolRules(symbol: EaSymbol): Promise<SymbolRules> {
    const data = await this.request<{ symbols: Record<string, unknown>[] }>("/fapi/v1/exchangeInfo", "GET");
    const info = data.symbols?.find(item => item.symbol === symbol);
    const filters = info?.filters;
    if (!Array.isArray(filters)) throw new EaExchangeError("Binance Futures symbol filters are unavailable.");
    const lot = filters.find((filter: Record<string, unknown>) => filter.filterType === "LOT_SIZE") as Record<string, unknown> | undefined;
    const price = filters.find((filter: Record<string, unknown>) => filter.filterType === "PRICE_FILTER") as Record<string, unknown> | undefined;
    const notional = filters.find((filter: Record<string, unknown>) => filter.filterType === "MIN_NOTIONAL" || filter.filterType === "NOTIONAL") as Record<string, unknown> | undefined;
    if (!lot || !price) throw new EaExchangeError("Binance Futures quantity or price filters are missing.");
    const rules = {
      stepSize: decimal(String(lot.stepSize)),
      minQty: decimal(String(lot.minQty)),
      tickSize: decimal(String(price.tickSize)),
      minNotional: notional ? decimal(String(notional.notional ?? notional.minNotional ?? "0")) : 0,
    };
    if (Object.values(rules).some(value => !Number.isFinite(value) || value < 0) || rules.stepSize <= 0 || rules.tickSize <= 0) {
      throw new EaExchangeError("Invalid Binance Futures symbol filters.");
    }
    return rules;
  }

  async setLeverage(symbol: EaSymbol, leverage: number) {
    return this.request<{ leverage: number }>("/fapi/v1/leverage", "POST", { symbol, leverage: String(leverage) }, true);
  }

  async placeMarketOrder(symbol: EaSymbol, side: "BUY" | "SELL", quantity: number, clientOrderId: string) {
    const data = await this.request<unknown>("/fapi/v1/order", "POST", {
      symbol, side, type: "MARKET", quantity: decimalText(quantity), newOrderRespType: "RESULT", newClientOrderId: clientOrderId,
    }, true);
    return checkedOrder(data);
  }

  async findOrder(symbol: EaSymbol, clientOrderId: string) {
    return checkedOrder(await this.request<unknown>("/fapi/v1/order", "GET", { symbol, origClientOrderId: clientOrderId }, true));
  }

  async cancelOrder(symbol: EaSymbol, clientOrderId: string) {
    return checkedOrder(await this.request<unknown>("/fapi/v1/order", "DELETE", { symbol, origClientOrderId: clientOrderId }, true));
  }

  async verifyCloseProtection(symbol: EaSymbol, stopOrderId: string, takeProfitOrderId: string) {
    const orders = await this.request<Record<string, unknown>[]>("/fapi/v1/openOrders", "GET", { symbol }, true);
    if (!Array.isArray(orders)) throw new EaExchangeError("Binance Futures protection order list is invalid.");
    const valid = (clientId: string, type: string) => orders.some(order =>
      order.clientOrderId === clientId
      && order.type === type
      && order.status === "NEW"
      && (order.closePosition === true || order.closePosition === "true"),
    );
    return valid(stopOrderId, "STOP_MARKET") && valid(takeProfitOrderId, "TAKE_PROFIT_MARKET");
  }

  async placeCloseProtection(symbol: EaSymbol, side: "BUY" | "SELL", type: "STOP_MARKET" | "TAKE_PROFIT_MARKET", stopPrice: number, tickSize: number, clientOrderId: string) {
    const roundUp = type === "STOP_MARKET" ? side === "BUY" : side === "SELL";
    const rounded = roundUp ? Math.ceil(stopPrice / tickSize) * tickSize : Math.floor(stopPrice / tickSize) * tickSize;
    return checkedOrder(await this.request<unknown>("/fapi/v1/order", "POST", {
      symbol, side, type, stopPrice: rounded.toFixed(decimalPlaces(tickSize)), closePosition: "true",
      workingType: "MARK_PRICE", priceProtect: "TRUE", newClientOrderId: clientOrderId,
    }, true));
  }

  async closeMarketPosition(symbol: EaSymbol, side: "BUY" | "SELL", quantity: number, clientOrderId: string) {
    return checkedOrder(await this.request<unknown>("/fapi/v1/order", "POST", {
      symbol, side, type: "MARKET", quantity: decimalText(quantity), reduceOnly: "true", newOrderRespType: "RESULT",
      newClientOrderId: clientOrderId,
    }, true));
  }
}

function decimalPlaces(value: number) {
  const text = value.toString();
  return text.includes(".") ? text.length - text.indexOf(".") - 1 : 0;
}

export function floorToStep(value: number, step: number) {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(step) || step <= 0) return 0;
  const precision = decimalPlaces(step);
  return Number((Math.floor(value / step + 1e-10) * step).toFixed(precision));
}

export function floorToTick(value: number, tick: number) {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(tick) || tick <= 0) return 0;
  const precision = decimalPlaces(tick);
  return Number((Math.floor(value / tick + 1e-10) * tick).toFixed(precision));
}

export function phnomPenhDayKey(timestamp: number) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) throw new EaExchangeError("Invalid daily PnL timestamp.");
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Phnom_Penh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(timestamp);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function phnomPenhDayStart(timestamp: number) {
  const key = phnomPenhDayKey(timestamp);
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day) - 7 * 60 * 60 * 1000;
}
