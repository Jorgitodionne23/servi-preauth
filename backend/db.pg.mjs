// db.pg.mjs — Postgres client (Neon/Supabase)
import pg from 'pg';
const { Pool } = pg;

const allowInsecure = String(process.env.ALLOW_INSECURE_DB_TLS || '').toLowerCase() === 'true';

if (allowInsecure && process.env.NODE_ENV === 'production') {
  throw new Error('ALLOW_INSECURE_DB_TLS=true is not permitted in production (NODE_ENV=production). Remove this flag before deploying.');
}

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
      provider_id TEXT,
      provider_name TEXT,
      cash_exception_allowed BOOLEAN DEFAULT FALSE,
      cash_selected BOOLEAN DEFAULT FALSE,
      service_description TEXT,
      service_date TEXT,              -- date-only (YYYY-MM-DD) for >7d rule
      is_asap BOOLEAN DEFAULT FALSE,
      category TEXT,
      service_datetime TEXT,
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
    ALTER TABLE all_bookings ADD COLUMN IF NOT EXISTS provider_id TEXT;
    ALTER TABLE all_bookings ADD COLUMN IF NOT EXISTS provider_name TEXT;
    ALTER TABLE all_bookings ADD COLUMN IF NOT EXISTS cash_exception_allowed BOOLEAN DEFAULT FALSE;
    ALTER TABLE all_bookings ADD COLUMN IF NOT EXISTS cash_selected BOOLEAN DEFAULT FALSE;

    -- NEW: store full timestamp (ISO with tz) for display/use in UI
    ALTER TABLE all_bookings
      ADD COLUMN IF NOT EXISTS service_datetime TEXT;

    ALTER TABLE all_bookings
      ADD COLUMN IF NOT EXISTS service_address TEXT;
    ALTER TABLE all_bookings
      ADD COLUMN IF NOT EXISTS booking_type TEXT;
    ALTER TABLE all_bookings
      ADD COLUMN IF NOT EXISTS is_asap BOOLEAN DEFAULT FALSE;

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

    -- Customer-initiated cancellation audit (late-cancel fee captured from the hold)
    ALTER TABLE all_bookings ADD COLUMN IF NOT EXISTS cancellation_fee_amount INTEGER;
    ALTER TABLE all_bookings ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;
    ALTER TABLE all_bookings ADD COLUMN IF NOT EXISTS canceled_by TEXT;

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
    CREATE INDEX IF NOT EXISTS idx_all_bookings_provider ON all_bookings(provider_id);
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

    -- Sequence for minting prov-XXXXXX provider ids
    CREATE SEQUENCE IF NOT EXISTS provider_id_seq START 1;

    -- Order-level change requests (reschedule / cancel / address update / inline edit)
    CREATE TABLE IF NOT EXISTS order_changes (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES all_bookings(id) ON DELETE CASCADE,
      change_type TEXT NOT NULL,
      requested_by TEXT,
      original_service_datetime TEXT,
      original_service_address TEXT,
      original_status TEXT,
      requested_service_datetime TEXT,
      requested_service_address TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      applied_note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      processed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_order_changes_order ON order_changes(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_changes_status ON order_changes(status);

    -- Lightweight Ops Radar alert metadata. Alerts are computed from current order
    -- state; this table only stores operator handling state such as snoozes.
    CREATE TABLE IF NOT EXISTS ops_alerts (
      order_id TEXT NOT NULL REFERENCES all_bookings(id) ON DELETE CASCADE,
      alert_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      snoozed_until TIMESTAMPTZ,
      last_seen_at TIMESTAMPTZ DEFAULT NOW(),
      resolved_at TIMESTAMPTZ,
      admin_note TEXT,
      PRIMARY KEY (order_id, alert_code)
    );
    CREATE INDEX IF NOT EXISTS idx_ops_alerts_snoozed_until
      ON ops_alerts(snoozed_until)
      WHERE snoozed_until IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_ops_alerts_status
      ON ops_alerts(status);

    CREATE INDEX IF NOT EXISTS idx_saved_servi_users_latest_pm
      ON saved_servi_users (latest_payment_method_id);

    -- ─── Phase 1: Service request intake ───────────────────────

    -- Service requests (from customer booking flow)
    CREATE TABLE IF NOT EXISTS service_requests (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      description TEXT,
      preferred_date TEXT,
      preferred_time TEXT,
      is_asap BOOLEAN DEFAULT FALSE,
      service_address TEXT,
      client_name TEXT NOT NULL,
      client_phone TEXT NOT NULL,
      client_email TEXT,
      client_request_id TEXT,
      customer_id TEXT,
      status TEXT DEFAULT 'pending',
      converted_order_id TEXT,
      admin_notes TEXT,
      lang TEXT DEFAULT 'es',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_service_requests_status
      ON service_requests(status);
    CREATE INDEX IF NOT EXISTS idx_service_requests_created_at
      ON service_requests(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_service_requests_customer
      ON service_requests(customer_id)
      WHERE customer_id IS NOT NULL;

    ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS attachments TEXT;
    ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS client_request_id TEXT;
    ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS service_address_details TEXT; -- JSON of structured address
    CREATE UNIQUE INDEX IF NOT EXISTS idx_service_requests_client_request_id
      ON service_requests(client_request_id)
      WHERE client_request_id IS NOT NULL;

    -- Incident reports & suggestions (from Help Center forms)
    CREATE TABLE IF NOT EXISTS service_reports (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,              -- 'incident' or 'suggestion'
      category TEXT,                   -- incident type or suggestion category
      name TEXT,
      email TEXT,
      phone TEXT,
      description TEXT NOT NULL,
      incident_date TEXT,              -- for incidents only
      status TEXT DEFAULT 'new',       -- new, reviewed, resolved, archived
      admin_notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_service_reports_type
      ON service_reports(type);
    CREATE INDEX IF NOT EXISTS idx_service_reports_status
      ON service_reports(status);
    CREATE INDEX IF NOT EXISTS idx_service_reports_created_at
      ON service_reports(created_at DESC);

    -- Partner applications (from Partners registration form)
    CREATE TABLE IF NOT EXISTS partner_applications (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      specialty TEXT,
      city TEXT,
      experience TEXT,
      status TEXT DEFAULT 'pending',   -- pending, contacted, verified, rejected
      admin_notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_partner_applications_status
      ON partner_applications(status);
    CREATE INDEX IF NOT EXISTS idx_partner_applications_created_at
      ON partner_applications(created_at DESC);

    ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS services TEXT;
    ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS coverage_areas TEXT;
    ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS linked_provider_id TEXT;

    -- Auth Users (Client login identities)
    CREATE TABLE IF NOT EXISTS auth_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      name TEXT,
      password_hash TEXT,
      google_id TEXT,
      apple_id TEXT,
      stripe_customer_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_login TIMESTAMPTZ
    );

    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS name TEXT;
    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS password_hash TEXT;
    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS google_id TEXT;
    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS apple_id TEXT;
    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS firebase_uid TEXT;
    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS auth_provider TEXT;

    DO $$ BEGIN
      ALTER TABLE auth_users ADD CONSTRAINT auth_users_phone_unique UNIQUE (phone);
    EXCEPTION WHEN duplicate_table THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE auth_users ADD CONSTRAINT auth_users_firebase_uid_unique UNIQUE (firebase_uid);
    EXCEPTION WHEN duplicate_table THEN NULL;
    END $$;

    ALTER TABLE auth_users ALTER COLUMN email DROP NOT NULL;

    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;
    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS first_identifier_type VARCHAR(10);
    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS email_skipped_at TIMESTAMPTZ;
    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS email_verify_token TEXT;
    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS email_verify_token_expires_at TIMESTAMPTZ;

    -- Backfill: existing phone-OTP users are phone-verified
    UPDATE auth_users SET phone_verified = true, first_identifier_type = 'phone'
    WHERE phone IS NOT NULL AND firebase_uid IS NOT NULL AND phone_verified = false;

    -- Backfill: Google / email-link users are email-verified
    UPDATE auth_users SET email_verified = true, first_identifier_type = 'email'
    WHERE email IS NOT NULL AND auth_provider IN ('google.com', 'email', 'password')
      AND email_verified = false AND phone_verified = false;

    CREATE TABLE IF NOT EXISTS user_addresses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      label TEXT,
      street TEXT NOT NULL,
      city TEXT,
      state TEXT,
      postal_code TEXT,
      country TEXT DEFAULT 'MX',
      is_default BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Detailed / CDMX-aware structured address fields (additive, nullable)
    ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS address_type TEXT;        -- house | apartment | office | other
    ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS exterior_number TEXT;
    ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS interior_number TEXT;     -- depto / unidad / interior
    ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS neighborhood TEXT;        -- colonia
    ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS municipality TEXT;        -- alcaldía / municipio
    ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS between_streets TEXT;     -- entre calles
    ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS reference_notes TEXT;     -- referencias para llegar
    ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS access_instructions TEXT; -- código de portón, caseta, estacionamiento
    ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS contact_name TEXT;        -- quién recibe
    ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS contact_phone TEXT;

    CREATE TABLE IF NOT EXISTS user_favorite_services (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      category_key TEXT NOT NULL,
      subcategory_key TEXT NOT NULL,
      service_name TEXT NOT NULL,
      category_name TEXT,
      subcategory_name TEXT,
      image_url TEXT,
      href TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, category_key, subcategory_key, service_name)
    );

    CREATE INDEX IF NOT EXISTS idx_user_favorite_services_user_created
      ON user_favorite_services (user_id, created_at DESC);

    -- Stripe webhook event ledger: dedupes retried deliveries by event.id.
    -- A row inserted here means "we have started processing this event"; processed_at
    -- is set when the handler finishes successfully. On hard error mid-handler the row
    -- is deleted so Stripe's retry can replay safely.
    CREATE TABLE IF NOT EXISTS stripe_webhook_events (
      event_id          TEXT PRIMARY KEY,
      event_type        TEXT NOT NULL,
      payment_intent_id TEXT,
      received_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at      TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_received_at
      ON stripe_webhook_events (received_at DESC);
    CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_pi
      ON stripe_webhook_events (payment_intent_id)
      WHERE payment_intent_id IS NOT NULL;

    -- Revoked SERVI session JWTs (logout, account delete, sensitive change).
    -- Rows can be pruned after expires_at < NOW().
    CREATE TABLE IF NOT EXISTS revoked_sessions (
      jti         TEXT PRIMARY KEY,
      user_id     TEXT,
      revoked_at  TIMESTAMPTZ DEFAULT NOW(),
      expires_at  TIMESTAMPTZ NOT NULL,
      reason      TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_revoked_sessions_expires
      ON revoked_sessions(expires_at);

    -- Per-identifier OTP / auth attempts for rate-limiting (phone or email).
    -- Counted in a sliding window; old rows can be pruned periodically.
    CREATE TABLE IF NOT EXISTS auth_otp_attempts (
      id          BIGSERIAL PRIMARY KEY,
      identifier  TEXT NOT NULL,
      kind        TEXT NOT NULL,         -- 'phone' | 'email' | 'firebase_sync'
      ip          TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_auth_otp_attempts_id_time
      ON auth_otp_attempts(identifier, created_at DESC);

    -- Audit log for sensitive auth actions (login, phone change, email change).
    -- Account deletion is intentionally NOT logged here per product decision.
    CREATE TABLE IF NOT EXISTS auth_events (
      id          BIGSERIAL PRIMARY KEY,
      user_id     TEXT,
      event_type  TEXT NOT NULL,
      ip          TEXT,
      user_agent  TEXT,
      metadata    JSONB,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_auth_events_user
      ON auth_events(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_auth_events_type
      ON auth_events(event_type, created_at DESC);

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
