-- Migration: add FK for app_notification.booking_id -> booking.id

BEGIN;

-- Clear orphaned references so the FK can be added safely
UPDATE "app_notification" an
SET booking_id = NULL
WHERE booking_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "booking" b
    WHERE b.id = an.booking_id
  );

-- Enforce referential integrity while allowing notification retention on delete
ALTER TABLE "app_notification"
ADD CONSTRAINT "app_notification_booking_fk"
FOREIGN KEY ("booking_id") REFERENCES "booking" ("id")
ON DELETE SET NULL
ON UPDATE NO ACTION;

COMMIT;
