-- Prisma Migrate: add provider-backed partner payout account tracking

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'financial_provider'
  ) THEN
    CREATE TYPE financial_provider AS ENUM ('xendit');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'provider_account_type'
  ) THEN
    CREATE TYPE provider_account_type AS ENUM ('owned', 'managed');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'partner_provider_account_status'
  ) THEN
    CREATE TYPE partner_provider_account_status AS ENUM (
      'creating',
      'invited',
      'registered',
      'awaiting_docs',
      'pending_verification',
      'live',
      'suspended',
      'error'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS partner_provider_account (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_user_id BIGINT NOT NULL,
  provider financial_provider NOT NULL,
  provider_account_id TEXT,
  provider_account_type provider_account_type NOT NULL,
  status partner_provider_account_status NOT NULL DEFAULT 'creating',
  currency CHAR(3) NOT NULL DEFAULT 'PHP',
  metadata JSON,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ(6),
  CONSTRAINT partner_provider_account_partner_fk
    FOREIGN KEY (partner_user_id) REFERENCES "user" (user_id)
    ON DELETE CASCADE
    ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_provider_account_partner_provider
  ON partner_provider_account (partner_user_id, provider);

CREATE UNIQUE INDEX IF NOT EXISTS partner_provider_account_provider_account_id_key
  ON partner_provider_account (provider_account_id)
  WHERE provider_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_partner_provider_account_partner_status
  ON partner_provider_account (partner_user_id, status);

CREATE INDEX IF NOT EXISTS idx_partner_provider_account_provider_status
  ON partner_provider_account (provider, status);

COMMIT;
