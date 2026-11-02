import { randomUUID } from "node:crypto";
import { execute, query, transaction } from "../database";
import { openCredentials, sealCredentials } from "./vault";
import { parseAccountCredentials, type AccountCredentials } from "./accounts";

export function listConnections(userId: string) {
  return query("SELECT id,provider,label,created_at AS createdAt FROM private_account_connections WHERE user_id=?", [userId]);
}

export async function saveConnection(userId: string, credentials: AccountCredentials) {
  const now = new Date().toISOString();
  await transaction(async client => {
    await query("SELECT id FROM users WHERE id=? FOR UPDATE", [userId], client);
    const existingRows = await query<{ id: string }>("SELECT id FROM private_account_connections WHERE user_id=? AND provider=? FOR UPDATE", [userId, credentials.provider], client);
    const existing = existingRows[0];
    const id = existing?.id ?? randomUUID();
    const encrypted = sealCredentials(credentials, `${userId}:${id}`);
    await execute(`INSERT INTO private_account_connections (id,user_id,provider,label,encrypted_credentials,created_at)
      VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,provider) DO UPDATE SET
      encrypted_credentials=excluded.encrypted_credentials,label=excluded.label`, [
      id, userId, credentials.provider, credentials.provider === "mt5" ? "Exness MT5" : credentials.provider.toUpperCase(), encrypted, now,
    ], client);
    await execute("INSERT INTO connection_audit VALUES (?,?,?,?)", [randomUUID(), userId, `${credentials.provider}.${existing ? "credentials_replaced" : "connected"}`, now], client);
  });
}

export async function connectionCredentials(userId: string, id: string) {
  const rows = await query<{ encrypted: string }>("SELECT encrypted_credentials AS encrypted FROM private_account_connections WHERE user_id=? AND id=?", [userId, id]);
  if (!rows[0]) return null;
  const credentials = parseAccountCredentials(openCredentials(rows[0].encrypted, `${userId}:${id}`));
  if (!credentials) throw new Error("Invalid credential record.");
  return credentials;
}

export async function removeConnection(userId: string, id: string) {
  return transaction(async client => {
    const removed = await execute("DELETE FROM private_account_connections WHERE user_id=? AND id=?", [userId, id], client);
    if (removed) await execute("INSERT INTO connection_audit VALUES (?,?,?,?)", [randomUUID(), userId, "account.disconnected", new Date().toISOString()], client);
    return removed > 0;
  });
}
