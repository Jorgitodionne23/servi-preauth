// db.pg.mjs — Postgres client (Neon/Supabase)
import pg from 'pg';
const { Pool } = pg;

const allowInsecure = String(process.env.ALLOW_INSECURE_DB_TLS || '').toLowerCase() === 'true';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...(process.env.DATABASE_URL?.startsWith('postgres://') || process.env.DATABASE_URL?.startsWith('postgresql://')
      ? { ssl: allowInsecure ? { rejectUnauthorized: false } : undefined }
      : {})
});

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set to connect to Postgres');
}

if (!allowInsecure) {
  console.log('[db] TLS certificate verification enabled for Postgres connection');
} else {
  console.warn('[db] ALLOW_INSECURE_DB_TLS=true → accepting database TLS certificates without verification');
}

export async function initDb() {
  await pool.query(`
    -- Main bookings table
    CREATE TABLE IF NOT EXISTS all_bookings (
      id TEXT PRIMARY KEY,
      payment_intent_id TEXT UNIQUE,
      amount INTEGER,
      provider_amount INTEGER,
      booking_fee_amount INTEGER,
      processing_fee_amount INTEGER,
      vat_amount INTEGER,
      pricing_total_amount INTEGER,
      client_name TEXT,
      client_phone TEXT,
      client_email TEXT,
      service_description TEXT,
      service_date TEXT,              -- date-only (YYYY-MM-DD) for >7d rule
      service_address TEXT,
      booking_type TEXT,
      status TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      public_code TEXT UNIQUE,
      kind TEXT DEFAULT 'primary',
      parent_id_of_adjustment TEXT,
      customer_id TEXT,
      saved_payment_method_id TEXT,
      vat_rate REAL,
      stripe_percent_fee REAL,
      stripe_fixed_fee INTEGER,
      stripe_fee_tax_rate REAL,
      processing_fee_type TEXT,
      urgency_multiplier REAL,
      alpha_value REAL
    );

    ALTER TABLE all_bookings ADD COLUMN IF NOT EXISTS client_phone TEXT;
    ALTER TABLE all_bookings ADD COLUMN IF NOT EXISTS client_email TEXT;

    -- NEW: store full timestamp (ISO with tz) for display/use in UI
    ALTER TABLE all_bookings
      ADD COLUMN IF NOT EXISTS service_datetime TEXT;

    ALTER TABLE all_bookings
      ADD COLUMN IF NOT EXISTS service_address TEXT;
    ALTER TABLE all_bookings
      ADD COLUMN IF NOT EXISTS booking_type TEXT;

    ALTER TABLE all_bookings ADD COLUMN IF NOT EXISTS provider_amount INTEGER;
    ALTER TABLE all_bookings ADD COLUMN IF NOT EXISTS booking_fee_amount INTEGER;
    ALTER TABLE all_bookings ADD COLUMN IF NOT EXISTS processing_fee_amount INTEGER;
    ALTER TABLE all_bookings ADD COLUMN IF NOT EXISTS vat_amount INTEGER;
    ALTER TABLE all_bookings ADD COLUMN IF NOT EXISTS pricing_total_amount INTEGER;
    ALTER TABLE all_bookings ADD COLUMN IF NOT EXISTS vat_rate REAL;
    ALTER TABLE all_bookings ADD COLUMN IF NOT EXISTS stripe_percent_fee REAL;
    ALTER TABLE all_bookings ADD COLUMN IF NOT EXISTS stripe_fixed_fee INTEGER;
    ALTER TABLE all_bookings ADD COLUMN IF NOT EXISTS stripe_fee_tax_rate REAL;
    ALTER TABLE all_bookings ADD COLUMN IF NOT EXISTS processing_fee_type TEXT;
    ALTER TABLE all_bookings ADD COLUMN IF NOT EXISTS urgency_multiplier REAL;
    ALTER TABLE all_bookings ADD COLUMN IF NOT EXISTS alpha_value REAL;
    ALTER TABLE all_bookings ADD COLUMN IF NOT EXISTS capture_method TEXT;
    ALTER TABLE all_bookings ADD COLUMN IF NOT EXISTS adjustment_reason TEXT;
    ALTER TABLE all_bookings ADD COLUMN IF NOT EXISTS retry_token TEXT;
    ALTER TABLE all_bookings ADD COLUMN IF NOT EXISTS retry_token_created_at TIMESTAMPTZ;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'all_bookings'
          AND column_name = 'processing_fee_rule'
      ) THEN
        ALTER TABLE all_bookings
          RENAME COLUMN processing_fee_rule TO processing_fee_type;
      END IF;
    EXCEPTION WHEN duplicate_column THEN
      NULL;
    END $$;

    ALTER INDEX IF EXISTS idx_orders_created_at RENAME TO idx_all_bookings_created_at;
    ALTER INDEX IF EXISTS idx_orders_parent RENAME TO idx_all_bookings_parent;
    ALTER INDEX IF EXISTS idx_orders_service_date RENAME TO idx_all_bookings_service_date;

    CREATE INDEX IF NOT EXISTS idx_all_bookings_created_at ON all_bookings(created_at);
    CREATE INDEX IF NOT EXISTS idx_all_bookings_parent ON all_bookings(parent_id_of_adjustment);
    -- (optional but handy for queries by date)
    CREATE INDEX IF NOT EXISTS idx_all_bookings_service_date ON all_bookings(service_date);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_all_bookings_retry_token
      ON all_bookings(retry_token)
      WHERE retry_token IS NOT NULL;

    -- Consent audit (per-booking)
    CREATE TABLE IF NOT EXISTS consented_offsession_bookings (
      order_id TEXT PRIMARY KEY,
      customer_id TEXT,
      customer_name TEXT,
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

    ALTER TABLE consented_offsession_bookings
      ADD COLUMN IF NOT EXISTS customer_name TEXT;

    -- 1-row-per-customer consent registry
    CREATE TABLE IF NOT EXISTS saved_servi_users (
      customer_id              TEXT PRIMARY KEY,
      customer_name            TEXT,
      customer_email           TEXT,
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

      ALTER TABLE saved_servi_users
        ADD COLUMN IF NOT EXISTS customer_phone TEXT;
      ALTER TABLE saved_servi_users
        ADD COLUMN IF NOT EXISTS customer_email TEXT;


    ALTER INDEX IF EXISTS idx_customer_consents_last_checked_at RENAME TO idx_saved_servi_users_last_checked_at;
    ALTER INDEX IF EXISTS idx_customer_consents_latest_pm RENAME TO idx_saved_servi_users_latest_pm;

    CREATE INDEX IF NOT EXISTS idx_saved_servi_users_last_checked_at
      ON saved_servi_users (last_checked_at DESC);

    CREATE INDEX IF NOT EXISTS idx_saved_servi_users_latest_pm
      ON saved_servi_users (latest_payment_method_id);
  `);
}
