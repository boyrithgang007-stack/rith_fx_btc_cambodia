import { getCurrentUser, allowAuthAttempt } from "@/app/lib/auth";
import { authJson, isSameOriginRequest, readAuthJson } from "@/app/lib/auth-http";
import { BinanceFuturesTestnet, EaExchangeError } from "@/app/lib/ea/binance-futures";
import {
  getEaSettings,
  hasEaCredentials,
  isEaTestnetVerified,
  listEaAuditEvents,
  listEaRuns,
  markEaTestnetVerified,
  parseEaCredentials,
  parseEaSettings,
  removeEaCredentials,
  saveEaSettings,
} from "@/app/lib/ea/store";
import { assertVaultConfigured, VaultConfigurationError } from "@/app/lib/exchanges/vault";

export const runtime = "nodejs";

function encryptionConfigured() {
  return /^[a-fA-F0-9]{64}$/.test(process.env.EXCHANGE_ENCRYPTION_KEY ?? "");
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return authJson("សូមចូលគណនីដែលបានអនុម័តជាមុន។", 401);
  return Response.json({
    settings: await getEaSettings(user.id),
    automationAvailable: process.env.VERCEL !== "1",
    encryptionConfigured: encryptionConfigured(),
    credentialsConfigured: await hasEaCredentials(user.id),
    testnetVerified: await isEaTestnetVerified(user.id),
    runs: await listEaRuns(user.id),
    audit: await listEaAuditEvents(user.id),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return authJson("Request origin rejected.", 403);
  const user = await getCurrentUser();
  if (!user) return authJson("សូមចូលគណនីដែលបានអនុម័តជាមុន។", 401);
  if (!allowAuthAttempt(`ea-settings:${user.id}`, 5, 60000)) return authJson("ព្យាយាមច្រើនដងពេក។ សូមរង់ចាំមួយនាទី។", 429);

  const body = await readAuthJson(request);
  const settings = parseEaSettings(body?.settings);
  if (!settings) return authJson("ការកំណត់ EA មិនត្រឹមត្រូវទេ។", 400);
  if (settings.enabled && process.env.VERCEL === "1") {
    return authJson("Automatic EA polling is unavailable on Vercel serverless. Keep the EA disabled or run a separately secured worker.", 503);
  }
  const credentials = body?.credentials === undefined ? undefined : parseEaCredentials(body.credentials);
  if (body?.credentials !== undefined && !credentials) return authJson("Binance Futures Testnet API key ឬ secret មិនត្រឹមត្រូវទេ។", 400);

  try {
    assertVaultConfigured();
    if (credentials) {
      await saveEaSettings(user.id, { ...settings, enabled: false }, credentials);
      await new BinanceFuturesTestnet(credentials).verifyAccount();
      await markEaTestnetVerified(user.id);
    } else if (settings.enabled && (!(await hasEaCredentials(user.id)) || !(await isEaTestnetVerified(user.id)))) {
      return authJson("សូមភ្ជាប់ និងផ្ទៀងផ្ទាត់ Binance Futures Testnet មុនបើក EA។", 409);
    }
    return Response.json({
      settings: await saveEaSettings(user.id, settings),
      automationAvailable: process.env.VERCEL !== "1",
      encryptionConfigured: encryptionConfigured(),
      credentialsConfigured: await hasEaCredentials(user.id),
      testnetVerified: await isEaTestnetVerified(user.id),
      runs: await listEaRuns(user.id),
      audit: await listEaAuditEvents(user.id),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof VaultConfigurationError) return authJson("Server មិនទាន់កំណត់ encryption សម្រាប់ EA credentials ទេ។", 503);
    if (error instanceof EaExchangeError) return authJson(error.message, 502);
    return authJson("មិនអាចរក្សាទុក ឬផ្ទៀងផ្ទាត់ការកំណត់ EA បានទេ។", 500);
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return authJson("Request origin rejected.", 403);
  const user = await getCurrentUser();
  if (!user) return authJson("សូមចូលគណនីដែលបានអនុម័តជាមុន។", 401);
  if (!allowAuthAttempt(`ea-disconnect:${user.id}`, 5, 60000)) return authJson("ព្យាយាមច្រើនដងពេក។ សូមរង់ចាំមួយនាទី។", 429);
  await removeEaCredentials(user.id);
  return Response.json({ disconnected: true }, { headers: { "Cache-Control": "no-store" } });
}
