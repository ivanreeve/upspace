-- AlterTable
ALTER TABLE "booking"
  ADD COLUMN "price_rule_id" UUID,
  ADD COLUMN "price_rule_name" TEXT,
  ADD COLUMN "price_rule_snapshot" JSONB,
  ADD COLUMN "price_rule_branch" TEXT,
  ADD COLUMN "price_rule_expression" TEXT;
