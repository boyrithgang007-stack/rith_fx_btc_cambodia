import { execute, query } from "../database";
import type { Currency } from "./aba";

export type PaymentRequest = { id: string; amount: string; currency: Currency; status: string; qrImage: string | null; mode: string; createdAt: string };
export async function createPaymentRecord(id: string, userId: string, amount: string, currency: Currency, mode: string) {
  await execute("INSERT INTO payment_requests VALUES (?,?,?,?,'creating',NULL,?,?)", [id, userId, amount, currency, mode, new Date().toISOString()]);
}
export async function paymentRecord(userId: string, id: string) {
  const rows = await query<PaymentRequest>("SELECT id,amount,currency,status,qr_image AS qrImage,mode,created_at AS createdAt FROM payment_requests WHERE user_id=? AND id=?", [userId, id]);
  return rows[0];
}
export function listPaymentRecords(userId: string) {
  return query<PaymentRequest>("SELECT id,amount,currency,status,qr_image AS qrImage,mode,created_at AS createdAt FROM payment_requests WHERE user_id=? ORDER BY created_at DESC LIMIT 20", [userId]);
}
export function setPaymentQr(userId: string, id: string, image: string) {
  return execute("UPDATE payment_requests SET qr_image=?,status='pending' WHERE user_id=? AND id=? AND status='creating'", [image, userId, id]);
}
export function setPaymentStatus(userId: string, id: string, status: "paid" | "pending" | "failed") {
  return execute("UPDATE payment_requests SET status=? WHERE user_id=? AND id=?", [status, userId, id]);
}
