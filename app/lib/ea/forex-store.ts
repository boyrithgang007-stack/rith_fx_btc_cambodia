import { randomUUID } from "node:crypto";
import { database } from "../auth";
import { parseForexRule, type ForexRule } from "./forex-rules";

database.exec(`CREATE TABLE IF NOT EXISTS ea_forex_strategies (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rule_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ea_forex_strategies_owner ON ea_forex_strategies(owner_user_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS ea_bot_audit_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL
);`);

export type SavedForexStrategy = { id: string; name: string; rule: ForexRule; isTemplate: boolean; updatedAt: string };

function audit(userId: string, action: string, at: string) {
  database.prepare("INSERT INTO ea_bot_audit_events (id,user_id,action,created_at) VALUES (?,?,?,?)")
    .run(randomUUID(), userId, action, at);
}

function mapStrategy(row: { id: string; ownerUserId: string | null; name: string; ruleJson: string; updatedAt: string }): SavedForexStrategy | null {
  let serialized: unknown;
  try {
    serialized = JSON.parse(row.ruleJson);
  } catch {
    console.error(`[forex-ea-store] Invalid saved strategy JSON for ${row.id}.`);
    return null;
  }
  const rule = parseForexRule(serialized);
  if (!rule) {
    console.error(`[forex-ea-store] Invalid saved strategy rule for ${row.id}.`);
    return null;
  }
  return { id: row.id, name: rule.name || row.name, rule, isTemplate: row.ownerUserId === null, updatedAt: row.updatedAt };
}

export function listForexStrategies(userId: string) {
  const rows = database.prepare(`SELECT id,owner_user_id AS ownerUserId,name,rule_json AS ruleJson,updated_at AS updatedAt
    FROM ea_forex_strategies WHERE owner_user_id IS NULL OR owner_user_id=?
    ORDER BY owner_user_id IS NOT NULL DESC, updated_at DESC`).all(userId) as
    { id: string; ownerUserId: string | null; name: string; ruleJson: string; updatedAt: string }[];
  return rows.map(mapStrategy).filter((strategy): strategy is SavedForexStrategy => strategy !== null);
}

export function saveForexStrategy(userId: string, value: unknown, id?: string, publishTemplate = false, isAdmin = false) {
  const rule = parseForexRule(value);
  if (!rule) throw new Error("Forex strategy formula is invalid.");
  if (publishTemplate && !isAdmin) throw new Error("Only an administrator can publish a shared strategy.");
  const strategyId = id ?? randomUUID();
  const updatedAt = new Date().toISOString();
  let action = "";
  let isTemplate = false;
  database.transaction(() => {
    const existing = database.prepare("SELECT owner_user_id AS ownerUserId FROM ea_forex_strategies WHERE id=?")
      .get(strategyId) as { ownerUserId: string | null } | undefined;
    if (existing && existing.ownerUserId !== userId && !(existing.ownerUserId === null && isAdmin)) {
      throw new Error("You cannot edit this Forex strategy.");
    }
    if (!existing) {
      if (publishTemplate) {
        const count = database.prepare("SELECT COUNT(*) AS count FROM ea_forex_strategies WHERE owner_user_id IS NULL")
          .get() as { count: number };
        if (count.count >= 20) throw new Error("Shared Forex strategy limit reached.");
      } else {
        const count = database.prepare("SELECT COUNT(*) AS count FROM ea_forex_strategies WHERE owner_user_id=?")
          .get(userId) as { count: number };
        if (count.count >= 10) throw new Error("Personal Forex strategy limit reached.");
      }
    }
    const ownerId = publishTemplate || (existing?.ownerUserId === null) ? null : userId;
    isTemplate = ownerId === null;
    action = `ea.forex.${isTemplate ? "template" : "strategy"}.${existing ? "updated" : "created"}`;
    database.prepare(`INSERT INTO ea_forex_strategies (id,owner_user_id,name,rule_json,updated_at)
      VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,rule_json=excluded.rule_json,updated_at=excluded.updated_at`)
      .run(strategyId, ownerId, rule.name, JSON.stringify(rule), updatedAt);
    audit(userId, action, updatedAt);
  })();
  return { id: strategyId, name: rule.name, rule, isTemplate, updatedAt };
}

export function deleteForexStrategy(userId: string, id: string, isAdmin = false) {
  return database.transaction(() => {
    const existing = database.prepare("SELECT owner_user_id AS ownerUserId FROM ea_forex_strategies WHERE id=?")
      .get(id) as { ownerUserId: string | null } | undefined;
    if (!existing) return false;
    if (existing.ownerUserId !== userId && !(existing.ownerUserId === null && isAdmin)) {
      throw new Error("You cannot delete this Forex strategy.");
    }
    const removed = database.prepare("DELETE FROM ea_forex_strategies WHERE id=?").run(id).changes > 0;
    if (removed) audit(userId, `ea.forex.${existing.ownerUserId === null ? "template" : "strategy"}.deleted`, new Date().toISOString());
    return removed;
  })();
}
