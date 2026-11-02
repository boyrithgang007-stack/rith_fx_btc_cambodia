import { parseAccountCredentials, readAccount } from "@/app/lib/exchanges/accounts";
import { allowAuthAttempt, getCurrentUser } from "@/app/lib/auth";
import { authJson, isSameOriginRequest, readAuthJson } from "@/app/lib/auth-http";
import { BinanceConnectionError } from "@/app/lib/exchanges/binance";
import { listConnections, saveConnection } from "@/app/lib/exchanges/store";
import { assertVaultConfigured, VaultConfigurationError } from "@/app/lib/exchanges/vault";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return authJson("Please sign in to an approved account.", 401);
  return Response.json({ connections: await listConnections(user.id) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return authJson("Request origin rejected.", 403);
  const user = await getCurrentUser();
  if (!user) return authJson("Please sign in to an approved account.", 401);
  if (!allowAuthAttempt(`connect:${user.id}`, 5, 60000)) return authJson("Too many attempts. Retry in one minute.", 429);
  const body = await readAuthJson(request);
  const credentials = parseAccountCredentials(body);
  if (!credentials) return authJson("Enter valid provider credentials.", 400);
  try {
    assertVaultConfigured();
    await readAccount(credentials);
    await saveConnection(user.id, credentials);
    return Response.json({ connections: await listConnections(user.id) }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof VaultConfigurationError) return authJson("Account connections require server encryption configuration.", 503);
    if (error instanceof BinanceConnectionError) return authJson(error.message, 502);
    return authJson("Unable to save the connection.", 500);
  }
}
