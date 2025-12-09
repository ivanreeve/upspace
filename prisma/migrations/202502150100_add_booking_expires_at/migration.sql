ALTER TABLE "booking"
  ADD COLUMN IF NOT EXISTS "expires_at" timestamptz(6);
