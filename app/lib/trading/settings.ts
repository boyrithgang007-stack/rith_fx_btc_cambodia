import { database } from "../auth";

export type TradingRiskSettings = {
  maxOrderUsd: number;
  dailyLimitUsd: number;
  updatedAt: string | null;
};

const DEFAULT_SETTINGS: TradingRiskSettings = {
  maxOrderUsd: 50,
  dailyLimitUsd: 200,
  updatedAt: null,
};

database.exec(`CREATE TABLE IF NOT EXISTS trading_risk_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  max_order_cents INTEGER NOT NULL CHECK(max_order_cents BETWEEN 100 AND 10000000),
  daily_limit_cents INTEGER NOT NULL CHECK(daily_limit_cents BETWEEN 100 AND 100000000),
  updated_at TEXT NOT NULL
);`);

function cents(value: unknown, maximum: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1 || value > maximum) return null;
  const scaled = value * 100;
  const rounded = Math.round(scaled);
  return Math.abs(scaled - rounded) < 0.000001 ? rounded : null;
}

export function parseTradingRiskSettings(value: unknown): Omit<TradingRiskSettings, "updatedAt"> | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const maxOrderCents = cents(record.maxOrderUsd, 100000);
  const dailyLimitCents = cents(record.dailyLimitUsd, 1000000);
  if (maxOrderCents === null || dailyLimitCents === null || dailyLimitCents < maxOrderCents) return null;
  return { maxOrderUsd: maxOrderCents / 100, dailyLimitUsd: dailyLimitCents / 100 };
}

export function getTradingRiskSettings(userId: string): TradingRiskSettings {
  const row = database.prepare("SELECT max_order_cents AS maxOrderCents, daily_limit_cents AS dailyLimitCents, updated_at AS updatedAt FROM trading_risk_settings WHERE user_id=?").get(userId) as { maxOrderCents: number; dailyLimitCents: number; updatedAt: string } | undefined;
  return row
    ? { maxOrderUsd: row.maxOrderCents / 100, dailyLimitUsd: row.dailyLimitCents / 100, updatedAt: row.updatedAt }
    : DEFAULT_SETTINGS;
}

export function saveTradingRiskSettings(userId: string, value: Omit<TradingRiskSettings, "updatedAt">) {
  const updatedAt = new Date().toISOString();
  database.prepare(`INSERT INTO trading_risk_settings (user_id,max_order_cents,daily_limit_cents,updated_at)
    VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET
    max_order_cents=excluded.max_order_cents,daily_limit_cents=excluded.daily_limit_cents,updated_at=excluded.updated_at`)
    .run(userId, Math.round(value.maxOrderUsd * 100), Math.round(value.dailyLimitUsd * 100), updatedAt);
  return { ...value, updatedAt };
}
