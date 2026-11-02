import { getCurrentUser } from "@/app/lib/auth";

const YAHOO_CHART_API = "https://query1.finance.yahoo.com/v8/finance/chart";
const INSTRUMENTS = [
  { id: "gold", name: "Gold futures", symbol: "GC=F", unit: "USD / troy oz" },
  { id: "silver", name: "Silver futures", symbol: "SI=F", unit: "USD / troy oz" },
  { id: "wti", name: "WTI crude futures", symbol: "CL=F", unit: "USD / barrel" },
  { id: "brent", name: "Brent crude futures", symbol: "BZ=F", unit: "USD / barrel" },
] as const;

type YahooChartResponse = {
  chart?: {
    error?: unknown;
    result?: Array<{
      meta?: {
        currency?: unknown;
        regularMarketPrice?: unknown;
        regularMarketTime?: unknown;
        previousClose?: unknown;
      };
      timestamp?: unknown;
      indicators?: {
        quote?: Array<{ close?: unknown }>;
      };
    }>;
  };
};

export const revalidate = 300;

export async function GET() {
  if (!(await getCurrentUser())) {
    return Response.json(
      { error: "សូមចូលគណនីដែលបានអនុម័តជាមុន។" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const results = await Promise.allSettled(INSTRUMENTS.map(async (instrument) => {
    const response = await fetch(
      `${YAHOO_CHART_API}/${encodeURIComponent(instrument.symbol)}?range=1mo&interval=1d`,
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        next: { revalidate: 300 },
        redirect: "error",
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!response.ok) throw new Error("Commodity quote provider is unavailable.");

    const payload = await response.json() as YahooChartResponse;
    const result = payload.chart?.result?.[0];
    const meta = result?.meta;
    const timestamps = result?.timestamp;
    const closes = result?.indicators?.quote?.[0]?.close;
    if (!meta || meta.currency !== "USD" || !Array.isArray(timestamps) || !Array.isArray(closes)) {
      throw new Error("Commodity quote response was invalid.");
    }

    const history = timestamps.flatMap((time, index) => {
      const close = closes[index];
      if (typeof time !== "number" || !Number.isFinite(time) || typeof close !== "number" || !Number.isFinite(close) || close <= 0) return [];
      return [{ time: time * 1000, price: close }];
    });
    const providerPrice = meta.regularMarketPrice;
    // chartPreviousClose refers to the start of the requested month, not yesterday.
    const marketTime = meta.regularMarketTime;
    const quoteTime = typeof marketTime === "number" && Number.isFinite(marketTime)
      ? marketTime * 1000 : history[history.length - 1].time;
    const quoteDay = new Date(quoteTime).toISOString().slice(0, 10);
    const priorDailyClose = history.filter((point) => new Date(point.time).toISOString().slice(0, 10) < quoteDay).at(-1)?.price;
    const previousClose = meta.previousClose ?? priorDailyClose;
    if (!history.length || typeof providerPrice !== "number" || !Number.isFinite(providerPrice) || providerPrice <= 0
      || typeof previousClose !== "number" || !Number.isFinite(previousClose) || previousClose <= 0) {
      throw new Error("Commodity quote response was incomplete.");
    }

    const asOf = typeof marketTime === "number" && Number.isFinite(marketTime)
      ? marketTime * 1000
      : history[history.length - 1].time;
    const change = providerPrice - previousClose;

    return {
      ...instrument,
      price: providerPrice,
      change,
      changePercent: (change / previousClose) * 100,
      asOf,
      history,
    };
  }));

  const commodities = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  const unavailable = results.flatMap((result, index) => result.status === "rejected" ? [INSTRUMENTS[index].id] : []);

  if (!commodities.length) {
    return Response.json(
      { error: "មិនអាចទាញទិន្នន័យយោងសម្រាប់ទីផ្សារមាស និងប្រេងបានទេ។ សូមសាកល្បងម្ដងទៀត។" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(
    { source: "Yahoo Finance futures reference", commodities, unavailable, checkedAt: Date.now() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
