export type TerminalAsset = {
  id: string;
  name: string;
  symbol: string;
  image: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d_in_currency: number | null;
  sparkline_in_7d: { price: number[] };
};

export type TerminalCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export function validTerminalAssets(value: unknown): value is TerminalAsset[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  return value.every((item) => {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !item.id || ids.has(item.id)) return false;
    ids.add(item.id);
    return [item.name, item.symbol, item.image].every(field => typeof field === "string")
      && [item.current_price, item.market_cap, item.total_volume].every(field => typeof field === "number" && Number.isFinite(field) && field >= 0)
      && [item.price_change_percentage_24h, item.price_change_percentage_7d_in_currency].every(field => field === null || (typeof field === "number" && Number.isFinite(field)))
      && Array.isArray(item.sparkline_in_7d?.price)
      && item.sparkline_in_7d.price.every((price: unknown) => typeof price === "number" && Number.isFinite(price) && price >= 0);
  });
}

export type TerminalRange = "1" | "7" | "30";

export type CommodityQuote = {
  id: "gold" | "silver" | "wti" | "brent";
  name: string;
  symbol: string;
  unit: string;
  price: number;
  change: number;
  changePercent: number;
  asOf: number;
  history: { time: number; price: number }[];
};

export async function fetchCommodityQuotes(signal: AbortSignal) {
  const response = await fetch("/api/commodities", { cache: "no-store", signal });
  const result: unknown = await response.json();
  if (!response.ok) {
    const message = result && typeof result === "object" && "error" in result && typeof result.error === "string"
      ? result.error
      : "Gold, silver and oil reference quotes could not be loaded.";
    throw new Error(message);
  }
  if (!result || typeof result !== "object" || !("commodities" in result) || !Array.isArray(result.commodities)
    || !result.commodities.every((quote: CommodityQuote) =>
      typeof quote.id === "string" && Number.isFinite(quote.price) && Number.isFinite(quote.changePercent)
      && Number.isFinite(quote.asOf) && Array.isArray(quote.history)
      && quote.history.every((point) => Number.isFinite(point.time) && Number.isFinite(point.price)))) {
    throw new Error("The commodity quote response was invalid.");
  }
  return {
    quotes: result.commodities as CommodityQuote[],
    unavailable: "unavailable" in result && Array.isArray(result.unavailable)
      ? result.unavailable.filter((id): id is string => typeof id === "string")
      : [],
    checkedAt: "checkedAt" in result && typeof result.checkedAt === "number" ? result.checkedAt : Date.now(),
  };
}

export async function fetchTerminalCandles(assetId: string, range: TerminalRange, signal: AbortSignal) {
  const response = await fetch(
    `/api/market?candles=1&coin=${encodeURIComponent(assetId)}&days=${range}`,
    { cache: "no-store", signal },
  );
  const result: unknown = await response.json();
  if (!response.ok) {
    const message = result && typeof result === "object" && "error" in result && typeof result.error === "string"
      ? result.error
      : "Market candles could not be loaded.";
    throw new Error(message);
  }
  if (!result || typeof result !== "object" || !("candles" in result) || !Array.isArray(result.candles)
    || !result.candles.every((candle: TerminalCandle) =>
      [candle.time, candle.open, candle.high, candle.low, candle.close].every(Number.isFinite))) {
    throw new Error("The market candle response was invalid.");
  }
  return result.candles as TerminalCandle[];
}

export type DemoBookLevel = {
  price: number;
  size: number;
  total: number;
};

export function createDemoOrderBook(midPrice: number) {
  const asks: DemoBookLevel[] = [];
  const bids: DemoBookLevel[] = [];
  let askTotal = 0;
  let bidTotal = 0;

  for (let index = 0; index < 6; index += 1) {
    const spread = (index + 1) * 0.0007;
    const askSize = 0.14 + ((index * 17 + 8) % 29) / 100;
    const bidSize = 0.12 + ((index * 13 + 11) % 31) / 100;
    askTotal += askSize;
    bidTotal += bidSize;
    asks.push({ price: midPrice * (1 + spread), size: askSize, total: askTotal });
    bids.push({ price: midPrice * (1 - spread), size: bidSize, total: bidTotal });
  }

  return { asks: asks.reverse(), bids };
}

export function formatTerminalPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value >= 1 ? 2 : 4,
    maximumFractionDigits: value >= 1 ? 2 : 6,
  }).format(value);
}

export function formatCompactUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatChange(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
