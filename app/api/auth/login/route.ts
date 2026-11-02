import { allowAuthAttempt, createSession, getClientIp, getClientKey, getUserByEmail, normalizeEmail, recordSuccessfulLogin, verifyPassword } from "@/app/lib/auth";
import { authJson, isSameOriginRequest, readAuthJson } from "@/app/lib/auth-http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return authJson("សំណើមិនត្រូវបានអនុញ្ញាតទេ។", 403);
  const clientKey = getClientKey(request);
  if (!allowAuthAttempt(`login:${clientKey}`, 10, 15 * 60 * 1000)) return authJson("ព្យាយាមចូលច្រើនដងពេក។ សូមរង់ចាំ 15 នាទី។", 429);

  const body = await readAuthJson(request);
  const email = normalizeEmail(body?.email);
  const password = body?.password;
  if (!email || typeof password !== "string" || password.length > 72) return authJson("អ៊ីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវទេ។", 401);

  try {
    const user = getUserByEmail(email);
    const validPassword = await verifyPassword(password, user?.password_hash);
    if (!user || !validPassword) return authJson("អ៊ីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវទេ។", 401);
    if (user.email_verified !== 1) return authJson("សូមផ្ទៀងផ្ទាត់អ៊ីមែលរបស់អ្នកតាមតំណដែលបានផ្ញើ មុនចូលគណនី។", 403);
    if (user.access_enabled !== 1) return authJson("ការចូលប្រើគណនីនេះត្រូវបានបិទ។ សូមទាក់ទងអ្នកគ្រប់គ្រង។", 403);
    if (user.status !== "approved") return authJson(user.status === "pending" ? "គណនីរបស់អ្នកកំពុងរង់ចាំអ្នកគ្រប់គ្រងអនុម័ត។" : "សំណើសមាជិករបស់អ្នកមិនត្រូវបានអនុម័តទេ។", 403);
    await createSession({ id: user.id, email: user.email });
    recordSuccessfulLogin(user.id, getClientIp(request));
    return Response.json({ user: { id: user.id, email: user.email } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return authJson("មិនអាចចូលគណនីបានទេ។ សូមសាកល្បងម្ដងទៀត។", 503);
  }
}