-- Financial hardening for wallet idempotency and payout contention.

BEGIN;

WITH ranked AS (
  SELECT
    id,
    external_reference,
    ROW_NUMBER() OVER (
      PARTITION BY external_reference
      ORDER BY created_at ASC, id ASC
    ) AS row_num
  FROM wallet_transaction
  WHERE external_reference IS NOT NULL
)
UPDATE wallet_transaction wt
SET
  external_reference = NULL,
  metadata = (
    COALESCE(wt.metadata::jsonb, '{}'::jsonb)
    || jsonb_build_object('deduped_external_reference', ranked.external_reference)
  )::json
FROM ranked
WHERE wt.id = ranked.id
  AND ranked.row_num > 1;

-- Enforce webhook and API idempotency per provider reference.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'wallet_transaction_external_reference_key'
  ) THEN
    ALTER TABLE wallet_transaction
      ADD CONSTRAINT wallet_transaction_external_reference_key UNIQUE (external_reference);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_wallet_transaction_wallet_type_status
  ON wallet_transaction (wallet_id, type, status);

-- At most one pending payout per wallet at any time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_pending_payout_per_wallet
  ON wallet_transaction (wallet_id)
  WHERE type = 'payout'::wallet_transaction_type
    AND status = 'pending'::wallet_transaction_status;

COMMIT;
