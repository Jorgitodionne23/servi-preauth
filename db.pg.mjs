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

    -- NEW: store full timestamp (ISO with tz) for display/use in UI
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS service_datetime TEXT;

    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_parent ON orders(parent_id);
    -- (optional but handy for queries by date)
    CREATE INDEX IF NOT EXISTS idx_orders_service_date ON orders(service_date);

    -- Consent audit
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
  `);
}


