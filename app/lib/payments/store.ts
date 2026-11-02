import { database } from "../auth";
import type { Currency } from "./aba";

database.exec(`CREATE TABLE IF NOT EXISTS payment_requests (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 amount TEXT NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL,
 qr_image TEXT, mode TEXT NOT NULL, created_at TEXT NOT NULL
);`);
export type PaymentRequest = { id: string; amount: string; currency: Currency; status: string; qrImage: string | null; mode: string; createdAt: string };
export function createPaymentRecord(id: string, userId: string, amount: string, currency: Currency, mode: string) {
  database.prepare("INSERT INTO payment_requests VALUES (?, ?, ?, ?, 'creating', NULL, ?, ?)").run(id,userId,amount,currency,mode,new Date().toISOString());
}
export function paymentRecord(userId: string, id: string) {
  return database.prepare("SELECT id, amount, currency, status, qr_image AS qrImage, mode, created_at AS createdAt FROM payment_requests WHERE user_id=? AND id=?").get(userId,id) as PaymentRequest | undefined;
}
export function listPaymentRecords(userId: string) {
  return database.prepare("SELECT id, amount, currency, status, qr_image AS qrImage, mode, created_at AS createdAt FROM payment_requests WHERE user_id=? ORDER BY created_at DESC LIMIT 20").all(userId) as PaymentRequest[];
}
export function setPaymentQr(userId: string, id: string, image: string) { database.prepare("UPDATE payment_requests SET qr_image=?,status='pending' WHERE user_id=? AND id=? AND status='creating'").run(image,userId,id); }
export function setPaymentStatus(userId: string, id: string, status: "paid" | "pending" | "failed") { database.prepare("UPDATE payment_requests SET status=? WHERE user_id=? AND id=?").run(status,userId,id); }
