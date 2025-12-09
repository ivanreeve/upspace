-- Prisma Migrate: Add wallet/payment ledger tables

-- enums
CREATE TYPE wallet_transaction_status AS ENUM ('pending', 'succeeded', 'failed');
CREATE TYPE wallet_transaction_type AS ENUM ('cash_in', 'charge', 'refund', 'payout');

-- wallet table
CREATE TABLE wallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL UNIQUE,
  balance_minor BIGINT NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'PHP',
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) DEFAULT now(),
  CONSTRAINT wallet_user_fk FOREIGN KEY (user_id) REFERENCES "user" (user_id) ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX idx_wallet_user ON wallet (user_id);

-- wallet transaction ledger
CREATE TABLE wallet_transaction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL,
  type wallet_transaction_type NOT NULL,
  status wallet_transaction_status NOT NULL DEFAULT 'succeeded',
  amount_minor BIGINT NOT NULL,
  net_amount_minor BIGINT,
  currency CHAR(3) NOT NULL DEFAULT 'PHP',
  description TEXT,
  external_reference TEXT,
  metadata JSON,
  booking_id UUID,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) DEFAULT now(),
  CONSTRAINT wallet_transaction_wallet_fk FOREIGN KEY (wallet_id) REFERENCES wallet (id) ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX idx_wallet_transaction_wallet_created ON wallet_transaction (wallet_id, created_at DESC);
