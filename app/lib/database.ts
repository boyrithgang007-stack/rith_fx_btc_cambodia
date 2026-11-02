import { Pool, type PoolClient, type QueryResultRow } from "pg";

type Queryable = Pool | PoolClient;
type DbRow = QueryResultRow & Record<string, unknown>;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    display_name TEXT,
    avatar_data_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','admin')),
    access_enabled SMALLINT NOT NULL DEFAULT 1 CHECK(access_enabled IN (0,1)),
    registration_ip TEXT,
    last_login_ip TEXT,
    email_verified SMALLINT NOT NULL DEFAULT 1 CHECK(email_verified IN (0,1))
  )`,
  `CREATE TABLE IF NOT EXISTS app_secrets (name TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS membership_reviews (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at BIGINT NOT NULL, created_at BIGINT NOT NULL, consumed_at BIGINT,
    decision TEXT, recipient TEXT NOT NULL, delivery TEXT NOT NULL DEFAULT 'pending'
  )`,
  `CREATE INDEX IF NOT EXISTS membership_reviews_user ON membership_reviews(user_id)`,
  `CREATE TABLE IF NOT EXISTS email_verifications (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at BIGINT NOT NULL, created_at BIGINT NOT NULL, consumed_at BIGINT,
    delivery TEXT NOT NULL DEFAULT 'pending'
  )`,
  `CREATE INDEX IF NOT EXISTS email_verifications_user ON email_verifications(user_id)`,
  `CREATE TABLE IF NOT EXISTS admin_audit_events (
    id TEXT PRIMARY KEY, actor_user_id TEXT NOT NULL, actor_email TEXT NOT NULL,
    target_user_id TEXT NOT NULL, target_email TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('approve','reject','disable','enable','bootstrap_admin')),
    occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS admin_audit_events_occurred ON admin_audit_events(occurred_at DESC)`,
  `CREATE TABLE IF NOT EXISTS public_social_links (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL CHECK(platform IN ('facebook','instagram','tiktok','youtube','x','telegram','website')),
    url TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS candle_analysis_reports (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    market TEXT NOT NULL, frame TEXT NOT NULL, generated_at BIGINT NOT NULL, report_json TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS candle_analysis_reports_user_created_idx ON candle_analysis_reports(user_id, generated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS trading_risk_settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    max_order_cents INTEGER NOT NULL CHECK(max_order_cents BETWEEN 100 AND 10000000),
    daily_limit_cents INTEGER NOT NULL CHECK(daily_limit_cents BETWEEN 100 AND 100000000), updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ea_bot_settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL CHECK(symbol IN ('BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT')),
    capital_cents INTEGER NOT NULL CHECK(capital_cents BETWEEN 100 AND 100000000),
    risk_tenths INTEGER NOT NULL CHECK(risk_tenths BETWEEN 1 AND 10),
    leverage INTEGER NOT NULL CHECK(leverage BETWEEN 1 AND 5),
    enabled SMALLINT NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
    testnet_verified SMALLINT NOT NULL DEFAULT 0 CHECK(testnet_verified IN (0,1)), updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ea_bot_credentials (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    encrypted_credentials TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ea_bot_runs (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL, candle_time BIGINT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('processing','skipped','opened','closed','failed','halted')),
    message TEXT NOT NULL, order_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    UNIQUE(user_id, symbol, candle_time)
  )`,
  `CREATE INDEX IF NOT EXISTS ea_bot_runs_user_created ON ea_bot_runs(user_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS ea_bot_audit_events (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL, created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ea_forex_strategies (
    id TEXT PRIMARY KEY, owner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL, rule_json TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS ea_forex_strategies_owner ON ea_forex_strategies(owner_user_id, updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS private_account_connections (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK(provider IN ('binance','okx','bitget','mt5')), label TEXT NOT NULL,
    encrypted_credentials TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(user_id, provider)
  )`,
  `CREATE TABLE IF NOT EXISTS connection_audit (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL, created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS payment_requests (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount TEXT NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL, qr_image TEXT, mode TEXT NOT NULL, created_at TEXT NOT NULL
  )`,
] as const;

declare global {
  var __rfxDatabasePool: Pool | undefined;
  var __rfxDatabaseSchemaReady: Promise<void> | undefined;
}

function getPool() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL is required. Add a Supabase PostgreSQL connection string to the deployment environment.");
  if (!globalThis.__rfxDatabasePool) {
    const certificateAuthority = process.env.DATABASE_SSL_CA?.trim();
    globalThis.__rfxDatabasePool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: true,
        ...(certificateAuthority ? { ca: certificateAuthority } : {}),
      },
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalThis.__rfxDatabasePool;
}

function quoteCamelAliases(sql: string) {
  return sql.replace(/\bAS\s+([A-Za-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*)\b/g, 'AS "$1"');
}

function postgresSql(sql: string) {
  let index = 0;
  return quoteCamelAliases(sql).replace(/\?/g, () => `$${++index}`);
}

async function ensureSchema() {
  if (!globalThis.__rfxDatabaseSchemaReady) {
    globalThis.__rfxDatabaseSchemaReady = (async () => {
      const pool = getPool();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const statement of schemaStatements) await client.query(statement);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch(error => {
      globalThis.__rfxDatabaseSchemaReady = undefined;
      throw error;
    });
  }
  await globalThis.__rfxDatabaseSchemaReady;
}

export async function query<Row extends DbRow = DbRow>(sql: string, values: readonly unknown[] = [], client?: Queryable) {
  await ensureSchema();
  const connection = client ?? getPool();
  const result = await connection.query<Row>(postgresSql(sql), [...values]);
  return result.rows;
}

export async function execute(sql: string, values: readonly unknown[] = [], client?: Queryable) {
  await ensureSchema();
  const connection = client ?? getPool();
  const result = await connection.query(postgresSql(sql), [...values]);
  return result.rowCount ?? 0;
}

export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function checkDatabase() {
  const rows = await query<{ ok: number }>("SELECT 1 AS ok");
  return rows[0]?.ok === 1;
}

export async function closeDatabasePool() {
  const pool = globalThis.__rfxDatabasePool;
  globalThis.__rfxDatabasePool = undefined;
  globalThis.__rfxDatabaseSchemaReady = undefined;
  await pool?.end();
}
