-- Prisma Migrate: Track admin-reviewed payout request state

ALTER TABLE wallet_transaction
  ADD COLUMN processed_at TIMESTAMPTZ(6),
  ADD COLUMN processed_by_user_id BIGINT,
  ADD COLUMN resolution_note TEXT;

ALTER TABLE wallet_transaction
  ADD CONSTRAINT wallet_transaction_processed_by_user_fk
  FOREIGN KEY (processed_by_user_id) REFERENCES "user" (user_id)
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;

CREATE INDEX idx_wallet_transaction_processed_by
  ON wallet_transaction (processed_by_user_id);

CREATE INDEX idx_wallet_transaction_type_status_created
  ON wallet_transaction (type, status, created_at DESC);
