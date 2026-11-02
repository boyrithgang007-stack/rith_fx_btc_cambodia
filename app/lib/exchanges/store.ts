import { randomUUID } from "node:crypto";
import { database } from "../auth";
import { openCredentials, sealCredentials } from "./vault";
import { parseAccountCredentials, type AccountCredentials } from "./accounts";

database.exec(`CREATE TABLE IF NOT EXISTS private_account_connections (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK(provider IN ('binance','okx','bitget','mt5')), label TEXT NOT NULL, encrypted_credentials TEXT NOT NULL,
  created_at TEXT NOT NULL, UNIQUE(user_id, provider)
);
CREATE TABLE IF NOT EXISTS connection_audit (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, created_at TEXT NOT NULL
);`);

export function listConnections(userId: string) {
  return database.prepare("SELECT id, provider, label, created_at AS createdAt FROM private_account_connections WHERE user_id=?").all(userId);
}

export function saveConnection(userId: string, credentials: AccountCredentials) {
  const existing = database.prepare("SELECT id FROM private_account_connections WHERE user_id=? AND provider=?").get(userId, credentials.provider) as { id: string } | undefined;
  const id = existing?.id ?? randomUUID();
  const encrypted = sealCredentials(credentials, `${userId}:${id}`);
  const now = new Date().toISOString();
  database.transaction(() => {
    database.prepare("INSERT INTO private_account_connections VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id,provider) DO UPDATE SET encrypted_credentials=excluded.encrypted_credentials").run(id, userId, credentials.provider, credentials.provider === "mt5" ? "Exness MT5" : credentials.provider.toUpperCase(), encrypted, now);
    database.prepare("INSERT INTO connection_audit VALUES (?, ?, ?, ?)").run(randomUUID(), userId, `${credentials.provider}.${existing ? "credentials_replaced" : "connected"}`, now);
  })();
}

export function connectionCredentials(userId: string, id: string) {
  const record = database.prepare("SELECT encrypted_credentials AS encrypted FROM private_account_connections WHERE user_id=? AND id=?").get(userId, id) as { encrypted: string } | undefined;
  if (!record) return null;
  const credentials = parseAccountCredentials(openCredentials(record.encrypted, `${userId}:${id}`));
  if (!credentials) throw new Error("Invalid credential record.");
  return credentials;
}

export function removeConnection(userId: string, id: string) {
  return database.transaction(() => {
    const result = database.prepare("DELETE FROM private_account_connections WHERE user_id=? AND id=?").run(userId, id);
    if (result.changes) database.prepare("INSERT INTO connection_audit VALUES (?, ?, 'account.disconnected', ?)").run(randomUUID(), userId, new Date().toISOString());
    return result.changes > 0;
  })();
}
