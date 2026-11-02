import { randomUUID } from "node:crypto";
import { execute, query, transaction } from "../database";
import { openCredentials, sealCredentials } from "../exchanges/vault";

export const EA_SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"] as const;
export type EaSymbol = typeof EA_SYMBOLS[number];
export type EaCredentials = { apiKey: string; apiSecret: string };
export type EaSettings = {
  symbol: EaSymbol;
  capitalUsd: number;
  riskPercent: number;
  leverage: number;
  enabled: boolean;
  updatedAt: string | null;
};

const DEFAULT_SETTINGS: EaSettings = {
  symbol: "BTCUSDT",
  capitalUsd: 100,
  riskPercent: 1,
  leverage: 3,
  enabled: false,
  updatedAt: null,
};

function audit(userId: string, action: string, at = new Date().toISOString(), client?: Parameters<typeof execute>[2]) {
  return execute("INSERT INTO ea_bot_audit_events (id,user_id,action,created_at) VALUES (?,?,?,?)",
    [randomUUID(), userId, action.slice(0, 100), at], client);
}

function amountCents(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1 || value > 1_000_000) return null;
  const scaled = value * 100;
  const rounded = Math.round(scaled);
  return Math.abs(scaled - rounded) < 0.000001 ? rounded : null;
}

export function parseEaSettings(value: unknown): Omit<EaSettings, "updatedAt"> | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const capitalCents = amountCents(record.capitalUsd);
  if (!EA_SYMBOLS.includes(record.symbol as EaSymbol)
    || capitalCents === null
    || typeof record.riskPercent !== "number"
    || !Number.isFinite(record.riskPercent)
    || record.riskPercent < 0.1
    || record.riskPercent > 1
    || Math.abs(record.riskPercent * 10 - Math.round(record.riskPercent * 10)) > 0.000001
    || typeof record.leverage !== "number"
    || !Number.isInteger(record.leverage)
    || record.leverage < 1
    || record.leverage > 5
    || typeof record.enabled !== "boolean") return null;
  return {
    symbol: record.symbol as EaSymbol,
    capitalUsd: capitalCents / 100,
    riskPercent: record.riskPercent,
    leverage: record.leverage,
    enabled: record.enabled,
  };
}

export function parseEaCredentials(value: unknown): EaCredentials | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.apiKey !== "string" || typeof record.apiSecret !== "string"
    || !/^[A-Za-z0-9]{16,256}$/.test(record.apiKey)
    || !/^[A-Za-z0-9]{16,256}$/.test(record.apiSecret)) return null;
  return { apiKey: record.apiKey, apiSecret: record.apiSecret };
}

export async function getEaSettings(userId: string): Promise<EaSettings> {
  const rows = await query<{ symbol: EaSymbol; capitalCents: number; riskTenths: number; leverage: number; enabled: number; updatedAt: string }>(`SELECT symbol, capital_cents AS capitalCents, risk_tenths AS riskTenths,
    leverage, enabled, updated_at AS updatedAt FROM ea_bot_settings WHERE user_id=?`, [userId]);
  const row = rows[0];
  return row ? {
    symbol: row.symbol,
    capitalUsd: row.capitalCents / 100,
    riskPercent: row.riskTenths / 10,
    leverage: row.leverage,
    enabled: row.enabled === 1,
    updatedAt: row.updatedAt,
  } : DEFAULT_SETTINGS;
}

export async function hasEaCredentials(userId: string) {
  return (await query("SELECT 1 FROM ea_bot_credentials WHERE user_id=?", [userId])).length > 0;
}

export async function getEaCredentials(userId: string) {
  const rows = await query<{ encrypted: string }>("SELECT encrypted_credentials AS encrypted FROM ea_bot_credentials WHERE user_id=?", [userId]);
  const row = rows[0];
  if (!row) return null;
  const credentials = parseEaCredentials(openCredentials(row.encrypted, `ea:${userId}`));
  if (!credentials) throw new Error("Invalid EA credential record.");
  return credentials;
}

export async function saveEaSettings(userId: string, value: Omit<EaSettings, "updatedAt">, credentials?: EaCredentials) {
  const updatedAt = new Date().toISOString();
  await transaction(async client => {
    const previous = await getEaSettings(userId);
    await execute(`INSERT INTO ea_bot_settings
      (user_id,symbol,capital_cents,risk_tenths,leverage,enabled,testnet_verified,updated_at)
      VALUES (?,?,?,?,?,?,0,?)
      ON CONFLICT(user_id) DO UPDATE SET symbol=excluded.symbol,capital_cents=excluded.capital_cents,
      risk_tenths=excluded.risk_tenths,leverage=excluded.leverage,enabled=excluded.enabled,
      updated_at=excluded.updated_at`, [
      userId, value.symbol, Math.round(value.capitalUsd * 100), Math.round(value.riskPercent * 10),
      value.leverage, value.enabled ? 1 : 0, updatedAt,
    ], client);
    if (credentials) {
      const encrypted = sealCredentials(credentials, `ea:${userId}`);
      await execute(`INSERT INTO ea_bot_credentials (user_id,encrypted_credentials,updated_at)
        VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET
        encrypted_credentials=excluded.encrypted_credentials,updated_at=excluded.updated_at`,
      [userId, encrypted, updatedAt], client);
      await execute("UPDATE ea_bot_settings SET testnet_verified=0,enabled=0 WHERE user_id=?", [userId], client);
      await audit(userId, "ea.testnet_credentials.updated", updatedAt, client);
    }
    if (value.enabled && (!(await hasEaCredentials(userId)) || !(await isEaTestnetVerified(userId)))) {
      throw new Error("Verify a Binance Futures Testnet key before enabling the EA.");
    }
    if (previous.enabled !== value.enabled) await audit(userId, value.enabled ? "ea.testnet.enabled" : "ea.disabled", updatedAt, client);
    await audit(userId, "ea.settings.updated", updatedAt, client);
  });
  return getEaSettings(userId);
}

export function markEaTestnetVerified(userId: string) {
  const updatedAt = new Date().toISOString();
  return transaction(async client => {
    await execute("UPDATE ea_bot_settings SET testnet_verified=1,updated_at=? WHERE user_id=?", [updatedAt, userId], client);
    await audit(userId, "ea.testnet.verified", updatedAt, client);
  });
}

export async function isEaTestnetVerified(userId: string) {
  const rows = await query<{ verified: number }>("SELECT testnet_verified AS verified FROM ea_bot_settings WHERE user_id=?", [userId]);
  return rows[0]?.verified === 1;
}

export async function disableEa(userId: string, reason = "ea.disabled") {
  const current = await getEaSettings(userId);
  if (!current.enabled) return;
  const updatedAt = new Date().toISOString();
  await transaction(async client => {
    await execute("UPDATE ea_bot_settings SET enabled=0,updated_at=? WHERE user_id=?", [updatedAt, userId], client);
    await audit(userId, reason, updatedAt, client);
  });
}

export function removeEaCredentials(userId: string) {
  return transaction(async client => {
    const updatedAt = new Date().toISOString();
    await execute("UPDATE ea_bot_settings SET enabled=0,testnet_verified=0,updated_at=? WHERE user_id=?", [updatedAt, userId], client);
    const removed = await execute("DELETE FROM ea_bot_credentials WHERE user_id=?", [userId], client);
    if (removed) await audit(userId, "ea.testnet_credentials.removed", updatedAt, client);
    return removed > 0;
  });
}

export async function claimEaRun(userId: string, symbol: EaSymbol, candleTime: number) {
  const now = new Date().toISOString();
  const id = randomUUID();
  const inserted = await query<{ id: string }>(`INSERT INTO ea_bot_runs
    (id,user_id,symbol,candle_time,status,message,created_at,updated_at)
    VALUES (?,?,?,?,'processing','Processing confirmed signal.',?,?) ON CONFLICT(user_id,symbol,candle_time) DO NOTHING RETURNING id`,
  [id, userId, symbol, candleTime, now, now]);
  return inserted.length ? id : null;
}

export async function hasEaRun(userId: string, symbol: EaSymbol, candleTime: number) {
  return (await query("SELECT 1 FROM ea_bot_runs WHERE user_id=? AND symbol=? AND candle_time=?", [userId, symbol, candleTime])).length > 0;
}

export function updateEaRun(id: string, status: "skipped" | "opened" | "closed" | "failed" | "halted", message: string, orderId?: string) {
  return execute(`UPDATE ea_bot_runs SET status=?,message=?,order_id=?,updated_at=? WHERE id=?`,
    [status, message.slice(0, 300), orderId ?? null, new Date().toISOString(), id]);
}

export function listEaRuns(userId: string) {
  return query(`SELECT symbol,candle_time AS candleTime,status,message,order_id AS orderId,created_at AS createdAt
    FROM ea_bot_runs WHERE user_id=? ORDER BY created_at DESC LIMIT 20`, [userId]);
}

export function listEaAuditEvents(userId: string) {
  return query(`SELECT action,created_at AS createdAt FROM ea_bot_audit_events
    WHERE user_id=? ORDER BY created_at DESC LIMIT 20`, [userId]);
}

export function listEnabledEaUsers() {
  return query<{ userId: string; symbol: EaSymbol; capitalCents: number; riskTenths: number; leverage: number }>(`SELECT s.user_id AS userId, s.symbol, s.capital_cents AS capitalCents,
    s.risk_tenths AS riskTenths, s.leverage
    FROM ea_bot_settings s JOIN users u ON u.id=s.user_id
    WHERE s.enabled=1 AND s.testnet_verified=1 AND u.status='approved' AND u.access_enabled=1 AND u.email_verified=1`);
}
