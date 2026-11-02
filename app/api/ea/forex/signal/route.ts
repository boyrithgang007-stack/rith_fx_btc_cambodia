import { getCurrentUser, allowAuthAttempt } from "@/app/lib/auth";
import { authJson, isSameOriginRequest, readAuthJson } from "@/app/lib/auth-http";
import { evaluateForexRule } from "@/app/lib/ea/forex-rules";
import { listForexStrategies } from "@/app/lib/ea/forex-store";
import { readMt5ForexCandles } from "@/app/lib/exchanges/accounts";
import { BinanceConnectionError } from "@/app/lib/exchanges/binance";
import { connectionCredentials } from "@/app/lib/exchanges/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return authJson("Request origin rejected.", 403);
  const user = await getCurrentUser();
  if (!user) return authJson("សូមចូលគណនីដែលបានអនុម័តជាមុន។", 401);
  if (!allowAuthAttempt(`ea-forex-signal:${user.id}`, 10, 60000)) return authJson("ព្យាយាមច្រើនដងពេក។ សូមរង់ចាំមួយនាទី។", 429);
  const body = await readAuthJson(request);
  if (typeof body?.strategyId !== "string" || body.strategyId.length > 64
    || typeof body.connectionId !== "string" || body.connectionId.length > 64) {
    return authJson("Forex signal request is invalid.", 400);
  }
  const strategy = listForexStrategies(user.id).find(item => item.id === body.strategyId);
  if (!strategy) return authJson("រកមិនឃើញ Forex strategy ទេ។", 404);
  try {
    const credentials = connectionCredentials(user.id, body.connectionId);
    if (!credentials) return authJson("រកមិនឃើញ MT5 account ដែលបានភ្ជាប់ទេ។", 404);
    if (credentials.provider !== "mt5") return authJson("សូមជ្រើសរើស Exness MT5 account។", 400);
    const { candles, brokerSymbol } = await readMt5ForexCandles(credentials, strategy.rule.symbol);
    const signal = evaluateForexRule(candles, strategy.rule);
    return Response.json({
      strategy: strategy.name,
      symbol: strategy.rule.symbol,
      brokerSymbol,
      timeframe: "15m",
      higherTimeframe: "1h",
      observedAt: new Date().toISOString(),
      signal,
      executionEnabled: false,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BinanceConnectionError) return authJson(error.message, 502);
    console.error("[ea-forex-signal] Signal calculation failed:", error instanceof Error ? error.message : "Unknown error");
    return authJson("មិនអាចគណនា Forex signal បានទេ។", 500);
  }
}
