import { getCurrentUser } from "@/app/lib/auth";
import { validCandles, hasContinuousCandles } from "../../strategy";
const API_BASE = "https://api.coingecko.com/api/v3";
const coinGeckoApiKey = process.env.COINGECKO_API_KEY?.trim();
const coinGeckoHeaders = coinGeckoApiKey ? { "x-cg-demo-api-key": coinGeckoApiKey } : undefined;

export const revalidate = 60;

export async function GET(request: Request) {
  if (!(await getCurrentUser())) return Response.json({error:"សូមចូលគណនីដែលបានអនុម័តជាមុន។"},{status:401,headers:{"Cache-Control":"no-store"}});
  const params = new URL(request.url).searchParams;
  const coin = params.get("coin");

  try {
    if (params.get("candles") === "1") {
      const coin = params.get("coin") || "";
      const requestedDays = params.get("days") || "7";
      const days = ["1", "7", "14", "30", "90", "180", "365"].includes(requestedDays) ? requestedDays : "7";
      if (!/^[a-z0-9-]{2,80}$/.test(coin)) return Response.json({ error: "ទ្រព្យសកម្មមិនត្រឹមត្រូវទេ។" }, { status: 400 });

      const candlesResponse = await fetch(`${API_BASE}/coins/${encodeURIComponent(coin)}/ohlc?vs_currency=usd&days=${days}`, { headers: coinGeckoHeaders, next: { revalidate: 60 }, signal: AbortSignal.timeout(15_000) });
      if (!candlesResponse.ok) return Response.json({ error: "មិនអាចទាញ OHLC ពី CoinGecko បានទេ។ API អាចកំពុងកំណត់ចំនួនសំណើ។" }, { status: candlesResponse.status });
      const payload: unknown = await candlesResponse.json();
      if (!Array.isArray(payload) || !payload.every(row => Array.isArray(row) && row.length === 5 && row.every(Number.isFinite))) return Response.json({ error: "ទិន្នន័យ OHLC ពីប្រភពមិនត្រឹមត្រូវ។" }, { status: 502 });
      const rows = payload as [number, number, number, number, number][];
      const now = Date.now();
      // Provider timestamps are candle close times.
      const candles = rows.filter((row) => row[0] <= now).map((row) => ({
        time: row[0],
        open: row[1],
        high: row[2],
        low: row[3],
        close: row[4],
        volume: 0,
      }));
      const interval = days === "1" ? "30m" : Number(days) <= 30 ? "4h" : "4d";
      const intervalMs = interval === "30m" ? 1800000 : interval === "4h" ? 14400000 : 345600000;
      if (!candles.length || !validCandles(candles) || !hasContinuousCandles(candles, intervalMs)) return Response.json({ error: "OHLC មានទិន្នន័យខ្វះ ឬតម្លៃមិនត្រឹមត្រូវ។" }, { status: 502 });
      return Response.json({ candles, interval, intervalMs, asOf: candles.at(-1)!.time, volumeAvailable: false });
    }

    if (coin) {
      const requestedDays = params.get("days") || "7";
      const days = ["1", "7", "30"].includes(requestedDays) ? requestedDays : "7";
      const response = await fetch(`${API_BASE}/coins/${encodeURIComponent(coin)}/market_chart?vs_currency=usd&days=${days}`, { headers: coinGeckoHeaders, next: { revalidate: 60 }, signal: AbortSignal.timeout(15_000) });
      if (!response.ok) return Response.json({ error: "ប្រភពទិន្នន័យក្រាបមិនអាចឆ្លើយតបបានទេ។ សូមសាកល្បងម្ដងទៀត។" }, { status: response.status });
      const result = await response.json() as { prices?: [number, number][] };
      return Response.json({ prices: (result.prices || []).map(([time, value]) => ({ time, price: value })) });
    }

    const response = await fetch(`${API_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=12&page=1&sparkline=true&price_change_percentage=24h%2C7d`, { headers: coinGeckoHeaders, next: { revalidate: 60 }, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return Response.json({ error: "ប្រភពទិន្នន័យទីផ្សារមិនអាចឆ្លើយតបបានទេ។ សូមសាកល្បងម្ដងទៀត។" }, { status: response.status });
    return Response.json({ assets: await response.json() });
  } catch {
    return Response.json({ error: "មិនអាចភ្ជាប់ទៅប្រភពទិន្នន័យបានទេ។ សូមពិនិត្យអ៊ីនធឺណិត ហើយសាកល្បងម្ដងទៀត។" }, { status: 502 });
  }
}