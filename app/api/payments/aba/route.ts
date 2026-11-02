import { randomBytes } from "node:crypto";
import { allowAuthAttempt, getCurrentUser } from "@/app/lib/auth";
import { authJson, isSameOriginRequest, readAuthJson } from "@/app/lib/auth-http";
import { createAbaQr, parsePaymentAmount, paymentConfig, PaymentConfigurationError } from "@/app/lib/payments/aba";
import { createPaymentRecord, listPaymentRecords, paymentRecord, setPaymentQr, setPaymentStatus } from "@/app/lib/payments/store";
export const runtime="nodejs";
export async function GET() {
  const user=await getCurrentUser();
  if(!user)return authJson("Please sign in to an approved account.",401);
  let configured=false;
  try { paymentConfig(); configured=true; } catch {}
  return Response.json({configured,payments:listPaymentRecords(user.id)},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(request: Request) {
  if(!isSameOriginRequest(request))return authJson("Request origin rejected.",403);
  const user=await getCurrentUser();
  if(!user)return authJson("Please sign in to an approved account.",401);
  if(!allowAuthAttempt(`payment-create:${user.id}`,5,60000))return authJson("Too many payment requests. Retry in one minute.",429);
  const body=await readAuthJson(request), amount=parsePaymentAmount(body?.amount,body?.currency);
  if(!amount)return authJson("Enter a valid USD or KHR amount within the supported limit.",400);
  const id=randomBytes(10).toString("hex");
  try {
    const config=paymentConfig();
    createPaymentRecord(id,user.id,amount.amount,amount.currency,config.mode);
    const qr=await createAbaQr(id,amount.amount,amount.currency);
    setPaymentQr(user.id,id,qr.qrImage);
    return Response.json({payment:paymentRecord(user.id,id)},{status:201,headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    setPaymentStatus(user.id,id,"failed");
    return authJson(error instanceof PaymentConfigurationError ? "The administrator must configure ABA PayWay merchant credentials." : "Unable to generate payment QR. No payment has been confirmed.",error instanceof PaymentConfigurationError ? 503 : 502);
  }
}
