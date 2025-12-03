ALTER TABLE "area"
  ADD COLUMN IF NOT EXISTS "automatic_booking_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "request_approval_at_capacity" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "advance_booking_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "advance_booking_value" integer,
  ADD COLUMN IF NOT EXISTS "advance_booking_unit" text,
  ADD COLUMN IF NOT EXISTS "booking_notes_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "booking_notes" text;
