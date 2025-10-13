// db.pg.mjs — Postgres client (Neon/Supabase)
import pg from 'pg';
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // ok for Neon/Supabase
});

export async function initDb() {
  await pool.query(`
    -- Main orders table
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      payment_intent_id TEXT UNIQUE,
      amount INTEGER,
      client_name TEXT,
      client_phone TEXT,
      client_email TEXT,
      service_description TEXT,
      service_date TEXT,              -- date-only (YYYY-MM-DD) for >7d rule
      status TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      public_code TEXT UNIQUE,
      kind TEXT DEFAULT 'primary',
      parent_id TEXT,
      customer_id TEXT,
      saved_payment_method_id TEXT
    );

    ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_phone TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_email TEXT;

    -- NEW: store full timestamp (ISO with tz) for display/use in UI
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS service_datetime TEXT;

    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_parent ON orders(parent_id);
    -- (optional but handy for queries by date)
    CREATE INDEX IF NOT EXISTS idx_orders_service_date ON orders(service_date);

    -- Consent audit (per-order)
    CREATE TABLE IF NOT EXISTS order_consents (
      order_id TEXT PRIMARY KEY,
      customer_id TEXT,
      payment_method_id TEXT,
      version TEXT,
      consent_text TEXT,
      text_hash TEXT,
      checked_at TIMESTAMPTZ DEFAULT NOW(),
      ip TEXT,
      user_agent TEXT,
      locale TEXT,
      tz TEXT
    );

    -- 1-row-per-customer consent registry
    CREATE TABLE IF NOT EXISTS customer_consents (
      customer_id              TEXT PRIMARY KEY,
      customer_name            TEXT,
      customer_phone           TEXT,
      latest_payment_method_id TEXT,
      latest_text_hash         TEXT,
      latest_version           TEXT,
      first_checked_at         TIMESTAMPTZ,
      last_checked_at          TIMESTAMPTZ,
      first_order_id           TEXT,   -- "parent" order: first consent
      last_order_id            TEXT,   -- most recent order that touched consent
      ip                       TEXT,
      user_agent               TEXT,
      locale                   TEXT,
      tz                       TEXT
    );

      ALTER TABLE customer_consents
        ADD COLUMN IF NOT EXISTS customer_phone TEXT;


    CREATE INDEX IF NOT EXISTS idx_customer_consents_last_checked_at
      ON customer_consents (last_checked_at DESC);

    CREATE INDEX IF NOT EXISTS idx_customer_consents_latest_pm
      ON customer_consents (latest_payment_method_id);
  `);
}
