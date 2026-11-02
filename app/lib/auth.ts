import { issueReview, reviewDetails, decideReview, issueEmailVerification, verifyEmailAddress, type Membership } from "./membership";
import { randomBytes, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { execute, query } from "./database";

export type AuthUser = { id: string; email: string; displayName?: string | null; avatarDataUrl?: string | null; role?: "member" | "admin" };
type UserRecord = AuthUser & { password_hash: string; status: Membership; access_enabled: number; email_verified: number };
type RateLimit = { count: number; resetAt: number };

const SESSION_COOKIE = "market_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const rateLimits = new Map<string, RateLimit>();
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(randomBytes(32).toString("base64url"), 12);
let developmentSessionKey: Uint8Array | undefined;

export async function getActiveMemberCount() {
  const rows = await query<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM users WHERE role = 'member' AND status = 'approved' AND access_enabled = 1",
  );
  return rows[0]?.count ?? 0;
}

export const createApprovalReview = (userId: string, recipient: string) => issueReview(userId,recipient);
export const getApprovalReview = (token: unknown) => reviewDetails(token);
export const decideApprovalReview = (token: unknown, decision: "approved" | "rejected") => decideReview(token,decision);
export function markApprovalDelivery(hash: string, status: "sent" | "failed") { return execute("UPDATE membership_reviews SET delivery=? WHERE token_hash=?", [status,hash]); }
export const createEmailVerification = (userId: string) => issueEmailVerification(userId);
export const verifyUserEmail = (token: unknown) => verifyEmailAddress(token);
export function markEmailVerificationDelivery(hash: string, status: "sent" | "failed") { return execute("UPDATE email_verifications SET delivery=? WHERE token_hash=?", [status,hash]); }

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

  developmentSessionKey ??= randomBytes(32);
  return developmentSessionKey;
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

export async function getUserByEmail(email: string) {
  const rows = await query<UserRecord>("SELECT id, email, password_hash, status, access_enabled, role, email_verified FROM users WHERE email = ?", [email]);
  return rows[0];
}

export async function getUserById(id: string) {
  const rows = await query<AuthUser>("SELECT id, email, display_name AS displayName, avatar_data_url AS avatarDataUrl, role FROM users WHERE id = ?", [id]);
  return rows[0];
}

export async function updateUserProfile(id: string, displayName: string, avatarDataUrl: string | null, passwordHash?: string) {
  if (passwordHash) await execute("UPDATE users SET display_name = ?, avatar_data_url = ?, password_hash = ? WHERE id = ?", [displayName, avatarDataUrl, passwordHash, id]);
  else await execute("UPDATE users SET display_name = ?, avatar_data_url = ? WHERE id = ?", [displayName, avatarDataUrl, id]);
  return getUserById(id);
}

export async function createUser(email: string, passwordHash: string, registrationIp: string | null = null, emailVerified = true): Promise<AuthUser> {
  const user = { id: randomUUID(), email };
  await execute("INSERT INTO users (id, email, password_hash, status, role, access_enabled, registration_ip, email_verified) VALUES (?, ?, ?, 'pending', 'member', 1, ?, ?)", [user.id, user.email, passwordHash, registrationIp, emailVerified ? 1 : 0]);
  return user;
}

export function recordSuccessfulLogin(userId: string, ip: string | null) {
  if (ip) return execute("UPDATE users SET last_login_ip = ? WHERE id = ?", [ip, userId]);
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
  const members = await query<{status: Membership; accessEnabled: number; emailVerified: number}>("SELECT status, access_enabled AS accessEnabled, email_verified AS emailVerified FROM users WHERE id = ?", [user.id]);
  const member = members[0];
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
  let payload;
  try { ({ payload } = await jwtVerify(token, sessionKey(), { algorithms: ["HS256"] })); }
  catch { return null; }
  if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
  const users = await query<AuthUser>("SELECT id, email, display_name AS displayName, avatar_data_url AS avatarDataUrl, role FROM users WHERE id = ? AND status = 'approved' AND access_enabled = 1 AND email_verified = 1", [payload.sub]);
  return users[0] ?? null;
}
