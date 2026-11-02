import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";
import Database from "better-sqlite3";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const email = process.argv[2]?.trim().toLowerCase();
if (process.argv.length !== 3 || !email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: npm run admin:bootstrap -- <registered-email>");
  process.exitCode = 1;
} else {
  const databasePath = process.env.AUTH_DB_PATH
    ? path.resolve(process.env.AUTH_DB_PATH)
    : path.join(process.cwd(), "data", "auth.sqlite");
  mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new Database(databasePath);
  try {
    db.pragma("foreign_keys = ON");
    const bootstrap = db.transaction(() => {
      const columns = db.prepare("PRAGMA table_info(users)").all();
      if (!columns.length) throw new Error("No users database found. Start the app and create an account first.");
      const names = new Set(columns.map((column) => column.name));
      if (!names.has("status")) {
        db.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected'))");
        db.exec("UPDATE users SET status = 'approved'");
      }
      if (!names.has("role")) db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','admin'))");
      if (!names.has("access_enabled")) db.exec("ALTER TABLE users ADD COLUMN access_enabled INTEGER NOT NULL DEFAULT 1 CHECK(access_enabled IN (0,1))");
      if (!names.has("email_verified")) {
        db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1 CHECK(email_verified IN (0,1))");
        db.exec("UPDATE users SET email_verified = 0 WHERE status = 'pending'");
      }
      db.exec(`CREATE TABLE IF NOT EXISTS admin_audit_events (
        id TEXT PRIMARY KEY,
        actor_user_id TEXT NOT NULL,
        actor_email TEXT NOT NULL,
        target_user_id TEXT NOT NULL,
        target_email TEXT NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('approve','reject','disable','enable','bootstrap_admin')),
        occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      if (db.prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").get()) {
        throw new Error("An administrator already exists. Bootstrap is only for the first administrator.");
      }
      const user = db.prepare("SELECT id, email, status, email_verified AS emailVerified FROM users WHERE email = ? COLLATE NOCASE").get(email);
      if (!user) throw new Error("Register this email in the app before bootstrapping it as the first administrator.");
      if (user.status === "rejected") throw new Error("A rejected account cannot be bootstrapped. Register a different email.");
      if (user.emailVerified !== 1) throw new Error("Verify this email through the app before bootstrapping it as the first administrator.");
      db.prepare("UPDATE users SET role = 'admin', status = 'approved', access_enabled = 1 WHERE id = ?").run(user.id);
      db.prepare(`INSERT INTO admin_audit_events
        (id, actor_user_id, actor_email, target_user_id, target_email, action)
        VALUES (?, ?, ?, ?, ?, 'bootstrap_admin')`).run(randomUUID(), user.id, user.email, user.id, user.email);
      return user.email;
    });
    const adminEmail = bootstrap.immediate();
    console.log(`Bootstrapped the first administrator: ${adminEmail}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Administrator bootstrap failed.");
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
