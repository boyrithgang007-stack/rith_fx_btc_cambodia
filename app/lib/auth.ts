import { initializeMembership, issueReview, reviewDetails, decideReview, issueEmailVerification, verifyEmailAddress, type Membership } from "./membership";
import { initializeAdminMembers } from "./admin-members";
import { initializePublicSocialLinks } from "./public-social-links";
import { mkdirSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import path from "node:path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type AuthUser = { id: string; email: string; displayName?: string | null; avatarDataUrl?: string | null; role?: "member" | "admin" };
type UserRecord = AuthUser & { password_hash: string; status: Membership; access_enabled: number; email_verified: number };
type RateLimit = { count: number; resetAt: number };

const SESSION_COOKIE = "market_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const rateLimits = new Map<string, RateLimit>();
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(randomBytes(32).toString("base64url"), 12);
const databasePath = process.env.AUTH_DB_PATH
  ? path.resolve(/* turbopackIgnore: true */ process.env.AUTH_DB_PATH)
  : path.join(process.cwd(), "data", "auth.sqlite");
mkdirSync(path.dirname(databasePath), { recursive: true });

export const database = new Database(databasePath);
database.pragma("busy_timeout = 5000");
database.pragma("journal_mode = WAL");
database.pragma("foreign_keys = ON");
database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS app_secrets (
    name TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

database.transaction(() => {
  const userColumns = new Set(
    (database.prepare("PRAGMA table_info(users)").all() as { name: string }[]).map((column) => column.name),
  );
  if (!userColumns.has("display_name")) database.exec("ALTER TABLE users ADD COLUMN display_name TEXT");
  if (!userColumns.has("avatar_data_url")) database.exec("ALTER TABLE users ADD COLUMN avatar_data_url TEXT");
}).immediate();

initializeMembership(database);
initializeAdminMembers(database);
initializePublicSocialLinks(database);

export function getActiveMemberCount() {
  const result = database.prepare(
    "SELECT COUNT(*) AS count FROM users WHERE role = 'member' AND status = 'approved' AND access_enabled = 1",
  ).get() as { count: number };
  return result.count;
}

export const createApprovalReview = (userId: string, recipient: string) => issueReview(database,userId,recipient);
export const getApprovalReview = (token: unknown) => reviewDetails(database,token);
export const decideApprovalReview = (token: unknown, decision: "approved" | "rejected") => decideReview(database,token,decision);
export function markApprovalDelivery(hash: string, status: "sent" | "failed") { database.prepare("UPDATE membership_reviews SET delivery=? WHERE token_hash=?").run(status,hash); }
export const createEmailVerification = (userId: string) => issueEmailVerification(database,userId);
export const verifyUserEmail = (token: unknown) => verifyEmailAddress(database,token);
export function markEmailVerificationDelivery(hash: string, status: "sent" | "failed") { database.prepare("UPDATE email_verifications SET delivery=? WHERE token_hash=?").run(status,hash); }

export class AuthConfigurationError extends Error {}

export function assertAuthConfigured() {
  sessionKey();
}

function sessionKey() {
  const configuredSecret = process.env.AUTH_SECRET?.trim();
  if (configuredSecret) {
    if (Buffer.byteLength(configuredSecret, "utf8") < 32) throw new AuthConfigurationError("AUTH_SECRET must be at least 32 bytes.");
    return new TextEncoder().encode(configuredSecret);
  }
  if (process.env.NODE_ENV === "production") throw new AuthConfigurationError("AUTH_SECRET is required in production.");

  const existing = database.prepare("SELECT value FROM app_secrets WHERE name = ?").get("development-session-key") as { value: string } | undefined;
  if (existing) return new TextEncoder().encode(existing.value);
  const generated = randomBytes(32).toString("base64url");
  database.prepare("INSERT INTO app_secrets (name, value) VALUES (?, ?)").run("development-session-key", generated);
  return new TextEncoder().encode(generated);
}

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function passwordIsValid(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 12
    && Buffer.byteLength(value, "utf8") <= 72;
}

export function getUserByEmail(email: string) {
  return database.prepare("SELECT id, email, password_hash, status, access_enabled, role, email_verified FROM users WHERE email = ?").get(email) as UserRecord | undefined;
}

export function getUserById(id: string) {
  return database.prepare("SELECT id, email, display_name AS displayName, avatar_data_url AS avatarDataUrl, role FROM users WHERE id = ?").get(id) as AuthUser | undefined;
}

export function updateUserProfile(id: string, displayName: string, avatarDataUrl: string | null, passwordHash?: string) {
  const update = database.transaction(() => {
    if (passwordHash) {
      database.prepare("UPDATE users SET display_name = ?, avatar_data_url = ?, password_hash = ? WHERE id = ?")
        .run(displayName, avatarDataUrl, passwordHash, id);
    } else {
      database.prepare("UPDATE users SET display_name = ?, avatar_data_url = ? WHERE id = ?")
        .run(displayName, avatarDataUrl, id);
    }
    return getUserById(id);
  });
  return update();
}

export function createUser(email: string, passwordHash: string, registrationIp: string | null = null, emailVerified = true): AuthUser {
  const user = { id: randomUUID(), email };
  database.prepare("INSERT INTO users (id, email, password_hash, status, role, access_enabled, registration_ip, email_verified) VALUES (?, ?, ?, 'pending', 'member', 1, ?, ?)").run(user.id, user.email, passwordHash, registrationIp, emailVerified ? 1 : 0);
  return user;
}

export function recordSuccessfulLogin(userId: string, ip: string | null) {
  if (ip) database.prepare("UPDATE users SET last_login_ip = ? WHERE id = ?").run(ip, userId);
}

export function verifyPassword(password: string, passwordHash = DUMMY_PASSWORD_HASH) {
  return bcrypt.compare(password, passwordHash);
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export function allowAuthAttempt(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (rateLimits.size > 1000) {
    for (const [entry, value] of rateLimits) if (value.resetAt <= now) rateLimits.delete(entry);
  }
  const current = rateLimits.get(key);
  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function getClientKey(request: Request) {
  return request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || "local";
}

export function getClientIp(request: Request): string | null {
  const ip = request.headers.get("x-real-ip")?.trim();
  return ip && isIP(ip) ? ip : null;
}

export async function createSession(user: AuthUser) {
  const member = database.prepare("SELECT status, access_enabled AS accessEnabled, email_verified AS emailVerified FROM users WHERE id = ?").get(user.id) as {status: Membership; accessEnabled: number; emailVerified: number} | undefined;
  if (member?.status !== "approved" || member.accessEnabled !== 1 || member.emailVerified !== 1) throw new Error("Email verification and membership approval required.");
  const token = await new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(sessionKey());
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    const user = database.prepare("SELECT id, email, display_name AS displayName, avatar_data_url AS avatarDataUrl, role FROM users WHERE id = ? AND status = 'approved' AND access_enabled = 1 AND email_verified = 1").get(payload.sub) as AuthUser | undefined;
    return user ?? null;
  } catch {
    return null;
  }
}
