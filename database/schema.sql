-- PostgreSQL target schema for the future exchange-account service.
-- This is a design artifact only; the running app still uses SQLite for auth.
-- Encrypt credential material with envelope encryption before it reaches this DB.

CREATE TABLE app_users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE exchange_connections (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('binance', 'bitget', 'okx', 'mt5')),
  label TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('spot', 'margin', 'futures', 'mt5')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'reauth_required', 'disabled', 'error')),
  permissions JSONB NOT NULL DEFAULT '{"read_only": true, "trade": false, "withdraw": false}'::jsonb,
  credential_ciphertext BYTEA NOT NULL,
  credential_nonce BYTEA NOT NULL,
  credential_auth_tag BYTEA NOT NULL,
  encryption_key_id TEXT NOT NULL,
  encryption_version SMALLINT NOT NULL DEFAULT 1,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, label)
);

CREATE INDEX exchange_connections_user_status_idx ON exchange_connections(user_id, status);

CREATE TABLE account_snapshots (
  id UUID PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES exchange_connections(id) ON DELETE CASCADE,
  external_account_id TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('spot', 'margin', 'futures', 'mt5')),
  currency TEXT NOT NULL,
  equity NUMERIC(38, 18) NOT NULL,
  available NUMERIC(38, 18) NOT NULL,
  margin_used NUMERIC(38, 18),
  unrealized_pnl NUMERIC(38, 18),
  observed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX account_snapshots_connection_observed_idx ON account_snapshots(connection_id, observed_at DESC);

CREATE TABLE balance_snapshots (
  id UUID PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES exchange_connections(id) ON DELETE CASCADE,
  asset TEXT NOT NULL,
  total NUMERIC(38, 18) NOT NULL,
  available NUMERIC(38, 18) NOT NULL,
  locked NUMERIC(38, 18) NOT NULL DEFAULT 0,
  usd_value NUMERIC(38, 18),
  observed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX balance_snapshots_connection_asset_observed_idx
  ON balance_snapshots(connection_id, asset, observed_at DESC);

CREATE TABLE position_snapshots (
  id UUID PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES exchange_connections(id) ON DELETE CASCADE,
  external_position_id TEXT NOT NULL,
  instrument TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('long', 'short')),
  quantity NUMERIC(38, 18) NOT NULL,
  entry_price NUMERIC(38, 18) NOT NULL,
  mark_price NUMERIC(38, 18),
  liquidation_price NUMERIC(38, 18),
  unrealized_pnl NUMERIC(38, 18),
  leverage NUMERIC(18, 8),
  currency TEXT NOT NULL,
  opened_at TIMESTAMPTZ,
  observed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX position_snapshots_connection_observed_idx ON position_snapshots(connection_id, observed_at DESC);
CREATE INDEX position_snapshots_instrument_observed_idx ON position_snapshots(instrument, observed_at DESC);

CREATE TABLE historical_trades (
  id UUID PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES exchange_connections(id) ON DELETE CASCADE,
  external_trade_id TEXT NOT NULL,
  instrument TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('long', 'short')),
  quantity NUMERIC(38, 18) NOT NULL,
  price NUMERIC(38, 18) NOT NULL,
  fee NUMERIC(38, 18),
  fee_currency TEXT,
  realized_pnl NUMERIC(38, 18),
  currency TEXT NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id, external_trade_id)
);

CREATE INDEX historical_trades_connection_executed_idx ON historical_trades(connection_id, executed_at DESC);

CREATE TABLE exchange_audit_events (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES exchange_connections(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'denied', 'failure')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX exchange_audit_events_user_occurred_idx ON exchange_audit_events(user_id, occurred_at DESC);
