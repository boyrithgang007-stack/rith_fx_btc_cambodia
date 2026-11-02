import { randomUUID } from "node:crypto";
import { database } from "../auth";
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

database.exec(`CREATE TABLE IF NOT EXISTS ea_bot_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL CHECK(symbol IN ('BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT')),
  capital_cents INTEGER NOT NULL CHECK(capital_cents BETWEEN 100 AND 100000000),
  risk_tenths INTEGER NOT NULL CHECK(risk_tenths BETWEEN 1 AND 10),
  leverage INTEGER NOT NULL CHECK(leverage BETWEEN 1 AND 5),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  testnet_verified INTEGER NOT NULL DEFAULT 0 CHECK(testnet_verified IN (0,1)),
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ea_bot_credentials (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  encrypted_credentials TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ea_bot_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  candle_time INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('processing','skipped','opened','closed','failed','halted')),
  message TEXT NOT NULL,
  order_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, symbol, candle_time)
);
CREATE TABLE IF NOT EXISTS ea_bot_audit_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ea_bot_runs_user_created ON ea_bot_runs(user_id, created_at DESC);`);

function audit(userId: string, action: string, at = new Date().toISOString()) {
  database.prepare("INSERT INTO ea_bot_audit_events (id,user_id,action,created_at) VALUES (?,?,?,?)")
    .run(randomUUID(), userId, action.slice(0, 100), at);
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

export function getEaSettings(userId: string): EaSettings {
  const row = database.prepare(`SELECT symbol, capital_cents AS capitalCents, risk_tenths AS riskTenths,
    leverage, enabled, updated_at AS updatedAt FROM ea_bot_settings WHERE user_id=?`).get(userId) as
    { symbol: EaSymbol; capitalCents: number; riskTenths: number; leverage: number; enabled: number; updatedAt: string } | undefined;
  return row ? {
    symbol: row.symbol,
    capitalUsd: row.capitalCents / 100,
    riskPercent: row.riskTenths / 10,
    leverage: row.leverage,
    enabled: row.enabled === 1,
    updatedAt: row.updatedAt,
  } : DEFAULT_SETTINGS;
}

export function hasEaCredentials(userId: string) {
  return Boolean(database.prepare("SELECT 1 FROM ea_bot_credentials WHERE user_id=?").get(userId));
}

export function getEaCredentials(userId: string) {
  const row = database.prepare("SELECT encrypted_credentials AS encrypted FROM ea_bot_credentials WHERE user_id=?").get(userId) as { encrypted: string } | undefined;
  if (!row) return null;
  const credentials = parseEaCredentials(openCredentials(row.encrypted, `ea:${userId}`));
  if (!credentials) throw new Error("Invalid EA credential record.");
  return credentials;
}

export function saveEaSettings(userId: string, value: Omit<EaSettings, "updatedAt">, credentials?: EaCredentials) {
  const updatedAt = new Date().toISOString();
  const previous = getEaSettings(userId);
  database.transaction(() => {
    database.prepare(`INSERT INTO ea_bot_settings
      (user_id,symbol,capital_cents,risk_tenths,leverage,enabled,testnet_verified,updated_at)
      VALUES (?,?,?,?,?,?,0,?)
      ON CONFLICT(user_id) DO UPDATE SET symbol=excluded.symbol,capital_cents=excluded.capital_cents,
      risk_tenths=excluded.risk_tenths,leverage=excluded.leverage,enabled=excluded.enabled,
      updated_at=excluded.updated_at`).run(
      userId, value.symbol, Math.round(value.capitalUsd * 100), Math.round(value.riskPercent * 10),
      value.leverage, value.enabled ? 1 : 0, updatedAt,
    );
    if (credentials) {
      const encrypted = sealCredentials(credentials, `ea:${userId}`);
      database.prepare(`INSERT INTO ea_bot_credentials (user_id,encrypted_credentials,updated_at)
        VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET
        encrypted_credentials=excluded.encrypted_credentials,updated_at=excluded.updated_at`)
        .run(userId, encrypted, updatedAt);
      database.prepare("UPDATE ea_bot_settings SET testnet_verified=0,enabled=0 WHERE user_id=?").run(userId);
      audit(userId, "ea.testnet_credentials.updated", updatedAt);
    }
    if (value.enabled && (!hasEaCredentials(userId) || !isEaTestnetVerified(userId))) {
      throw new Error("Verify a Binance Futures Testnet key before enabling the EA.");
    }
    if (previous.enabled !== value.enabled) audit(userId, value.enabled ? "ea.testnet.enabled" : "ea.disabled", updatedAt);
    audit(userId, "ea.settings.updated", updatedAt);
  })();
  return getEaSettings(userId);
}

export function markEaTestnetVerified(userId: string) {
  const updatedAt = new Date().toISOString();
  database.transaction(() => {
    database.prepare("UPDATE ea_bot_settings SET testnet_verified=1,updated_at=? WHERE user_id=?").run(updatedAt, userId);
    audit(userId, "ea.testnet.verified", updatedAt);
  })();
}

export function isEaTestnetVerified(userId: string) {
  const row = database.prepare("SELECT testnet_verified AS verified FROM ea_bot_settings WHERE user_id=?").get(userId) as { verified: number } | undefined;
  return row?.verified === 1;
}

export function disableEa(userId: string, reason = "ea.disabled") {
  const current = getEaSettings(userId);
  if (!current.enabled) return;
  const updatedAt = new Date().toISOString();
  database.transaction(() => {
    database.prepare("UPDATE ea_bot_settings SET enabled=0,updated_at=? WHERE user_id=?").run(updatedAt, userId);
    audit(userId, reason, updatedAt);
  })();
}

export function removeEaCredentials(userId: string) {
  return database.transaction(() => {
    const updatedAt = new Date().toISOString();
    database.prepare("UPDATE ea_bot_settings SET enabled=0,testnet_verified=0,updated_at=? WHERE user_id=?").run(updatedAt, userId);
    const removed = database.prepare("DELETE FROM ea_bot_credentials WHERE user_id=?").run(userId).changes > 0;
    if (removed) audit(userId, "ea.testnet_credentials.removed", updatedAt);
    return removed;
  })();
}

export function claimEaRun(userId: string, symbol: EaSymbol, candleTime: number) {
  const now = new Date().toISOString();
  const id = randomUUID();
  const result = database.prepare(`INSERT OR IGNORE INTO ea_bot_runs
    (id,user_id,symbol,candle_time,status,message,created_at,updated_at)
    VALUES (?,?,?,?,'processing','Processing confirmed signal.',?,?)`).run(id, userId, symbol, candleTime, now, now);
  return result.changes ? id : null;
}

export function hasEaRun(userId: string, symbol: EaSymbol, candleTime: number) {
  return Boolean(database.prepare("SELECT 1 FROM ea_bot_runs WHERE user_id=? AND symbol=? AND candle_time=?").get(userId, symbol, candleTime));
}

export function updateEaRun(id: string, status: "skipped" | "opened" | "closed" | "failed" | "halted", message: string, orderId?: string) {
  database.prepare(`UPDATE ea_bot_runs SET status=?,message=?,order_id=?,updated_at=? WHERE id=?`)
    .run(status, message.slice(0, 300), orderId ?? null, new Date().toISOString(), id);
}

export function listEaRuns(userId: string) {
  return database.prepare(`SELECT symbol,candle_time AS candleTime,status,message,order_id AS orderId,created_at AS createdAt
    FROM ea_bot_runs WHERE user_id=? ORDER BY created_at DESC LIMIT 20`).all(userId);
}

export function listEaAuditEvents(userId: string) {
  return database.prepare(`SELECT action,created_at AS createdAt FROM ea_bot_audit_events
    WHERE user_id=? ORDER BY created_at DESC LIMIT 20`).all(userId);
}

export function listEnabledEaUsers() {
  return database.prepare(`SELECT s.user_id AS userId, s.symbol, s.capital_cents AS capitalCents,
    s.risk_tenths AS riskTenths, s.leverage
    FROM ea_bot_settings s JOIN users u ON u.id=s.user_id
    WHERE s.enabled=1 AND s.testnet_verified=1 AND u.status='approved' AND u.access_enabled=1 AND u.email_verified=1`)
    .all() as { userId: string; symbol: EaSymbol; capitalCents: number; riskTenths: number; leverage: number }[];
}
