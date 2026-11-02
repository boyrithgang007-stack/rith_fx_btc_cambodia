import { allowAuthAttempt, getClientKey, getApprovalReview, decideApprovalReview } from "@/app/lib/auth";
import { authJson, isSameOriginRequest, readAuthJson } from "@/app/lib/auth-http";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return authJson("សំណើមិនត្រូវបានអនុញ្ញាតទេ។",403);
  if (!allowAuthAttempt(`approval:${getClientKey(request)}`,30,15*60*1000)) return authJson("សំណើច្រើនពេក។ សូមរង់ចាំ 15 នាទី។",429);
  const body = await readAuthJson(request);
  if (!body || !["inspect","approved","rejected"].includes(String(body.action))) return authJson("សំណើមិនត្រឹមត្រូវ។",400);
  try {
    if (body.action === "inspect") {
      const review = await getApprovalReview(body.token);
      if (!review) return authJson("តំណនេះផុតកំណត់ ត្រូវបានប្រើ ឬមិនត្រឹមត្រូវ។",410);
      return Response.json({email:review.email,expiresAt:review.expires_at},{headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
    }
    if (!await decideApprovalReview(body.token,body.action as "approved" | "rejected")) return authJson("តំណនេះផុតកំណត់ ត្រូវបានប្រើ ឬមិនត្រឹមត្រូវ។",410);
    return Response.json({status:body.action},{headers:{"Cache-Control":"no-store"}});
  } catch { return authJson("មិនអាចដំណើរការសំណើបានទេ។ សូមសាកល្បងម្ដងទៀត។",503); }
}
