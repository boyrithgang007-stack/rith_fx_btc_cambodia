import { randomUUID } from "node:crypto";
import { execute, query, transaction } from "../database";
import { parseForexRule, type ForexRule } from "./forex-rules";

export type SavedForexStrategy = { id: string; name: string; rule: ForexRule; isTemplate: boolean; updatedAt: string };

function mapStrategy(row: { id: string; ownerUserId: string | null; name: string; ruleJson: string; updatedAt: string }): SavedForexStrategy | null {
  let serialized: unknown;
  try { serialized = JSON.parse(row.ruleJson); }
  catch { console.error(`[forex-ea-store] Invalid saved strategy JSON for ${row.id}.`); return null; }
  const rule = parseForexRule(serialized);
  if (!rule) { console.error(`[forex-ea-store] Invalid saved strategy rule for ${row.id}.`); return null; }
  return { id: row.id, name: rule.name || row.name, rule, isTemplate: row.ownerUserId === null, updatedAt: row.updatedAt };
}

export async function listForexStrategies(userId: string) {
  const rows = await query<{ id: string; ownerUserId: string | null; name: string; ruleJson: string; updatedAt: string }>(`SELECT id,owner_user_id AS ownerUserId,name,rule_json AS ruleJson,updated_at AS updatedAt
    FROM ea_forex_strategies WHERE owner_user_id IS NULL OR owner_user_id=?
    ORDER BY (owner_user_id IS NOT NULL) DESC,updated_at DESC`, [userId]);
  return rows.map(mapStrategy).filter((strategy): strategy is SavedForexStrategy => strategy !== null);
}

export async function saveForexStrategy(userId: string, value: unknown, id?: string, publishTemplate = false, isAdmin = false) {
  const rule = parseForexRule(value);
  if (!rule) throw new Error("Forex strategy formula is invalid.");
  if (publishTemplate && !isAdmin) throw new Error("Only an administrator can publish a shared strategy.");
  const strategyId = id ?? randomUUID();
  const updatedAt = new Date().toISOString();
  let action = "";
  let isTemplate = false;
  await transaction(async client => {
    const existingRows = await query<{ ownerUserId: string | null }>("SELECT owner_user_id AS ownerUserId FROM ea_forex_strategies WHERE id=? FOR UPDATE", [strategyId], client);
    const existing = existingRows[0];
    if (existing && existing.ownerUserId !== userId && !(existing.ownerUserId === null && isAdmin)) throw new Error("You cannot edit this Forex strategy.");
    if (!existing) {
      const countRows = await query<{ count: number }>("SELECT COUNT(*)::int AS count FROM ea_forex_strategies WHERE owner_user_id IS NOT DISTINCT FROM ?", [publishTemplate ? null : userId], client);
      if (countRows[0].count >= (publishTemplate ? 20 : 10)) throw new Error(publishTemplate ? "Shared Forex strategy limit reached." : "Personal Forex strategy limit reached.");
    }
    const ownerId = publishTemplate || existing?.ownerUserId === null ? null : userId;
    isTemplate = ownerId === null;
    action = `ea.forex.${isTemplate ? "template" : "strategy"}.${existing ? "updated" : "created"}`;
    await execute(`INSERT INTO ea_forex_strategies (id,owner_user_id,name,rule_json,updated_at) VALUES (?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,rule_json=excluded.rule_json,updated_at=excluded.updated_at`,
      [strategyId, ownerId, rule.name, JSON.stringify(rule), updatedAt], client);
    await execute("INSERT INTO ea_bot_audit_events (id,user_id,action,created_at) VALUES (?,?,?,?)", [randomUUID(), userId, action, updatedAt], client);
  });
  return { id: strategyId, name: rule.name, rule, isTemplate, updatedAt };
}

export async function deleteForexStrategy(userId: string, id: string, isAdmin = false) {
  return transaction(async client => {
    const rows = await query<{ ownerUserId: string | null }>("SELECT owner_user_id AS ownerUserId FROM ea_forex_strategies WHERE id=? FOR UPDATE", [id], client);
    const existing = rows[0];
    if (!existing) return false;
    if (existing.ownerUserId !== userId && !(existing.ownerUserId === null && isAdmin)) throw new Error("You cannot delete this Forex strategy.");
    const removed = await execute("DELETE FROM ea_forex_strategies WHERE id=?", [id], client);
    if (removed) await execute("INSERT INTO ea_bot_audit_events (id,user_id,action,created_at) VALUES (?,?,?,?)",
      [randomUUID(), userId, `ea.forex.${existing.ownerUserId === null ? "template" : "strategy"}.deleted`, new Date().toISOString()], client);
    return removed > 0;
  });
}
