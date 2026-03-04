-- Prisma Migrate: Add normalized payment event and payment transaction tables

BEGIN;

-- enums
CREATE TYPE payment_event_status AS ENUM ('received', 'processed', 'ignored', 'failed');
CREATE TYPE payment_transaction_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded', 'cancelled');

-- event log table for webhook idempotency and audit
CREATE TABLE payment_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider gateway NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  provider_object_id TEXT,
  livemode BOOLEAN NOT NULL DEFAULT false,
  payload_json JSON NOT NULL,
  received_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ(6),
  processing_status payment_event_status NOT NULL DEFAULT 'received',
  error_message TEXT,
  CONSTRAINT uq_payment_event_provider_event UNIQUE (provider, provider_event_id)
);
CREATE INDEX idx_payment_event_provider_type ON payment_event (provider, event_type);
CREATE INDEX idx_payment_event_object ON payment_event (provider_object_id);
CREATE INDEX idx_payment_event_received ON payment_event (received_at DESC);

-- normalized booking payment facts
CREATE TABLE payment_transaction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID,
  provider gateway NOT NULL,
  provider_object_id TEXT NOT NULL,
  payment_event_id UUID,
  status payment_transaction_status NOT NULL DEFAULT 'pending',
  amount_minor BIGINT NOT NULL,
  fee_minor BIGINT,
  net_amount_minor BIGINT,
  currency_iso3 CHAR(3) NOT NULL DEFAULT 'PHP',
  payment_method_type TEXT,
  is_live BOOLEAN NOT NULL DEFAULT false,
  occurred_at TIMESTAMPTZ(6),
  raw_gateway_json JSON,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) DEFAULT now(),
  CONSTRAINT payment_transaction_booking_fk
    FOREIGN KEY (booking_id) REFERENCES booking (id)
    ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT payment_transaction_event_fk
    FOREIGN KEY (payment_event_id) REFERENCES payment_event (id)
    ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT uq_payment_tx_provider_object UNIQUE (provider, provider_object_id)
);
CREATE INDEX idx_payment_tx_booking_created ON payment_transaction (booking_id, created_at DESC);
CREATE INDEX idx_payment_tx_status_created ON payment_transaction (status, created_at DESC);

COMMIT;
