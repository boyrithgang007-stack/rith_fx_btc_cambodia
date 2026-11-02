type Quote = {
  symbol: string;
  price: number;
  changePercent: number | null;
  asOf: number;
  source: string;
  delayed: boolean;
};

const COINGECKO_API = "https://api.coingecko.com/api/v3";
const coinGeckoApiKey = process.env.COINGECKO_API_KEY?.trim();
const coinGeckoHeaders = coinGeckoApiKey ? { "x-cg-demo-api-key": coinGeckoApiKey } : undefined;
const FRANKFURTER_API = "https://api.frankfurter.dev/v1";
const YAHOO_CHART_API = "https://query1.finance.yahoo.com/v8/finance/chart";

type CoinGeckoAsset = {
  id?: unknown;
  current_price?: unknown;
  price_change_percentage_24h?: unknown;
  last_updated?: unknown;
};

type FrankfurterResponse = {
  rates?: Record<string, Record<string, number>>;
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        currency?: unknown;
        regularMarketPrice?: unknown;
        regularMarketTime?: unknown;
        previousClose?: unknown;
      };
      timestamp?: unknown;
      indicators?: { quote?: Array<{ close?: unknown }> };
    }>;
  };
};

async function loadCryptoQuotes(): Promise<Quote[]> {
  const assets = [
    { id: "ethereum", symbol: "ETHUSDT" },
    { id: "bitcoin", symbol: "BTCUSDT" },
  ];
  const response = await fetch(
    `${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${assets.map((asset) => asset.id).join(",")}&price_change_percentage=24h`,
    { headers: coinGeckoHeaders, next: { revalidate: 60 }, redirect: "error", signal: AbortSignal.timeout(10_000) },
  );
  if (!response.ok) throw new Error("CoinGecko quotes are unavailable.");

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error("CoinGecko returned invalid quotes.");

  const quotes = (payload as CoinGeckoAsset[]).flatMap((asset) => {
    const mapping = assets.find((item) => item.id === asset.id);
    const price = asset.current_price;
    const changePercent = asset.price_change_percentage_24h;
    const asOf = typeof asset.last_updated === "string" ? Date.parse(asset.last_updated) : NaN;
    if (
      !mapping
      || typeof price !== "number"
      || !Number.isFinite(price)
      || price <= 0
      || typeof changePercent !== "number"
      || !Number.isFinite(changePercent)
      || !Number.isFinite(asOf)
    ) return [];
    return [{
      symbol: mapping.symbol,
      price,
      changePercent,
      asOf,
      source: "CoinGecko",
      delayed: false,
    }];
  });
  if (!quotes.length) throw new Error("CoinGecko returned no usable quotes.");
  return quotes;
}

async function loadForexQuotes(): Promise<Quote[]> {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 7);
  const response = await fetch(
    `${FRANKFURTER_API}/${start.toISOString().slice(0, 10)}..${end.toISOString().slice(0, 10)}?base=USD&symbols=EUR,GBP`,
    { next: { revalidate: 3600 }, redirect: "error", signal: AbortSignal.timeout(10_000) },
  );
  if (!response.ok) throw new Error("Frankfurter forex rates are unavailable.");

  const payload = await response.json() as FrankfurterResponse;
  const dates = Object.keys(payload.rates ?? {}).sort();
  if (!dates.length) throw new Error("Frankfurter returned no forex rates.");

  const latestDate = dates.at(-1)!;
  const latestRates = payload.rates![latestDate];
  const previousRates = dates.length > 1 ? payload.rates![dates.at(-2)!] : undefined;
  const asOf = Date.parse(`${latestDate}T00:00:00Z`);
  if (!Number.isFinite(asOf)) throw new Error("Frankfurter returned an invalid rate date.");

  return (["EUR", "GBP"] as const).flatMap((currency) => {
    const rawRate = latestRates?.[currency];
    const previousRawRate = previousRates?.[currency];
    if (!Number.isFinite(rawRate) || rawRate <= 0) return [];
    const price = 1 / rawRate;
    const previousPrice = Number.isFinite(previousRawRate) && previousRawRate! > 0
      ? 1 / previousRawRate!
      : null;
    return [{
      symbol: `${currency}USD`,
      price,
      changePercent: previousPrice === null ? null : ((price - previousPrice) / previousPrice) * 100,
      asOf,
      source: "Frankfurter / ECB",
      delayed: true,
    }];
  });
}

async function loadCommodityQuote(
  symbol: "USOIL" | "XAUUSD",
  yahooSymbol: "CL=F" | "GC=F",
): Promise<Quote> {
  const response = await fetch(
    `${YAHOO_CHART_API}/${encodeURIComponent(yahooSymbol)}?range=5d&interval=1d`,
    {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 300 },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) throw new Error(`${symbol} quote is unavailable.`);

  const payload = await response.json() as YahooChartResponse;
  const result = payload.chart?.result?.[0];
  const meta = result?.meta;
  const timestamps = result?.timestamp;
  const closes = result?.indicators?.quote?.[0]?.close;
  const price = meta?.regularMarketPrice;
  if (
    meta?.currency !== "USD"
    || !Array.isArray(timestamps)
    || !Array.isArray(closes)
    || typeof price !== "number"
    || !Number.isFinite(price)
    || price <= 0
  ) throw new Error(`${symbol} quote response was invalid.`);

  const history = timestamps.flatMap((time, index) => {
    const close = closes[index];
    if (
      typeof time !== "number"
      || !Number.isFinite(time)
      || typeof close !== "number"
      || !Number.isFinite(close)
      || close <= 0
    ) return [];
    return [{ time: time * 1000, price: close }];
  });
  const marketTime = meta.regularMarketTime;
  const asOf = typeof marketTime === "number" && Number.isFinite(marketTime)
    ? marketTime * 1000
    : history.at(-1)?.time;
  const quoteDay = typeof asOf === "number" ? new Date(asOf).toISOString().slice(0, 10) : "";
  const previousClose = typeof meta.previousClose === "number" && Number.isFinite(meta.previousClose)
    ? meta.previousClose
    : history.filter((point) => new Date(point.time).toISOString().slice(0, 10) < quoteDay).at(-1)?.price;
  if (typeof asOf !== "number" || !Number.isFinite(asOf) || asOf <= 0) {
    throw new Error(`${symbol} quote response had no timestamp.`);
  }

  return {
    symbol,
    price,
    changePercent: typeof previousClose === "number" && Number.isFinite(previousClose) && previousClose > 0
      ? ((price - previousClose) / previousClose) * 100
      : null,
    asOf,
    source: "Yahoo Finance",
    delayed: true,
  };
}

export async function GET() {
  const results = await Promise.allSettled([
    loadCryptoQuotes(),
    loadForexQuotes(),
    loadCommodityQuote("USOIL", "CL=F"),
    loadCommodityQuote("XAUUSD", "GC=F"),
  ]);
  const quotes = results.flatMap((result) => {
    if (result.status === "rejected") return [];
    return Array.isArray(result.value) ? result.value : [result.value];
  });

  if (!quotes.length) {
    return Response.json(
      { error: "Market quotes are temporarily unavailable." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(
    { quotes, checkedAt: Date.now() },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" } },
  );
}
