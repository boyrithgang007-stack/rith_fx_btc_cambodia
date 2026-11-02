import { createHash, randomBytes } from "node:crypto";
import { execute, query, transaction } from "./database";

export type Membership = "pending" | "approved" | "rejected";
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const DAY = 24 * 60 * 60 * 1000;

export async function issueEmailVerification(userId: string, now = Date.now()) {
  const token = randomBytes(32).toString("base64url");
  const hash = tokenHash(token);
  await transaction(async client => {
    const users = await query<{ status: string; email_verified: number }>("SELECT status, email_verified FROM users WHERE id=? FOR UPDATE", [userId], client);
    if (users[0]?.status !== "pending" || users[0].email_verified !== 0) throw new Error("Account is not awaiting email verification");
    await execute("UPDATE email_verifications SET consumed_at=? WHERE user_id=? AND consumed_at IS NULL", [now, userId], client);
    await execute("INSERT INTO email_verifications (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)", [hash, userId, now + DAY, now], client);
  });
  return { token, hash };
}

export async function verifyEmailAddress(token: unknown, now = Date.now()) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const hash = tokenHash(token);
  return transaction(async client => {
    const rows = await query<{ id: string; email: string }>(`SELECT u.id, u.email FROM email_verifications v JOIN users u ON u.id=v.user_id
      WHERE v.token_hash=? AND v.consumed_at IS NULL AND v.expires_at>? AND u.status='pending' AND u.email_verified=0 FOR UPDATE OF v, u`, [hash, now], client);
    const verification = rows[0];
    if (!verification) return null;
    await execute("UPDATE users SET email_verified=1 WHERE id=? AND status='pending' AND email_verified=0", [verification.id], client);
    await execute("UPDATE email_verifications SET consumed_at=? WHERE token_hash=? AND consumed_at IS NULL", [now, hash], client);
    return verification;
  });
}

export async function issueReview(userId: string, recipient: string, now = Date.now()) {
  const token = randomBytes(32).toString("base64url");
  const hash = tokenHash(token);
  await transaction(async client => {
    const users = await query<{ status: string; email_verified: number }>("SELECT status, email_verified FROM users WHERE id=? FOR UPDATE", [userId], client);
    if (users[0]?.status !== "pending" || users[0].email_verified !== 1) throw new Error("Account is not ready for membership review");
    await execute("UPDATE membership_reviews SET consumed_at=?, decision='superseded' WHERE user_id=? AND consumed_at IS NULL", [now, userId], client);
    await execute("INSERT INTO membership_reviews (token_hash,user_id,expires_at,created_at,recipient) VALUES (?,?,?,?,?)", [hash, userId, now + 3 * DAY, now, recipient], client);
  });
  return { token, hash };
}

export async function reviewDetails(token: unknown, now = Date.now()) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const rows = await query<{ id: string; email: string; expires_at: number }>(`SELECT u.id, u.email, r.expires_at FROM membership_reviews r JOIN users u ON u.id=r.user_id
    WHERE r.token_hash=? AND r.consumed_at IS NULL AND r.expires_at>? AND u.status='pending' AND u.email_verified=1`, [tokenHash(token), now]);
  return rows[0] ?? null;
}

export async function decideReview(token: unknown, decision: "approved" | "rejected", now = Date.now()) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const hash = tokenHash(token);
  return transaction(async client => {
    const rows = await query<{ id: string }>(`SELECT u.id FROM membership_reviews r JOIN users u ON u.id=r.user_id
      WHERE r.token_hash=? AND r.consumed_at IS NULL AND r.expires_at>? AND u.status='pending' AND u.email_verified=1
      FOR UPDATE OF r, u`, [hash, now], client);
    const review = rows[0];
    if (!review) return false;
    await execute("UPDATE users SET status=? WHERE id=? AND status='pending'", [decision, review.id], client);
    await execute("UPDATE membership_reviews SET consumed_at=?, decision=? WHERE user_id=? AND consumed_at IS NULL", [now, decision, review.id], client);
    return true;
  });
}
