import { clearSession } from "@/app/lib/auth";
import { authJson, isSameOriginRequest } from "@/app/lib/auth-http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return authJson("សំណើមិនត្រូវបានអនុញ្ញាតទេ។", 403);
  await clearSession();
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}