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
    ALTER TABLE all_bookings ADD COLUMN IF NOT EXISTS final_captured_amount INTEGER;
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

    COMMENT ON TABLE consented_offsession_bookings IS 'Per-order consent audit from pay/book checkbox (one row per order)';
    COMMENT ON COLUMN consented_offsession_bookings.order_id IS 'Order id that captured the consent checkbox';
    COMMENT ON COLUMN consented_offsession_bookings.customer_id IS 'Stripe customer id at time of consent (may be null)';
    COMMENT ON COLUMN consented_offsession_bookings.customer_name IS 'Name on the order when consent was given';
    COMMENT ON COLUMN consented_offsession_bookings.payment_method_id IS 'Saved payment method tied to the order when known';
    COMMENT ON COLUMN consented_offsession_bookings.version IS 'Consent copy version string shown to the user';
    COMMENT ON COLUMN consented_offsession_bookings.consent_text IS 'Full consent text presented to the user';
    COMMENT ON COLUMN consented_offsession_bookings.text_hash IS 'SHA-256 hash of consent_text (server computed to verify)';
    COMMENT ON COLUMN consented_offsession_bookings.checked_at IS 'Server timestamp when the checkbox submit was received';
    COMMENT ON COLUMN consented_offsession_bookings.ip IS 'IP address from the consent request';
    COMMENT ON COLUMN consented_offsession_bookings.user_agent IS 'Browser user agent from the consent request';
    COMMENT ON COLUMN consented_offsession_bookings.locale IS 'Browser locale sent in the consent payload';
    COMMENT ON COLUMN consented_offsession_bookings.tz IS 'Client time zone (IANA string) sent in the consent payload';

    -- 1-row-per-customer consent registry
    CREATE TABLE IF NOT EXISTS saved_servi_users (
      customer_id              TEXT PRIMARY KEY,
      customer_name            TEXT,
      customer_email           TEXT,
      customer_phone           TEXT,
      latest_payment_method_id TEXT,
      latest_text_hash         TEXT,
      latest_version           TEXT,
      first_text_hash          TEXT,
      first_version            TEXT,
      first_checked_at         TIMESTAMPTZ,
      last_checked_at          TIMESTAMPTZ,
      first_order_id           TEXT,   -- "parent" order: first consent
      last_order_id            TEXT,   -- most recent order that touched consent
      first_ip                 TEXT,
      first_user_agent         TEXT,
      first_locale             TEXT,
      first_tz                 TEXT,
      ip                       TEXT,
      user_agent               TEXT,
      locale                   TEXT,
      tz                       TEXT
    );

      ALTER TABLE saved_servi_users
        ADD COLUMN IF NOT EXISTS customer_phone TEXT;
      ALTER TABLE saved_servi_users
        ADD COLUMN IF NOT EXISTS customer_email TEXT;
      ALTER TABLE saved_servi_users
        ADD COLUMN IF NOT EXISTS first_text_hash TEXT;
      ALTER TABLE saved_servi_users
        ADD COLUMN IF NOT EXISTS first_version TEXT;
      ALTER TABLE saved_servi_users
        ADD COLUMN IF NOT EXISTS first_ip TEXT;
      ALTER TABLE saved_servi_users
        ADD COLUMN IF NOT EXISTS first_user_agent TEXT;
      ALTER TABLE saved_servi_users
        ADD COLUMN IF NOT EXISTS first_locale TEXT;
      ALTER TABLE saved_servi_users
        ADD COLUMN IF NOT EXISTS first_tz TEXT;

    COMMENT ON TABLE saved_servi_users IS 'Per-customer registry of saved payment method and consent first/last metadata';
    COMMENT ON COLUMN saved_servi_users.customer_id IS 'Stripe customer id (primary key)';
    COMMENT ON COLUMN saved_servi_users.customer_name IS 'Latest known customer name';
    COMMENT ON COLUMN saved_servi_users.customer_email IS 'Latest known customer email';
    COMMENT ON COLUMN saved_servi_users.customer_phone IS 'Latest known customer phone';
    COMMENT ON COLUMN saved_servi_users.latest_payment_method_id IS 'Most recent saved payment method id';
    COMMENT ON COLUMN saved_servi_users.latest_text_hash IS 'Hash of the most recent consent text seen for this customer';
    COMMENT ON COLUMN saved_servi_users.latest_version IS 'Version of the most recent consent text seen for this customer';
    COMMENT ON COLUMN saved_servi_users.first_text_hash IS 'Hash of the first consent text seen for this customer';
    COMMENT ON COLUMN saved_servi_users.first_version IS 'Version of the first consent text seen for this customer';
    COMMENT ON COLUMN saved_servi_users.first_checked_at IS 'Timestamp when this customer first recorded consent';
    COMMENT ON COLUMN saved_servi_users.last_checked_at IS 'Timestamp of the most recent consent update';
    COMMENT ON COLUMN saved_servi_users.first_order_id IS 'Order id that first recorded consent for this customer';
    COMMENT ON COLUMN saved_servi_users.last_order_id IS 'Most recent order id that touched consent for this customer';
    COMMENT ON COLUMN saved_servi_users.first_ip IS 'IP address from the first consent capture';
    COMMENT ON COLUMN saved_servi_users.first_user_agent IS 'Browser user agent from the first consent capture';
    COMMENT ON COLUMN saved_servi_users.first_locale IS 'Browser locale from the first consent capture';
    COMMENT ON COLUMN saved_servi_users.first_tz IS 'Client time zone from the first consent capture';
    COMMENT ON COLUMN saved_servi_users.ip IS 'IP address from the latest consent capture';
    COMMENT ON COLUMN saved_servi_users.user_agent IS 'Browser user agent from the latest consent capture';
    COMMENT ON COLUMN saved_servi_users.locale IS 'Browser locale from the latest consent capture';
    COMMENT ON COLUMN saved_servi_users.tz IS 'Client time zone from the latest consent capture';


    ALTER INDEX IF EXISTS idx_customer_consents_last_checked_at RENAME TO idx_saved_servi_users_last_checked_at;
    ALTER INDEX IF EXISTS idx_customer_consents_latest_pm RENAME TO idx_saved_servi_users_latest_pm;

    CREATE INDEX IF NOT EXISTS idx_saved_servi_users_last_checked_at
      ON saved_servi_users (last_checked_at DESC);

    -- Providers (verified providers registry)
    CREATE TABLE IF NOT EXISTS providers (
      provider_id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'verified',
      name TEXT,
      phone TEXT,
      email TEXT,
      specialty TEXT,
      city TEXT,
      connect_account_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE providers ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'verified';
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS name TEXT;
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS email TEXT;
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS specialty TEXT;
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS city TEXT;
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS connect_account_id TEXT;
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

    CREATE INDEX IF NOT EXISTS idx_providers_connect_account
      ON providers(connect_account_id);

    CREATE INDEX IF NOT EXISTS idx_saved_servi_users_latest_pm
      ON saved_servi_users (latest_payment_method_id);
  `);
}

/*
Backfill helper (run manually once columns are deployed):

WITH first_consent AS (
  SELECT DISTINCT ON (c.customer_id)
    c.customer_id,
    c.order_id,
    c.text_hash,
    c.version,
    c.checked_at,
    c.ip,
    c.user_agent,
    c.locale,
    c.tz
  FROM consented_offsession_bookings c
  WHERE c.customer_id IS NOT NULL
  ORDER BY c.customer_id, c.checked_at ASC
)
UPDATE saved_servi_users s
SET first_text_hash  = fc.text_hash,
    first_version    = fc.version,
    first_checked_at = COALESCE(s.first_checked_at, fc.checked_at),
    first_order_id   = COALESCE(s.first_order_id, fc.order_id),
    first_ip         = fc.ip,
    first_user_agent = fc.user_agent,
    first_locale     = fc.locale,
    first_tz         = fc.tz
FROM first_consent fc
WHERE s.customer_id = fc.customer_id
  AND s.first_text_hash IS NULL;
*/
