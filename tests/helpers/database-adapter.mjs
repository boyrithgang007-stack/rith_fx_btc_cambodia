import Database from "better-sqlite3";

const schema = `
CREATE TABLE users (
  id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  display_name TEXT,avatar_data_url TEXT,status TEXT NOT NULL DEFAULT 'pending',role TEXT NOT NULL DEFAULT 'member',
  access_enabled INTEGER NOT NULL DEFAULT 1,registration_ip TEXT,last_login_ip TEXT,email_verified INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE app_secrets (name TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE membership_reviews (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL,consumed_at INTEGER,decision TEXT,recipient TEXT NOT NULL,delivery TEXT NOT NULL DEFAULT 'pending');
CREATE TABLE email_verifications (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL,consumed_at INTEGER,delivery TEXT NOT NULL DEFAULT 'pending');
CREATE TABLE admin_audit_events (id TEXT PRIMARY KEY,actor_user_id TEXT NOT NULL,actor_email TEXT NOT NULL,target_user_id TEXT NOT NULL,
 target_email TEXT NOT NULL,action TEXT NOT NULL,occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE public_social_links (id TEXT PRIMARY KEY,platform TEXT NOT NULL,url TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE candle_analysis_reports (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 market TEXT NOT NULL,frame TEXT NOT NULL,generated_at INTEGER NOT NULL,report_json TEXT NOT NULL);
CREATE TABLE trading_risk_settings (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,max_order_cents INTEGER NOT NULL,
 daily_limit_cents INTEGER NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE ea_bot_settings (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,symbol TEXT NOT NULL,capital_cents INTEGER NOT NULL,
 risk_tenths INTEGER NOT NULL,leverage INTEGER NOT NULL,enabled INTEGER NOT NULL DEFAULT 0,testnet_verified INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL);
CREATE TABLE ea_bot_credentials (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,encrypted_credentials TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE ea_bot_runs (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,symbol TEXT NOT NULL,candle_time INTEGER NOT NULL,
 status TEXT NOT NULL,message TEXT NOT NULL,order_id TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(user_id,symbol,candle_time));
CREATE TABLE ea_bot_audit_events (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,action TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE ea_forex_strategies (id TEXT PRIMARY KEY,owner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,rule_json TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE private_account_connections (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,provider TEXT NOT NULL,label TEXT NOT NULL,
 encrypted_credentials TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(user_id,provider));
CREATE TABLE connection_audit (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,action TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE payment_requests (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,amount TEXT NOT NULL,currency TEXT NOT NULL,
 status TEXT NOT NULL,qr_image TEXT,mode TEXT NOT NULL,created_at TEXT NOT NULL);
`;

export function createDatabase() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(schema);
  return db;
}

export function databaseAdapter(db) {
  const normalize = sql => sql
    .replace(/::int\b/gi, "")
    .replace(/\s+FOR UPDATE(?:\s+OF\s+[a-z_,\s]+)?/gi, "");
  return {
    query: async (sql, values = []) => db.prepare(normalize(sql)).all(...values),
    execute: async (sql, values = []) => db.prepare(normalize(sql)).run(...values).changes,
    transaction: async work => work(db),
  };
}
