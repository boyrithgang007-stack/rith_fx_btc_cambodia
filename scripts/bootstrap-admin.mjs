import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const email = process.argv[2]?.trim().toLowerCase();
if (process.argv.length !== 3 || !email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: npm run admin:bootstrap -- <registered-email>");
  process.exitCode = 1;
} else if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required. Add the Supabase pooler connection string to .env.local or the deployment environment.");
  process.exitCode = 1;
} else {
  const certificateAuthority = process.env.DATABASE_SSL_CA?.trim();
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: true,
      ...(certificateAuthority ? { ca: certificateAuthority } : {}),
    },
    max: 1,
  });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const admins = await client.query("SELECT 1 FROM users WHERE role='admin' LIMIT 1");
    if (admins.rowCount) throw new Error("An administrator already exists. Bootstrap is only for the first administrator.");
    const result = await client.query(
      "SELECT id,email,status,email_verified FROM users WHERE email=$1 FOR UPDATE",
      [email],
    );
    const user = result.rows[0];
    if (!user) throw new Error("Register this email in the app before bootstrapping it as the first administrator.");
    if (user.status === "rejected") throw new Error("A rejected account cannot be bootstrapped. Register a different email.");
    if (user.email_verified !== 1) throw new Error("Verify this email through the app before bootstrapping it as the first administrator.");
    await client.query("UPDATE users SET role='admin',status='approved',access_enabled=1 WHERE id=$1", [user.id]);
    await client.query(`INSERT INTO admin_audit_events
      (id,actor_user_id,actor_email,target_user_id,target_email,action)
      VALUES ($1,$2,$3,$4,$5,'bootstrap_admin')`,
    [randomUUID(), user.id, user.email, user.id, user.email]);
    await client.query("COMMIT");
    console.log(`Bootstrapped the first administrator: ${user.email}`);
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => undefined);
    console.error(error instanceof Error ? error.message : "Administrator bootstrap failed.");
    process.exitCode = 1;
  } finally {
    client?.release();
    await pool.end();
  }
}
