-- Remove legacy per-area base pricing in favor of pricing rules
DROP TABLE IF EXISTS "price_rate" CASCADE;
