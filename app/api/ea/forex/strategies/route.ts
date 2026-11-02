import { getCurrentUser, allowAuthAttempt } from "@/app/lib/auth";
import { authJson, isSameOriginRequest, readAuthJson } from "@/app/lib/auth-http";
import { deleteForexStrategy, listForexStrategies, saveForexStrategy } from "@/app/lib/ea/forex-store";

export const runtime = "nodejs";

async function authenticatedUser(request?: Request) {
  if (request && !isSameOriginRequest(request)) return { user: null, response: authJson("Request origin rejected.", 403) };
  const user = await getCurrentUser();
  if (!user) return { user: null, response: authJson("សូមចូលគណនីដែលបានអនុម័តជាមុន។", 401) };
  if (!allowAuthAttempt(`ea-forex-strategies:${user.id}`, 30, 60000)) {
    return { user: null, response: authJson("ព្យាយាមច្រើនដងពេក។ សូមរង់ចាំមួយនាទី។", 429) };
  }
  return { user, response: null };
}

export async function GET() {
  const { user, response } = await authenticatedUser();
  if (response) return response;
  return Response.json({ strategies: listForexStrategies(user!.id) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const { user, response } = await authenticatedUser(request);
  if (response) return response;
  const body = await readAuthJson(request);
  if (!body || (body.id !== undefined && (typeof body.id !== "string" || body.id.length > 64))
    || (body.publishTemplate !== undefined && typeof body.publishTemplate !== "boolean")) {
    return authJson("Forex strategy request is invalid.", 400);
  }
  try {
    const strategy = saveForexStrategy(
      user!.id,
      body.rule,
      body.id as string | undefined,
      body.publishTemplate === true,
      user!.role === "admin",
    );
    return Response.json({ strategy }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("limit") || error.message.includes("cannot"))) {
      return authJson(error.message, 409);
    }
    if (error instanceof Error && error.message.includes("formula is invalid")) {
      return authJson(error.message, 400);
    }
    console.error("[ea-forex-strategies] Save failed:", error instanceof Error ? error.message : "Unknown error");
    return authJson("មិនអាចរក្សាទុក Forex strategy បានទេ។", 500);
  }
}

export async function DELETE(request: Request) {
  const { user, response } = await authenticatedUser(request);
  if (response) return response;
  const body = await readAuthJson(request);
  if (typeof body?.id !== "string" || body.id.length > 64) return authJson("Forex strategy ID មិនត្រឹមត្រូវទេ។", 400);
  try {
    const deleted = deleteForexStrategy(user!.id, body.id, user!.role === "admin");
    return deleted
      ? Response.json({ deleted: true })
      : authJson("រកមិនឃើញ Forex strategy ទេ។", 404);
  } catch (error) {
    if (error instanceof Error && error.message.includes("cannot")) return authJson(error.message, 403);
    console.error("[ea-forex-strategies] Delete failed:", error instanceof Error ? error.message : "Unknown error");
    return authJson("មិនអាចលុប Forex strategy បានទេ។", 500);
  }
}
