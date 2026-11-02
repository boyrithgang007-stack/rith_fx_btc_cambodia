import { allowAuthAttempt, getCurrentUser } from "@/app/lib/auth";
import { authJson, isSameOriginRequest } from "@/app/lib/auth-http";
import { verifyAbaPayment, paymentConfig } from "@/app/lib/payments/aba";
import { paymentRecord, setPaymentStatus } from "@/app/lib/payments/store";
export const runtime="nodejs";
export async function POST(request: Request, {params}: {params:Promise<{id:string}>}) {
  if(!isSameOriginRequest(request))return authJson("Request origin rejected.",403);
  const user=await getCurrentUser();
  if(!user)return authJson("Please sign in to an approved account.",401);
  if(!allowAuthAttempt(`payment-check:${user.id}`,10,60000))return authJson("Too many checks. Retry in one minute.",429);
  const {id}=await params, payment=paymentRecord(user.id,id);
  if(!payment)return authJson("Payment request not found.",404);
  try {
    if(payment.mode!==paymentConfig().mode)return authJson("Payment environment changed. This request cannot be checked in the current environment.",409);
    const status=await verifyAbaPayment(payment.id,payment.amount,payment.currency);
    setPaymentStatus(user.id,id,status);
    return Response.json({payment:paymentRecord(user.id,id)},{headers:{"Cache-Control":"no-store"}});
  } catch { return authJson("Unable to verify payment with ABA. Retry later.",502); }
}
