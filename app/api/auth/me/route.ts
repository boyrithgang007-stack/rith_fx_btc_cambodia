import { getCurrentUser } from "@/app/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ user: await getCurrentUser() }, { headers: { "Cache-Control": "no-store" } });
}