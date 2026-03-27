-- Add Xendit as a normalized payment provider.
ALTER TYPE "public"."gateway" ADD VALUE IF NOT EXISTS 'xendit';

-- Persist provider-backed wallet balance snapshots for partner reconciliation.
CREATE TYPE "public"."partner_wallet_snapshot_status" AS ENUM ('synced', 'failed');

CREATE TABLE "public"."partner_wallet_snapshot" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "partner_user_id" BIGINT NOT NULL,
  "partner_provider_account_id" UUID NOT NULL,
  "available_balance_minor" BIGINT NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'PHP',
  "sync_status" "public"."partner_wallet_snapshot_status" NOT NULL DEFAULT 'synced',
  "failure_reason" TEXT,
  "fetched_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "partner_wallet_snapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "partner_wallet_snapshot_partner_user_id_fkey"
    FOREIGN KEY ("partner_user_id")
    REFERENCES "public"."user"("user_id")
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT "partner_wallet_snapshot_partner_provider_account_id_fkey"
    FOREIGN KEY ("partner_provider_account_id")
    REFERENCES "public"."partner_provider_account"("id")
    ON DELETE CASCADE
    ON UPDATE NO ACTION
);

CREATE INDEX "idx_partner_wallet_snapshot_partner_fetched"
  ON "public"."partner_wallet_snapshot"("partner_user_id", "fetched_at" DESC);

CREATE INDEX "idx_partner_wallet_snapshot_account_fetched"
  ON "public"."partner_wallet_snapshot"("partner_provider_account_id", "fetched_at" DESC);
