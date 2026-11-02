import { createHmac } from "node:crypto";

export class PaymentConfigurationError extends Error {}
export class PaymentProviderError extends Error {}
export type Currency = "USD" | "KHR";
export function paymentConfig() {
  const merchant = process.env.ABA_PAYWAY_MERCHANT_ID?.trim();
  const secret = process.env.ABA_PAYWAY_API_KEY?.trim();
  const mode = process.env.ABA_PAYWAY_MODE || "sandbox";
  if (!merchant || !secret || !["sandbox", "production"].includes(mode)) throw new PaymentConfigurationError("Configure ABA PayWay merchant credentials on the server.");
  return { merchant, secret, base: mode === "production" ? "https://checkout.payway.com.kh" : "https://checkout-sandbox.payway.com.kh", mode };
}

export function parsePaymentAmount(value: unknown, currency: unknown): { minor: number; amount: string; currency: Currency } | null {
  if ((currency !== "USD" && currency !== "KHR") || typeof value !== "string" || !/^\d{1,8}(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction=""] = value.split(".");
  if (currency === "KHR" && fraction && Number(fraction) !== 0) return null;
  const minor = currency === "USD" ? Number(whole)*100+Number(fraction.padEnd(2,"0")) : Number(whole);
  const min = currency === "USD" ? 1 : 100;
  const max = currency === "USD" ? 1000000 : 40000000;
  if (!Number.isSafeInteger(minor) || minor < min || minor > max) return null;
  return { minor, amount: currency === "USD" ? (minor/100).toFixed(2) : String(minor), currency };
}

function requestTime() { return new Date().toISOString().replace(/[-:T]/g, "").slice(0,14); }
function signature(values: string[], secret: string) { return createHmac("sha512",secret).update(values.join("")).digest("base64"); }
async function post(path: string, body: Record<string,unknown>, fetcher: typeof fetch) {
  const config=paymentConfig();
  const response=await fetcher(config.base+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new PaymentProviderError("ABA PayWay is unavailable. Please retry later.");
  const result=await response.json();
  if(!["0","00"].includes(String(result.status?.code)))throw new PaymentProviderError("ABA PayWay rejected this request. Check merchant configuration and domain approval.");
  return result;
}

export async function createAbaQr(tranId: string, amount: string, currency: Currency, fetcher: typeof fetch=fetch) {
  try {
    const config=paymentConfig();
    const req_time=requestTime();
    const lifetime="15", template="template3_color";
    const hash=signature([req_time,config.merchant,tranId,amount,"","","","","","purchase","abapay_khqr","","",currency,"","","",lifetime,template],config.secret);
    const response=await post("/api/payment-gateway/v1/payments/generate-qr",{req_time,merchant_id:config.merchant,tran_id:tranId,amount,currency,purchase_type:"purchase",payment_option:"abapay_khqr",lifetime:Number(lifetime),qr_image_template:template,hash},fetcher);
    if (String(response.currency).toUpperCase() !== currency || Number(response.amount) !== Number(amount) || typeof response.qrImage !== "string" || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(response.qrImage) || response.qrImage.length>1500000) throw new PaymentProviderError("ABA returned invalid payment details.");
    return { qrImage: response.qrImage, mode: config.mode };
  } catch(error) {
    if(error instanceof PaymentConfigurationError || error instanceof PaymentProviderError)throw error;
    throw new PaymentProviderError("Unable to generate the ABA payment request.");
  }
}

export async function verifyAbaPayment(tranId: string, amount: string, currency: Currency, fetcher: typeof fetch=fetch) {
  try {
    const config=paymentConfig(), req_time=requestTime();
    const response=await post("/api/payment-gateway/v1/payments/check-transaction-2",{req_time,merchant_id:config.merchant,tran_id:tranId,hash:signature([req_time,config.merchant,tranId],config.secret)},fetcher);
    const data=response.data;
    if(response.status?.tran_id !== tranId)throw new PaymentProviderError("Payment transaction identity does not match.");
    if(data?.payment_status === "APPROVED" && data.payment_status_code === 0) {
      if(data.payment_currency !== currency || !Number.isFinite(Number(data.original_amount)) || Number(data.original_amount)!==Number(amount) || Number(data.payment_amount)!==Number(amount) || Number(data.refund_amount)!==0)throw new PaymentProviderError("Payment amount or currency does not match the invoice.");
      return "paid" as const;
    }
    return "pending" as const;
  } catch(error) {
    if(error instanceof PaymentConfigurationError || error instanceof PaymentProviderError)throw error;
    throw new PaymentProviderError("Unable to verify the ABA payment. It has not been marked paid.");
  }
}
