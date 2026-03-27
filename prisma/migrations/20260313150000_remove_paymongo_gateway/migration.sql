BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "public"."payment_event"
    WHERE "provider"::text = 'paymongo'
  ) OR EXISTS (
    SELECT 1
    FROM "public"."payment_transaction"
    WHERE "provider"::text = 'paymongo'
  ) OR EXISTS (
    SELECT 1
    FROM "public"."transaction"
    WHERE "payment_method"::text = 'paymongo'
  ) THEN
    RAISE EXCEPTION 'Cannot remove paymongo gateway while legacy paymongo records still exist.';
  END IF;
END $$;

ALTER TYPE "public"."gateway" RENAME TO "gateway_old";
CREATE TYPE "public"."gateway" AS ENUM ('xendit');

ALTER TABLE "public"."transaction"
  ALTER COLUMN "payment_method" TYPE "public"."gateway"
  USING ("payment_method"::text::"public"."gateway");

ALTER TABLE "public"."payment_event"
  ALTER COLUMN "provider" TYPE "public"."gateway"
  USING ("provider"::text::"public"."gateway");

ALTER TABLE "public"."payment_transaction"
  ALTER COLUMN "provider" TYPE "public"."gateway"
  USING ("provider"::text::"public"."gateway");

DROP TYPE "public"."gateway_old";

COMMIT;
