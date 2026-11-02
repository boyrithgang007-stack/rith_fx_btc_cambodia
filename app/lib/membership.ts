import { createHash, randomBytes } from "node:crypto";
import type Database from "better-sqlite3";

export type Membership = "pending" | "approved" | "rejected";
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export function initializeMembership(db: Database.Database) {
  db.transaction(() => {
    const columns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
    if (!columns.some(c => c.name === "status")) {
      db.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected'))");
      // Existing accounts retain access; every future registration starts pending.
      db.exec("UPDATE users SET status = 'approved'");
    }
    if (!columns.some(c => c.name === "email_verified")) {
      db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1 CHECK(email_verified IN (0,1))");
      db.exec("UPDATE users SET email_verified = 0 WHERE status = 'pending'");
    }
    db.exec(`CREATE TABLE IF NOT EXISTS membership_reviews (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      consumed_at INTEGER,
      decision TEXT,
      recipient TEXT NOT NULL,
      delivery TEXT NOT NULL DEFAULT 'pending'
    ); CREATE INDEX IF NOT EXISTS membership_reviews_user ON membership_reviews(user_id);
    CREATE TABLE IF NOT EXISTS email_verifications (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      consumed_at INTEGER,
      delivery TEXT NOT NULL DEFAULT 'pending'
    ); CREATE INDEX IF NOT EXISTS email_verifications_user ON email_verifications(user_id);`);
  }).immediate();
}

export function issueEmailVerification(db: Database.Database, userId: string, now = Date.now()) {
  const token = randomBytes(32).toString("base64url");
  const hash = tokenHash(token);
  db.transaction(() => {
    const user = db.prepare("SELECT status, email_verified FROM users WHERE id = ?").get(userId) as {status: string; email_verified: number} | undefined;
    if (user?.status !== "pending" || user.email_verified !== 0) throw new Error("Account is not awaiting email verification");
    db.prepare("UPDATE email_verifications SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL").run(now,userId);
    db.prepare("INSERT INTO email_verifications (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)").run(hash,userId,now+24*60*60*1000,now);
  })();
  return {token,hash};
}

export function verifyEmailAddress(db: Database.Database, token: unknown, now = Date.now()) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return db.transaction(() => {
    const verification = db.prepare(`SELECT u.id, u.email FROM email_verifications v JOIN users u ON u.id=v.user_id
      WHERE v.token_hash=? AND v.consumed_at IS NULL AND v.expires_at>? AND u.status='pending' AND u.email_verified=0`)
      .get(tokenHash(token),now) as {id:string;email:string} | undefined;
    if (!verification) return null;
    db.prepare("UPDATE users SET email_verified = 1 WHERE id = ? AND status = 'pending' AND email_verified = 0").run(verification.id);
    db.prepare("UPDATE email_verifications SET consumed_at=? WHERE token_hash=? AND consumed_at IS NULL").run(now,tokenHash(token));
    return verification;
  })();
}

export function issueReview(db: Database.Database, userId: string, recipient: string, now = Date.now()) {
  const token = randomBytes(32).toString("base64url");
  const hash = tokenHash(token);
  db.transaction(() => {
    const user = db.prepare("SELECT status, email_verified FROM users WHERE id = ?").get(userId) as {status: string; email_verified: number} | undefined;
    if (user?.status !== "pending" || user.email_verified !== 1) throw new Error("Account is not ready for membership review");
    db.prepare("UPDATE membership_reviews SET consumed_at = ?, decision = 'superseded' WHERE user_id = ? AND consumed_at IS NULL").run(now,userId);
    db.prepare("INSERT INTO membership_reviews (token_hash,user_id,expires_at,created_at,recipient) VALUES (?,?,?,?,?)").run(hash,userId,now+72*60*60*1000,now,recipient);
  })();
  return {token,hash};
}

export function reviewDetails(db: Database.Database, token: unknown, now = Date.now()) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return (db.prepare(`SELECT u.id, u.email, r.expires_at FROM membership_reviews r JOIN users u ON u.id=r.user_id
    WHERE r.token_hash=? AND r.consumed_at IS NULL AND r.expires_at>? AND u.status='pending' AND u.email_verified=1`).get(tokenHash(token),now) as {id:string;email:string;expires_at:number} | undefined) ?? null;
}

export function decideReview(db: Database.Database, token: unknown, decision: "approved" | "rejected", now = Date.now()) {
  return db.transaction(() => {
    const review = reviewDetails(db,token,now);
    if (!review) return false;
    db.prepare("UPDATE users SET status = ? WHERE id = ? AND status = 'pending'").run(decision,review.id);
    db.prepare("UPDATE membership_reviews SET consumed_at=?, decision=? WHERE user_id=? AND consumed_at IS NULL").run(now,decision,review.id);
    return true;
  })();
}
