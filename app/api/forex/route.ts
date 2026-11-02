import { getCurrentUser } from "@/app/lib/auth";
const API_BASE = "https://api.frankfurter.dev/v1";
const CURRENCIES = "EUR,GBP,JPY,CHF,CAD,AUD,NZD";

const PAIRS = [
  { symbol: "EUR/USD", base: "EUR", currency: "EUR", inverse: true },
  { symbol: "GBP/USD", base: "GBP", currency: "GBP", inverse: true },
  { symbol: "USD/JPY", base: "USD", currency: "JPY", inverse: false },
  { symbol: "USD/CHF", base: "USD", currency: "CHF", inverse: false },
  { symbol: "USD/CAD", base: "USD", currency: "CAD", inverse: false },
  { symbol: "AUD/USD", base: "AUD", currency: "AUD", inverse: true },
  { symbol: "NZD/USD", base: "NZD", currency: "NZD", inverse: true },
];

type FrankfurterResponse = { base: string; rates: Record<string, Record<string, number>> };

export const revalidate = 3600;

export async function GET() {
  if (!(await getCurrentUser())) return Response.json({error:"សូមចូលគណនីដែលបានអនុម័តជាមុន។"},{status:401,headers:{"Cache-Control":"no-store"}});
  try {
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 30);
    const startDate = start.toISOString().slice(0, 10);
    const endDate = end.toISOString().slice(0, 10);
    const response = await fetch(`${API_BASE}/${startDate}..${endDate}?base=USD&symbols=${CURRENCIES}`, { next: { revalidate: 3600 } });
    if (!response.ok) return Response.json({ error: "មិនអាចទាញ Forex reference rates បានទេ។ សូមសាកល្បងម្ដងទៀត។" }, { status: response.status });

    const result = await response.json() as FrankfurterResponse;
    const dates = Object.keys(result.rates).sort();
    if (!dates.length) return Response.json({ error: "មិនមាន Forex rates សម្រាប់ថ្ងៃនេះទេ។" }, { status: 503 });
    const latestDate = dates.at(-1)!;
    const previousDate = dates.length > 1 ? dates.at(-2)! : null;
    const latestRates = result.rates[latestDate];
    const previousRates = previousDate ? result.rates[previousDate] : {};
    const pairs = PAIRS.map((pair) => {
      const rawRate = latestRates[pair.currency];
      const previousRawRate = previousRates[pair.currency];
      const rate = pair.inverse ? 1 / rawRate : rawRate;
      const previousRate = previousRawRate ? pair.inverse ? 1 / previousRawRate : previousRawRate : null;
      const changePercent = previousRate ? (rate - previousRate) / previousRate * 100 : null;
      return { ...pair, rate, previousRate, changePercent };
    });
    const history = dates.map((date) => ({
      date,
      rates: Object.fromEntries(PAIRS.flatMap((pair) => {
        const rawRate = result.rates[date]?.[pair.currency];
        if (!Number.isFinite(rawRate) || rawRate <= 0) return [];
        return [[pair.symbol, pair.inverse ? 1 / rawRate : rawRate]];
      })),
    }));

    return Response.json({ source: "European Central Bank via Frankfurter", asOf: latestDate, previousDate, pairs, history });
  } catch {
    return Response.json({ error: "មិនអាចភ្ជាប់ទៅ Forex data provider បានទេ។" }, { status: 502 });
  }
}