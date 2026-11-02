import { randomUUID } from "node:crypto";
import { allowAuthAttempt, getCurrentUser } from "@/app/lib/auth";
import { listAdminAuditEvents, listAdminMembers, updateAdminMember, AdminMemberError } from "@/app/lib/admin-members";
import { authJson, isSameOriginRequest, readAuthJson } from "@/app/lib/auth-http";

export const runtime = "nodejs";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { response: authJson("សូមចូលគណនីដែលបានអនុម័តជាមុន។", 401) } as const;
  if (user.role !== "admin") return { response: authJson("អ្នកមិនមានសិទ្ធិគ្រប់គ្រងសមាជិកទេ។", 403) } as const;
  if (!allowAuthAttempt(`admin:${user.id}`, 120, 15 * 60 * 1000)) {
    return { response: authJson("សំណើច្រើនពេក។ សូមរង់ចាំបន្តិច។", 429) } as const;
  }
  return { user } as const;
}

export async function GET() {
  const access = await requireAdmin();
  if ("response" in access) return access.response;
  return Response.json(
    { members: await listAdminMembers(), audit: await listAdminAuditEvents() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return authJson("សំណើមិនត្រូវបានអនុញ្ញាតទេ។", 403);
  const access = await requireAdmin();
  if ("response" in access) return access.response;
  const body = await readAuthJson(request);
  if (!body) return authJson("ទិន្នន័យសំណើមិនត្រឹមត្រូវទេ។", 400);
  try {
    const result = await updateAdminMember(
      access.user,
      body.userId,
      body.action,
      randomUUID,
    );
    return Response.json({ result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminMemberError) return authJson(error.message, error.status);
    console.error("Admin member update failed", error);
    return authJson("មិនអាចធ្វើបច្ចុប្បន្នភាពគណនីនេះបានទេ។", 500);
  }
}
