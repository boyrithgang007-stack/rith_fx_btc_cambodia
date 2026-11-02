import { allowAuthAttempt, getCurrentUser } from "@/app/lib/auth";
import { authJson, isSameOriginRequest, readLimitedJson } from "@/app/lib/auth-http";
import { sendSupportMessage } from "@/app/lib/support-mail";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 5 * 1024;
const MAX_MESSAGE_LENGTH = 2000;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return authJson("សំណើមិនត្រូវបានអនុញ្ញាតទេ។", 403);
  const user = await getCurrentUser();
  if (!user) return authJson("សូមចូលគណនីមុនពេលទាក់ទង Support។", 401);
  if (!allowAuthAttempt(`support:${user.id}`, 3, 10 * 60 * 1000)) {
    return authJson("សំណើ Support ច្រើនពេក។ សូមរង់ចាំបន្តិចហើយសាកល្បងម្ដងទៀត។", 429);
  }

  const body = await readLimitedJson(request, MAX_BODY_BYTES);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > MAX_MESSAGE_LENGTH || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(message)) {
    return authJson("សារត្រូវមានពី 1 ដល់ 2,000 តួអក្សរ។", 400);
  }

  try {
    await sendSupportMessage(user.email, message);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return authJson("មិនអាចផ្ញើសារទៅ Support បានទេ។ សូមព្យាយាមម្ដងទៀតពេលក្រោយ។", 503);
  }
}
