import { allowAuthAttempt, getCurrentUser } from "@/app/lib/auth";
import { authJson, isSameOriginRequest, readAuthJson } from "@/app/lib/auth-http";
import { getTradingRiskSettings, parseTradingRiskSettings, saveTradingRiskSettings } from "@/app/lib/trading/settings";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return authJson("Please sign in to an approved account.", 401);
  return Response.json({ settings: await getTradingRiskSettings(user.id) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return authJson("សំណើមិនត្រូវបានអនុញ្ញាតទេ។", 403);
  const user = await getCurrentUser();
  if (!user) return authJson("សូមចូលគណនីម្ដងទៀត។", 401);
  if (!allowAuthAttempt(`trading-settings:${user.id}`, 10, 15 * 60 * 1000)) {
    return authJson("ការកំណត់ហានិភ័យត្រូវបានកែច្រើនដងពេក។ សូមសាកល្បងម្ដងទៀតពេលក្រោយ។", 429);
  }
  const body = await readAuthJson(request);
  const settings = parseTradingRiskSettings(body);
  if (!settings) return authJson("កំណត់ទំហំក្នុងមួយ order ចាប់ពី $1 ដល់ $100,000 និងកម្រិតប្រចាំថ្ងៃមិនតិចជាងទំហំមួយ order និងមិនលើស $1,000,000។", 400);
  return Response.json({ settings: await saveTradingRiskSettings(user.id, settings) }, { headers: { "Cache-Control": "no-store" } });
}
