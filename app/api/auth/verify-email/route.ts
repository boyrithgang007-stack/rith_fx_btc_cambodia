import {
  allowAuthAttempt,
  createApprovalReview,
  getClientKey,
  markApprovalDelivery,
  verifyUserEmail,
} from "@/app/lib/auth";
import { authJson, isSameOriginRequest, readAuthJson } from "@/app/lib/auth-http";
import {
  approvalMailConfig,
  ApprovalMailConfigurationError,
  sendApprovalEmail,
} from "@/app/lib/approval-mail";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return authJson("សំណើមិនត្រូវបានអនុញ្ញាតទេ។", 403);
  if (!allowAuthAttempt(`verify-email:${getClientKey(request)}`, 10, 15 * 60 * 1000)) {
    return authJson("សំណើច្រើនពេក។ សូមរង់ចាំ 15 នាទី។", 429);
  }
  const body = await readAuthJson(request);
  if (typeof body?.token !== "string") return authJson("តំណផ្ទៀងផ្ទាត់មិនត្រឹមត្រូវទេ។", 400);

  try {
    const config = approvalMailConfig();
    const user = verifyUserEmail(body.token);
    if (!user) return authJson("តំណផ្ទៀងផ្ទាត់នេះផុតកំណត់ បានប្រើរួច ឬមិនត្រឹមត្រូវ។", 410);
    const review = createApprovalReview(user.id, config.to);
    try {
      await sendApprovalEmail(user.email, review.token, review.hash);
      markApprovalDelivery(review.hash, "sent");
    } catch {
      markApprovalDelivery(review.hash, "failed");
      return authJson("អ៊ីមែលបានផ្ទៀងផ្ទាត់ ប៉ុន្តែមិនអាចផ្ញើសំណើទៅអ្នកគ្រប់គ្រងបានទេ។ សូមចុះឈ្មោះម្ដងទៀតដោយព័ត៌មានដដែល ដើម្បីផ្ញើសំណើឡើងវិញ។", 503);
    }
    return Response.json({
      status: "pending",
      message: "អ៊ីមែលបានផ្ទៀងផ្ទាត់ ហើយសំណើត្រូវបានផ្ញើទៅអ្នកគ្រប់គ្រង។ អ្នកអាចចូលបានបន្ទាប់ពីមានការអនុម័ត។",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ApprovalMailConfigurationError) {
      return authJson("ការផ្ទៀងផ្ទាត់មិនទាន់រួចរាល់ទេ។ សូមទាក់ទងអ្នកគ្រប់គ្រង។", 503);
    }
    return authJson("មិនអាចផ្ទៀងផ្ទាត់អ៊ីមែលបានទេ។ សូមសាកល្បងម្ដងទៀត។", 503);
  }
}
