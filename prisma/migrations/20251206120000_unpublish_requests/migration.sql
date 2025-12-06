-- Migration: unpublish approval flow
-- Generated manually for UpSpace

BEGIN;

-- 1) Enum for request status (idempotent guard)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'unpublish_request_status') THEN
    CREATE TYPE unpublish_request_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END$$;

-- 2) Publication flags on space
ALTER TABLE "space"
  ADD COLUMN IF NOT EXISTS "is_published" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "unpublished_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "unpublished_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "unpublished_by_admin" BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill for any NULL rows (defensive)
UPDATE "space" SET "is_published" = TRUE WHERE "is_published" IS NULL;

-- 3) Unpublish request table
CREATE TABLE IF NOT EXISTS "unpublish_request" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "space_id" UUID NOT NULL REFERENCES "space"("id") ON DELETE CASCADE,
  "user_id" BIGINT NOT NULL REFERENCES "user"("user_id"),
  "status" unpublish_request_status NOT NULL DEFAULT 'pending',
  "reason" TEXT,
  "rejection_reason" TEXT,
  "processed_by_user_id" BIGINT REFERENCES "user"("user_id"),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "processed_at" TIMESTAMPTZ
);

-- 4) Helpful indexes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'unpublish_request' AND indexname = 'idx_unpublish_request_status_created'
  ) THEN
    CREATE INDEX idx_unpublish_request_status_created ON "unpublish_request" ("status", "created_at");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'unpublish_request' AND indexname = 'idx_unpublish_request_space'
  ) THEN
    CREATE INDEX idx_unpublish_request_space ON "unpublish_request" ("space_id");
  END IF;
END$$;

COMMIT;
