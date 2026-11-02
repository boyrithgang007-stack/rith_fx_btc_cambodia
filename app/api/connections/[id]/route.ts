import { readAccount } from "@/app/lib/exchanges/accounts";
import { allowAuthAttempt, getCurrentUser } from "@/app/lib/auth";
import { authJson, isSameOriginRequest } from "@/app/lib/auth-http";
import { BinanceConnectionError } from "@/app/lib/exchanges/binance";
import { connectionCredentials, removeConnection } from "@/app/lib/exchanges/store";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return authJson("Request origin rejected.", 403);
  const user = await getCurrentUser();
  if (!user) return authJson("Please sign in to an approved account.", 401);
  if (!allowAuthAttempt(`balance:${user.id}`, 10, 60000)) return authJson("Refresh limit reached. Retry in one minute.", 429);
  try {
    const { id } = await context.params;
    const credentials = connectionCredentials(user.id, id);
    if (!credentials) return authJson("Connection not found.", 404);
    return Response.json(await readAccount(credentials), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return authJson(error instanceof BinanceConnectionError ? error.message : "Unable to read this connection. Check server configuration.", 502);
  }
}

export async function DELETE(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return authJson("Request origin rejected.", 403);
  const user = await getCurrentUser();
  if (!user) return authJson("Please sign in to an approved account.", 401);
  const { id } = await context.params;
  if (!removeConnection(user.id, id)) return authJson("Connection not found.", 404);
  return Response.json({ disconnected: true }, { headers: { "Cache-Control": "no-store" } });
}
