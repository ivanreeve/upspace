# Xendit Financial Migration Plan

## Status

- Author: Codex
- Date: 2026-03-12
- Scope: Capstone-ready provider-backed financial architecture
- Goal: Replace the current `PayMongo + mutable internal wallet + admin-manual payout completion` model with a `Xendit-backed partner balance + provider-managed withdrawal` model without breaking the app mid-migration

## Executive Summary

UpSpace should stop behaving like a mini banking system.

The final design is:

1. Customers pay for bookings through Xendit.
2. Partner revenue is routed into a partner-scoped Xendit account context.
3. UpSpace shows a provider-backed wallet balance.
4. UpSpace keeps local financial records for reporting, audit, and reconciliation.
5. Withdrawal destination entry and payout execution should stay on the provider side whenever the tested flow allows it.

For the capstone, the migration must be implemented in small slices:

1. Add a provider abstraction layer.
2. Add provider account and financial tracking tables.
3. Refactor checkout and webhook handling behind the provider layer.
4. Switch the wallet to provider-backed balance snapshots.
5. Replace admin manual payout completion with provider payout monitoring.

The architecture must optimize for:

- strong runtime validation
- idempotent financial mutations
- explicit state machines
- graceful degradation when provider sync fails
- minimal sensitive financial data handled by UpSpace

## Non-Goals

These are out of scope for the capstone implementation:

- multi-provider support in the UI
- full production KYC and merchant-verification lifecycle
- provider dashboard cloning inside UpSpace
- manual admin balance editing
- permanent payout-destination vaulting inside UpSpace unless forced by the proven provider flow

## Current State

Current implementation highlights:

- Customer payments are created through PayMongo checkout in `src/lib/paymongo.ts` and `src/lib/bookings/checkout-session.ts`.
- PayMongo webhooks update local financial records in `src/app/api/paymongo/webhook/handlers.ts`.
- Partner wallet balance is currently derived from local wallet tables in `wallet` and `wallet_transaction`.
- Partner payout requests are created and then completed or rejected by admins through the admin payout queue.

Current technical liabilities:

- UpSpace owns the mutable withdrawable balance.
- Admins act as the final settlement actor for payouts.
- Payment provider logic is coupled directly to route handlers and booking checkout.
- Wallet transaction tables are carrying both reporting and live-balance responsibilities.

## Target State

Final target behavior:

1. A partner enables payouts once.
2. UpSpace creates or links a Xendit partner account context.
3. Customer booking payments are processed through Xendit.
4. Partner share is routed into the partner's provider-backed balance.
5. The partner-facing wallet mirrors provider-backed withdrawable balance.
6. Payout initiation and destination capture are handled by the provider-managed flow whenever supported by the tested prototype path.
7. UpSpace stores:
   - booking revenue records
   - partner revenue allocations
   - provider payout records
   - provider webhook events
   - wallet balance snapshots
8. Admins monitor, reconcile, and retry safe operations. They do not manually mark payouts as paid.

## Design Invariants

These rules must hold through the migration:

1. Money amounts are always stored as integer minor units.
2. Provider webhook events are persisted before they are processed.
3. Every provider write path uses idempotency.
4. Provider state transitions are monotonic:
   - terminal states cannot be overwritten by older events
5. Wallet balance shown to the partner is read-only.
6. Local financial tables are for reporting and reconciliation, not manual cash balance control.
7. Admins can inspect provider-backed payout state but cannot patch balances directly.
8. If provider sync fails, the app falls back to the latest snapshot and surfaces a stale status instead of a fake fresh balance.

## Migration Strategy

The migration should use `additive first, cut over second, cleanup last`.

This means:

1. Add new provider-backed tables and services without removing the current wallet model.
2. Route new behavior through feature-complete provider abstractions.
3. Switch read paths after write paths are stable.
4. Remove legacy balance mutation endpoints only after the new flow is tested.

## Architecture Layers

### 1. Provider Layer

This layer owns all Xendit HTTP calls, schemas, and error mapping.

Planned files:

- `src/lib/providers/types.ts`
- `src/lib/providers/errors.ts`
- `src/lib/providers/provider-registry.ts`
- `src/lib/providers/xendit/client.ts`
- `src/lib/providers/xendit/schemas.ts`
- `src/lib/providers/xendit/mappers.ts`
- `src/lib/providers/xendit/index.ts`

### 2. Domain Layer

This layer owns UpSpace financial rules and state transitions.

Planned files:

- `src/lib/financial/provider-accounts.ts`
- `src/lib/financial/routing.ts`
- `src/lib/financial/payouts.ts`
- `src/lib/financial/snapshots.ts`
- `src/lib/financial/reconciliation.ts`
- `src/lib/financial/webhooks/process-event.ts`
- `src/lib/financial/webhooks/event-router.ts`

### 3. API Layer

This layer validates payloads and delegates to domain services.

Planned or modified routes:

- `src/app/api/v1/financial/provider-account/route.ts`
- `src/app/api/v1/financial/provider-account/status/route.ts`
- `src/app/api/v1/financial/checkout/route.ts`
- `src/app/api/v1/financial/payouts/route.ts`
- `src/app/api/v1/financial/payouts/[payout_id]/route.ts`
- `src/app/api/provider/webhook/route.ts`
- `src/app/api/internal/cron/provider-sync/route.ts`

### 4. UI Layer

This layer renders state only. It does not decide financial semantics.

Planned or modified components:

- `src/components/pages/Wallet/WalletPage.tsx`
- `src/hooks/use-wallet.ts`
- `src/components/pages/Admin/AdminPayoutRequestsPage.tsx`
- `src/hooks/api/useAdminPayoutRequests.ts`
- `src/components/pages/Admin/AdminReportsPage.tsx`
- `src/app/admin/reconciliation/page.tsx`

## Phase 0: Feasibility Spike

This phase must happen before feature work expands.

### Objective

Prove the exact Xendit capabilities that the capstone will rely on.

### Deliverables

- A working Xendit test key configuration
- One successful partner account creation in test mode
- One balance lookup in partner account context
- One booking-payment routing proof
- One provider payout flow proof
- One verified webhook processing example

### Spike Checklist

1. Create a partner-scoped provider account programmatically.
2. Persist its provider account id locally.
3. Query balance in that account context.
4. Create one payment flow for a booking.
5. Route partner share into the partner provider context.
6. Confirm the partner balance reflects the routed funds.
7. Trigger the payout flow that will be used by the capstone.
8. Observe webhook or follow-up status API behavior.

### Stop Conditions

Stop and re-scope if any of these fail:

- partner account creation cannot be done programmatically
- partner-scoped balance cannot be queried in test mode
- routed revenue cannot be reflected in partner-scoped balance
- the chosen payout flow cannot be completed in a way that keeps destination handling out of UpSpace

## Phase 1: Provider Abstraction Layer

### Objective

Decouple payment and payout provider logic from booking, wallet, and admin code.

### File Targets

Add:

- `src/lib/providers/types.ts`
- `src/lib/providers/errors.ts`
- `src/lib/providers/provider-registry.ts`
- `src/lib/providers/xendit/client.ts`
- `src/lib/providers/xendit/schemas.ts`
- `src/lib/providers/xendit/mappers.ts`
- `src/lib/providers/xendit/index.ts`

Modify:

- `src/lib/bookings/checkout-session.ts`
- `src/app/api/v1/paymongo/checkout/route.ts`
- `src/app/api/paymongo/webhook/handlers.ts`
- `src/lib/paymongo.ts`

### Interface Draft

```ts
export type ProviderName = "xendit";

export type CreatePartnerProviderAccountInput = {
  partnerUserId: bigint;
  partnerAuthUserId: string;
  email?: string | null;
  displayName: string;
};

export type PartnerProviderAccountResult = {
  provider: ProviderName;
  providerAccountId: string;
  accountType: "owned";
  status: "pending" | "active" | "disabled" | "error";
  currency: "PHP";
  metadata?: Record<string, unknown>;
};

export type ProviderBalanceResult = {
  providerAccountId: string;
  availableMinor: string;
  pendingMinor?: string | null;
  currency: "PHP";
  fetchedAt: string;
};

export type CreateBookingPaymentInput = {
  bookingId: string;
  customerAuthUserId: string;
  partnerUserId: bigint;
  partnerProviderAccountId: string;
  amountMinor: number;
  currency: "PHP";
  description: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
};

export type CreateBookingPaymentResult = {
  providerPaymentId: string;
  checkoutUrl: string;
  status: "pending";
  expiresAt?: string | null;
};

export type CreateRevenueRoutingInput = {
  bookingId: string;
  providerPaymentId: string;
  partnerProviderAccountId: string;
  grossMinor: number;
  platformFeeMinor: number;
  partnerShareMinor: number;
  currency: "PHP";
};

export type CreateRevenueRoutingResult = {
  routingMode: "split_rule" | "transfer";
  providerRoutingId: string;
  status: "pending" | "processing" | "completed" | "failed";
};

export type CreatePayoutFlowInput = {
  partnerUserId: bigint;
  partnerProviderAccountId: string;
  amountMinor: number;
  currency: "PHP";
  referenceId: string;
  returnUrl?: string | null;
};

export type CreatePayoutFlowResult = {
  providerPayoutId?: string | null;
  providerPayoutLinkId?: string | null;
  status: "pending" | "processing";
  redirectUrl?: string | null;
  expiresAt?: string | null;
};

export type ParsedProviderWebhookEvent = {
  provider: ProviderName;
  providerEventId: string;
  eventType: string;
  providerObjectId?: string | null;
  occurredAt: string;
  livemode: boolean;
  payload: Record<string, unknown>;
};

export interface FinancialProvider {
  createPartnerProviderAccount(
    input: CreatePartnerProviderAccountInput
  ): Promise<PartnerProviderAccountResult>;

  getPartnerBalance(providerAccountId: string): Promise<ProviderBalanceResult>;

  createBookingPayment(
    input: CreateBookingPaymentInput
  ): Promise<CreateBookingPaymentResult>;

  createRevenueRouting(
    input: CreateRevenueRoutingInput
  ): Promise<CreateRevenueRoutingResult>;

  createPayoutFlow(
    input: CreatePayoutFlowInput
  ): Promise<CreatePayoutFlowResult>;

  getPayoutStatus(providerPayoutId: string): Promise<{
    status: "pending" | "processing" | "paid" | "failed" | "cancelled";
    failureReason?: string | null;
    processedAt?: string | null;
  }>;

  verifyWebhookSignature(payload: string, headers: Headers): Promise<boolean>;

  parseWebhookEvent(payload: unknown): Promise<ParsedProviderWebhookEvent>;
}
```

### Error Handling Pattern

`src/lib/providers/errors.ts` should define typed errors only:

```ts
export class ProviderConfigError extends Error {}
export class ProviderAuthError extends Error {}
export class ProviderValidationError extends Error {
  constructor(message: string, public readonly fieldErrors?: Record<string, string>) {
    super(message);
  }
}
export class ProviderConflictError extends Error {}
export class ProviderUnsupportedError extends Error {}
export class ProviderTransientError extends Error {
  constructor(message: string, public readonly retryable = true) {
    super(message);
  }
}
```

### Required Patterns

1. All provider client methods must use zod to parse responses.
2. All non-2xx provider responses must be normalized into typed errors.
3. All provider writes must accept or derive an idempotency key.
4. No UI-facing route should leak raw provider payloads.

### Edge Cases

- duplicate account creation requests
- partially persisted provider account setup
- malformed provider response
- transient provider outage
- unsupported payout mode in test mode

### Acceptance

- `createBookingCheckoutSession` no longer imports PayMongo functions directly
- provider-specific logic is isolated to `src/lib/providers/xendit/*`

## Phase 2: Database Schema Draft

### Objective

Add provider-backed financial tables while preserving current wallet tables until cutover.

### File Targets

Modify:

- `prisma/schema.prisma`

Add migrations:

- `prisma/migrations/<timestamp>_add_partner_provider_accounts/migration.sql`
- `prisma/migrations/<timestamp>_add_provider_financial_tables/migration.sql`

### Prisma Model Drafts

```prisma
model partner_provider_account {
  id                    String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  partner_user_id       BigInt
  provider              String
  provider_account_id   String   @unique
  provider_account_type String
  status                String
  currency              String   @default("PHP") @db.Char(3)
  metadata              Json?
  created_at            DateTime @default(now()) @db.Timestamptz(6)
  updated_at            DateTime @default(now()) @db.Timestamptz(6)
  last_synced_at        DateTime? @db.Timestamptz(6)
  user                  user     @relation(fields: [partner_user_id], references: [user_id], onDelete: NoAction, onUpdate: NoAction)

  @@unique([partner_user_id, provider], map: "uq_partner_provider_account_partner_provider")
  @@index([status], map: "idx_partner_provider_account_status")
}

model provider_booking_payment {
  id                    String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  booking_id            String   @db.Uuid
  provider              String
  provider_payment_id   String   @unique
  provider_reference_id String   @unique
  gross_amount_minor    BigInt
  currency              String   @default("PHP") @db.Char(3)
  status                String
  metadata              Json?
  paid_at               DateTime? @db.Timestamptz(6)
  failed_at             DateTime? @db.Timestamptz(6)
  created_at            DateTime @default(now()) @db.Timestamptz(6)
  updated_at            DateTime @default(now()) @db.Timestamptz(6)
  booking               booking  @relation(fields: [booking_id], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@index([booking_id], map: "idx_provider_booking_payment_booking")
  @@index([status, created_at], map: "idx_provider_booking_payment_status_created")
}

model provider_revenue_allocation {
  id                        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  booking_id                String   @db.Uuid
  provider_booking_payment_id String @db.Uuid
  partner_user_id           BigInt
  partner_provider_account_id String @db.Uuid
  gross_minor               BigInt
  platform_fee_minor        BigInt
  partner_share_minor       BigInt
  routing_mode              String
  provider_routing_id       String?
  status                    String
  metadata                  Json?
  created_at                DateTime @default(now()) @db.Timestamptz(6)
  updated_at                DateTime @default(now()) @db.Timestamptz(6)
  booking                   booking  @relation(fields: [booking_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  payment                   provider_booking_payment @relation(fields: [provider_booking_payment_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  provider_account          partner_provider_account @relation(fields: [partner_provider_account_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  user                      user @relation(fields: [partner_user_id], references: [user_id], onDelete: NoAction, onUpdate: NoAction)

  @@unique([booking_id], map: "uq_provider_revenue_allocation_booking")
  @@index([partner_user_id, created_at(sort: Desc)], map: "idx_provider_revenue_allocation_partner_created")
  @@index([status], map: "idx_provider_revenue_allocation_status")
}

model partner_wallet_snapshot {
  id                        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  partner_user_id           BigInt
  partner_provider_account_id String @db.Uuid
  available_balance_minor   BigInt
  pending_balance_minor     BigInt?
  currency                  String   @default("PHP") @db.Char(3)
  sync_status               String
  failure_reason            String?
  fetched_at                DateTime @db.Timestamptz(6)
  created_at                DateTime @default(now()) @db.Timestamptz(6)
  provider_account          partner_provider_account @relation(fields: [partner_provider_account_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  user                      user @relation(fields: [partner_user_id], references: [user_id], onDelete: NoAction, onUpdate: NoAction)

  @@index([partner_user_id, fetched_at(sort: Desc)], map: "idx_partner_wallet_snapshot_partner_fetched")
}

model partner_payout_record {
  id                        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  partner_user_id           BigInt
  partner_provider_account_id String @db.Uuid
  provider                  String
  provider_payout_id        String?  @unique
  provider_payout_link_id   String?  @unique
  local_reference_id        String   @unique
  amount_minor              BigInt
  currency                  String   @default("PHP") @db.Char(3)
  status                    String
  destination_summary_masked String?
  failure_reason            String?
  requested_at              DateTime @default(now()) @db.Timestamptz(6)
  processed_at              DateTime? @db.Timestamptz(6)
  metadata                  Json?
  created_at                DateTime @default(now()) @db.Timestamptz(6)
  updated_at                DateTime @default(now()) @db.Timestamptz(6)
  provider_account          partner_provider_account @relation(fields: [partner_provider_account_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  user                      user @relation(fields: [partner_user_id], references: [user_id], onDelete: NoAction, onUpdate: NoAction)

  @@index([partner_user_id, requested_at(sort: Desc)], map: "idx_partner_payout_record_partner_requested")
  @@index([status], map: "idx_partner_payout_record_status")
}

model provider_webhook_event {
  id                 String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  provider           String
  provider_event_id  String
  event_type         String
  provider_object_id String?
  livemode           Boolean  @default(false)
  payload_json       Json
  processing_status  String   @default("received")
  error_message      String?
  received_at        DateTime @default(now()) @db.Timestamptz(6)
  processed_at       DateTime? @db.Timestamptz(6)

  @@unique([provider, provider_event_id], map: "uq_provider_webhook_event_provider_event")
  @@index([provider_object_id], map: "idx_provider_webhook_event_object")
  @@index([processing_status, received_at(sort: Desc)], map: "idx_provider_webhook_event_status_received")
}
```

### Notes

1. Keep `wallet` and `wallet_transaction` during migration for backwards compatibility.
2. New code should treat:
   - `partner_wallet_snapshot` as provider-backed wallet state
   - `provider_revenue_allocation` as the source for booking earnings history
   - `partner_payout_record` as the source for payout history
3. Legacy wallet tables can be retired after cutover, or left as historical data if time is short.

### Edge Cases

- `provider_payout_id` may be null initially if the flow creates a payout link before the actual payout object exists
- balance snapshots must support failure states without discarding previous successful rows
- routing records must prevent duplicate routing per booking

### Acceptance

- Schema supports provider-backed balances, payout tracking, and webhook audit without deleting current wallet functionality

## Phase 3: API Contracts

### Objective

Introduce explicit financial routes that reflect the new provider-backed model.

### Validation Rules

- Every request body is validated with zod.
- Every response has a stable shape with either `data` or `error`.
- No route leaks raw provider payloads to the client.

### 3.1 Enable Provider Account

**Route**

- `POST /api/v1/financial/provider-account`

**Purpose**

- Create or re-link the partner's provider-backed payout account

**Request**

```json
{}
```

No user input required beyond authenticated partner session.

**Response**

```json
{
  "data": {
    "provider": "xendit",
    "providerAccountId": "acc_123",
    "accountType": "owned",
    "status": "active",
    "currency": "PHP"
  }
}
```

**Errors**

- `401` authentication required
- `403` partner role required
- `409` setup already in progress or partially inconsistent
- `500` provider setup failed

**Behavior**

- idempotent
- returns existing account if already provisioned
- never creates a duplicate provider account for the same partner

### 3.2 Get Provider Account Status

**Route**

- `GET /api/v1/financial/provider-account/status`

**Response**

```json
{
  "data": {
    "configured": true,
    "provider": "xendit",
    "status": "active",
    "lastSyncedAt": "2026-03-12T12:00:00.000Z"
  }
}
```

### 3.3 Start Booking Checkout

**Route**

- `POST /api/v1/financial/checkout`

This can initially be a refactor of the existing booking checkout route instead of a public route rename if migration risk is high.

**Request**

```json
{
  "spaceId": "uuid",
  "areaId": "uuid",
  "bookingHours": 4,
  "startAt": "2026-03-15T09:00:00.000Z",
  "guestCount": 2,
  "successUrl": "https://app.example/success",
  "cancelUrl": "https://app.example/cancel"
}
```

**Response**

```json
{
  "data": {
    "bookingId": "uuid",
    "providerPaymentId": "pay_123",
    "checkoutUrl": "https://checkout.provider.example/...",
    "testingMode": true
  }
}
```

**Errors**

- `400` invalid booking payload
- `401` authentication required
- `403` customer role required
- `404` area not found
- `409` booking or pricing conflict
- `429` checkout rate limit
- `500` provider checkout error

### 3.4 Wallet Read Model

**Route**

- `GET /api/v1/wallet`

**Response**

```json
{
  "wallet": {
    "provider": "xendit",
    "balanceMinor": "250000",
    "currency": "PHP",
    "syncStatus": "fresh",
    "lastSyncedAt": "2026-03-12T12:00:00.000Z"
  },
  "transactions": [
    {
      "id": "uuid",
      "type": "earning",
      "status": "succeeded",
      "amountMinor": "75000",
      "currency": "PHP",
      "description": "Booking payout allocation",
      "bookingId": "uuid",
      "createdAt": "2026-03-12T11:00:00.000Z"
    }
  ],
  "pagination": {
    "hasMore": false,
    "nextCursor": null
  },
  "stats": {
    "totalEarnedMinor": "500000",
    "totalRefundedMinor": "50000",
    "totalPaidOutMinor": "200000",
    "transactionCount": 12
  }
}
```

**Behavior**

- if live provider fetch succeeds, update snapshot and return fresh data
- if live fetch fails but a recent snapshot exists, return snapshot with `syncStatus = "stale"`
- if no provider account exists, return `walletSetupRequired` state instead of 500

### 3.5 Start Payout Flow

**Route**

- `POST /api/v1/financial/payouts`

**Purpose**

- create a provider-managed payout flow for the authenticated partner

**Request**

```json
{
  "amountMinor": 100000
}
```

**Response**

```json
{
  "data": {
    "payoutId": "uuid",
    "status": "pending",
    "redirectUrl": "https://provider.example/payout-link/...",
    "expiresAt": "2026-03-13T12:00:00.000Z"
  }
}
```

**Errors**

- `400` invalid amount
- `401` authentication required
- `403` partner role required
- `409` payout account not configured or payout already in progress
- `429` payout initiation rate limit
- `500` provider payout error

**Behavior**

- create local payout record first
- use idempotency key derived from local payout record
- never mark payout as final at creation time

### 3.6 Get Payout Status

**Route**

- `GET /api/v1/financial/payouts/[payout_id]`

**Response**

```json
{
  "data": {
    "id": "uuid",
    "status": "processing",
    "amountMinor": "100000",
    "currency": "PHP",
    "requestedAt": "2026-03-12T12:00:00.000Z",
    "processedAt": null,
    "failureReason": null
  }
}
```

### 3.7 Provider Webhook

**Route**

- `POST /api/provider/webhook`

**Behavior**

1. verify signature
2. persist raw event
3. parse normalized event
4. process state transition
5. mark event record result

**Response**

```json
{ "received": true }
```

### 3.8 Provider Sync Job

**Route**

- `POST /api/internal/cron/provider-sync`

**Purpose**

- refresh wallet snapshots and payout statuses when webhook timing is unreliable

## State Machines

### Provider Account State

- `pending`
- `active`
- `disabled`
- `error`

Rules:

- only `pending -> active|error`
- only `active -> disabled|error`
- retries can move `error -> active`

### Booking Payment State

- `pending`
- `paid`
- `failed`
- `refunded`
- `cancelled`

Rules:

- `paid` and `failed` are terminal except `paid -> refunded`

### Payout State

- `pending`
- `processing`
- `paid`
- `failed`
- `cancelled`

Rules:

- `paid`, `failed`, and `cancelled` are terminal
- webhook or explicit provider status check decides terminal state
- UI button clicks never set terminal state directly

## Error Handling and Elegant Patterns

### Pattern 1: Typed Domain Errors

All service-layer functions should throw typed errors only.

Bad:

```ts
throw new Error("something went wrong");
```

Good:

```ts
throw new ProviderTransientError("Xendit balance lookup failed");
```

### Pattern 2: Persist Event First

Webhook sequence must always be:

1. verify
2. persist raw event
3. process
4. mark processing result

Never process provider events directly from the HTTP body without persisting them.

### Pattern 3: Local Record Before Remote Mutation

For payouts:

1. create local payout record with reference id
2. call provider with that reference id
3. persist provider payout ids

This prevents "provider created object, app lost track of it" scenarios.

### Pattern 4: Idempotent Writes

Every remote financial mutation needs an idempotency key.

Recommended keys:

- provider account setup: `partner:{partnerUserId}:provider-account`
- booking checkout: `booking:{bookingId}:checkout`
- revenue routing: `booking:{bookingId}:routing`
- payout flow: `payout:{localPayoutId}:create`

### Pattern 5: Fallback to Snapshot

If live provider balance fetch fails:

- return latest successful snapshot
- mark the response as stale
- log the provider failure
- schedule retry via sync job

Do not zero out the partner wallet.

### Pattern 6: Terminal State Guard

All state transitions must reject invalid regressions.

Example:

- if payout is already `paid`, ignore later `processing` events
- if payment is already `refunded`, ignore redundant `paid` replay

## Testing Plan

### Unit Tests

- provider response parsing
- error normalization
- state transition guards
- idempotency key generation
- reconciliation calculations

### Integration Tests

- enable payouts creates one provider account only
- checkout creates provider payment record once
- webhook duplicate delivery is safe
- payout flow persists local record before provider call
- stale snapshot fallback works

### Sandbox Tests

- create partner provider account
- fetch partner balance
- route booking earnings
- create payout flow
- observe payout status update

## Rollout Order

1. Phase 0 spike
2. Phase 1 provider abstraction
3. Phase 2 schema and migrations
4. Phase 3 financial routes
5. checkout refactor
6. webhook refactor
7. routing implementation
8. wallet API cutover
9. wallet UI cutover
10. admin payout/admin reconciliation cutover
11. legacy endpoint cleanup

## Decision Gates

Proceed to the next phase only if:

1. partner provider account creation works in test mode
2. partner balance lookup works in test mode
3. revenue routing into partner context works in test mode
4. chosen payout flow works well enough to keep payout destination entry out of UpSpace
5. webhook or polling can drive payout status to terminal states

## Recommended First Implementation Slice

If implementation starts immediately, do this first:

1. Add `partner_provider_account` and `provider_webhook_event` models.
2. Build the provider abstraction and a Xendit client with typed errors.
3. Add `POST /api/v1/financial/provider-account` and `GET /api/v1/financial/provider-account/status`.
4. Add a minimal partner settings UI for `Enable payouts`.
5. Write tests for idempotent partner provider account creation.

This is the smallest valuable slice because it proves:

- provider configuration is viable
- partner account provisioning works
- the rest of the migration has a real foundation
