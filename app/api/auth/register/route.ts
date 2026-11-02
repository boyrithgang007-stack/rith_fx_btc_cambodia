import {
  assertAuthConfigured,
  AuthConfigurationError,
  allowAuthAttempt,
  createUser,
  getUserByEmail,
  verifyPassword,
  getClientKey,
  getClientIp,
  hashPassword,
  normalizeEmail,
  passwordIsValid,
  createApprovalReview,
  markApprovalDelivery,
  createEmailVerification,
  markEmailVerificationDelivery,
} from "@/app/lib/auth";
import { authJson, isSameOriginRequest, readAuthJson } from "@/app/lib/auth-http";
import {
  approvalMailConfig,
  ApprovalMailConfigurationError,
  sendApprovalEmail,
  sendEmailVerificationEmail,
} from "@/app/lib/approval-mail";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return authJson("សំណើមិនត្រូវបានអនុញ្ញាតទេ។", 403);
  if (!allowAuthAttempt(`register:${getClientKey(request)}`, 5, 60 * 60 * 1000)) {
    return authJson("សំណើចុះឈ្មោះច្រើនពេក។ សូមសាកល្បងក្រោយមួយម៉ោង។", 429);
  }
  const body = await readAuthJson(request);
  const email = normalizeEmail(body?.email), password = body?.password;
  if (!email || !passwordIsValid(password)) {
    return authJson("សូមប្រើអ៊ីមែលត្រឹមត្រូវ និងពាក្យសម្ងាត់យ៉ាងតិច 12 តួអក្សរ។", 400);
  }

  try {
    assertAuthConfigured();
    const config = approvalMailConfig();
    const existing = getUserByEmail(email);
    if (existing && (existing.status !== "pending" || !(await verifyPassword(password, existing.password_hash)))) {
      return authJson("មិនអាចប្រើអ៊ីមែលនេះបានទេ។ ប្រសិនបើមានគណនី សូមចូលគណនី។", 409);
    }

    const user = existing ?? createUser(email, await hashPassword(password), getClientIp(request), false);
    if (existing?.email_verified !== 1) {
      const verification = createEmailVerification(user.id);
      try {
        await sendEmailVerificationEmail(user.email, verification.token, verification.hash);
        markEmailVerificationDelivery(verification.hash, "sent");
      } catch {
        markEmailVerificationDelivery(verification.hash, "failed");
        return authJson("មិនអាចផ្ញើតំណផ្ទៀងផ្ទាត់អ៊ីមែលបានទេ។ សូមចុះឈ្មោះម្ដងទៀតដោយអ៊ីមែល និងពាក្យសម្ងាត់ដដែល ដើម្បីផ្ញើឡើងវិញ។", 503);
      }
      return Response.json({
        status: "verification_required",
        message: "បានផ្ញើតំណផ្ទៀងផ្ទាត់ទៅអ៊ីមែលរបស់អ្នក។ សូមផ្ទៀងផ្ទាត់មុនពេលអ្នកគ្រប់គ្រងពិនិត្យសំណើ។",
      }, { status: 202, headers: { "Cache-Control": "no-store" } });
    }

    const review = createApprovalReview(user.id, config.to);
    try {
      await sendApprovalEmail(user.email, review.token, review.hash);
      markApprovalDelivery(review.hash, "sent");
    } catch {
      markApprovalDelivery(review.hash, "failed");
      return authJson("អ៊ីមែលរបស់អ្នកបានផ្ទៀងផ្ទាត់ ប៉ុន្តែមិនអាចផ្ញើសំណើទៅអ្នកគ្រប់គ្រងបានទេ។ សូមចុះឈ្មោះម្ដងទៀតដោយព័ត៌មានដដែល ដើម្បីផ្ញើឡើងវិញ។", 503);
    }
    return Response.json({
      status: "pending",
      message: "បានផ្ទៀងផ្ទាត់អ៊ីមែល និងផ្ញើសំណើទៅអ្នកគ្រប់គ្រង។ គណនីរបស់អ្នកត្រូវរង់ចាំអនុម័ត មុនអាចចូលប្រើបាន។",
    }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthConfigurationError || error instanceof ApprovalMailConfigurationError) {
      return authJson("ការចុះឈ្មោះមិនទាន់រួចរាល់ទេ។ អ្នកគ្រប់គ្រងត្រូវកំណត់សេវាអ៊ីមែល និង authentication ជាមុន។", 503);
    }
    if (error && typeof error === "object" && "code" in error && String(error.code).includes("CONSTRAINT_UNIQUE")) {
      return authJson("អ៊ីមែលនេះមានសំណើរួចហើយ។ សូមសាកល្បងម្ដងទៀត។", 409);
    }
    return authJson("មិនអាចបង្កើតសំណើបានទេ។ សូមសាកល្បងម្ដងទៀត។", 500);
  }
}
