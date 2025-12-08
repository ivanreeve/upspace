export type IntegrationEpic =
  | "authentication"
  | "discovery"
  | "search"
  | "booking"
  | "payment";

export type IntegrationTestType = "positive" | "negative";

export type IntegrationTestCase = {
  id: string;
  title: string;
  description: string;
  type: IntegrationTestType;
  epics: IntegrationEpic[];
  preconditions: string[];
  steps: string[];
  expectedSystem: string[];
  expectedUI: string[];
  touchpoints: string[];
  cleanup?: string[];
};

export const integrationTestingFixture: IntegrationTestCase[] = [
  {
    id: "flow/signup-search-book-pay-success",
    title: "New user signs up, discovers a space, books, and pays successfully",
    description:
      "End-to-end happy path from account creation through payment capture, verifying API wiring, DB writes, and payment gateway callbacks.",
    type: "positive",
    epics: ["authentication", "discovery", "search", "booking", "payment"],
    preconditions: ["No existing user with the signup email", "Space available with inventory and price"],
    steps: [
      "POST /api/auth/signup with valid payload and complete email verification",
      "GET /api/spaces and /api/search with keyword + filters to select a space/slot",
      "POST /api/bookings to create a pending booking",
      "POST /api/payments/intent to create a payment intent and confirm via gateway",
      "Receive payment succeeded webhook to finalize booking",
    ],
    expectedSystem: [
      "User row created; session cookie issued",
      "Search returns selected space; caching consistent across requests",
      "Booking row created with locked availability transaction",
      "Payment intent captured; ledger/receipts stored; booking marked paid",
      "Notification email/job enqueued",
    ],
    expectedUI: [
      "User redirected to dashboard post-authentication",
      "Spaces list/search results render selected space details",
      "Booking confirmation screen shows reserved slot and price",
      "Payment success toast and paid badge shown",
    ],
    touchpoints: [
      "Supabase/Postgres (users, spaces, bookings, ledger)",
      "Prisma transactions for booking + availability",
      "Payment gateway intents + webhooks",
      "Email/notification service enqueue",
    ],
    cleanup: ["Delete test user", "Release test booking/payment artifacts"],
  },
  {
    id: "flow/login-filter-book-conflict-rollback",
    title: "Existing user hits booking conflict and transaction rolls back",
    description:
      "Login, filter spaces, then attempt to book an already-occupied slot to ensure conflicts surface and no partial writes occur.",
    type: "negative",
    epics: ["authentication", "discovery", "search", "booking", "payment"],
    preconditions: [
      "User exists and can log in",
      "Target space has an existing booking covering the target slot",
      "Payment gateway keys configured",
    ],
    steps: [
      "POST /api/auth/login and obtain session",
      "GET /api/spaces with filters (amenities/location) to select the space",
      "POST /api/bookings with overlapping slot",
    ],
    expectedSystem: [
      "409 conflict returned from booking creation",
      "Prisma transaction rolls back; no duplicate booking rows",
      "No payment intent created; no holds placed",
      "Availability cache refreshed or invalidated",
    ],
    expectedUI: [
      "User remains authenticated",
      "Error toast explains slot is unavailable",
      "UI re-enables booking controls and shows current availability",
    ],
    touchpoints: [
      "Supabase/Postgres (bookings, availability materialized views)",
      "Prisma transactions with constraint checks",
      "Payment gateway not invoked",
    ],
  },
  {
    id: "flow/payment-decline-retry-success",
    title: "Payment declines then succeeds on retry without duplicate bookings",
    description:
      "Simulate a card decline, ensure booking remains pending/unpaid, then retry with a successful payment method to complete the booking.",
    type: "negative",
    epics: ["authentication", "booking", "payment"],
    preconditions: [
      "User authenticated with an existing pending booking",
      "Payment gateway test cards available for decline and success",
    ],
    steps: [
      "POST /api/payments/intent with failing test card to trigger decline",
      "Observe payment failed webhook (if applicable)",
      "Retry POST /api/payments/intent with valid test card and confirm",
      "Process payment succeeded webhook",
    ],
    expectedSystem: [
      "First attempt leaves booking in pending/unpaid state; no ledger entry",
      "Second attempt captures payment and marks booking paid",
      "Idempotency keys prevent duplicate charges on retries",
    ],
    expectedUI: [
      "Decline surfaced via toast with retry CTA",
      "Retry flow reuses booking context; on success shows paid badge and receipt link",
    ],
    touchpoints: ["Payment gateway intents + webhooks", "Bookings table status transitions", "Ledger/receipts storage"],
  },
  {
    id: "flow/webhook-idempotent-refund",
    title: "Webhook idempotency and refund processing",
    description:
      "Validate duplicate webhook deliveries do not double-charge and that refund flows adjust booking and ledger correctly.",
    type: "positive",
    epics: ["booking", "payment"],
    preconditions: ["Booking already marked paid via successful intent", "Webhook secret configured"],
    steps: [
      "Replay payment_succeeded webhook payload with same event id twice",
      "POST /api/payments/refund to initiate refund",
      "Handle refund webhook/event to finalize state",
    ],
    expectedSystem: [
      "Second webhook delivery is ignored via idempotency check",
      "Refund creates reversal ledger entry and updates booking to refunded/cancelled per policy",
      "Receipts/history entries created for audit",
    ],
    expectedUI: [
      "No duplicate payment status change shown",
      "Refund confirmation displayed; booking status reflects refund",
    ],
    touchpoints: [
      "Payment gateway webhook handler",
      "Ledger and booking status updates within a transaction",
      "Notification/email for refund",
    ],
  },
  {
    id: "flow/expired-session-during-checkout",
    title: "Session expiry during checkout cleans up holds and redirects",
    description:
      "Ensure authentication expiry mid-checkout forces re-authentication and cleans up any provisional holds or locks.",
    type: "negative",
    epics: ["authentication", "booking", "payment"],
    preconditions: ["User logged in with short-lived session token", "Space selected with provisional hold mechanism"],
    steps: [
      "Initiate booking and reach payment step",
      "Expire or revoke session token before confirming payment",
      "Attempt to confirm payment or submit booking",
    ],
    expectedSystem: [
      "401 returned on protected calls; session cleared",
      "Any provisional hold/lock on availability released",
      "No payment intent remains active or is cancelled if created",
    ],
    expectedUI: [
      "Redirect to login with context to resume checkout",
      "Hold timer cleared and booking state reset after re-auth",
    ],
    touchpoints: [
      "Auth middleware/guards",
      "Availability hold/lock system",
      "Payment intent cancellation (if pre-created)",
    ],
  },
  {
    id: "flow/cancel-within-policy-refund",
    title: "Cancellation inside policy window issues refund and audit trail",
    description:
      "End-to-end cancellation within policy to verify transactional updates across booking, payments, and notifications.",
    type: "positive",
    epics: ["authentication", "booking", "payment"],
    preconditions: ["Paid booking within allowable cancellation window"],
    steps: [
      "Authenticate user owning the booking",
      "POST /api/bookings/{id}/cancel within policy window",
      "Process refund via payment gateway and handle webhook",
    ],
    expectedSystem: [
      "Booking status transitions to cancelled within a transaction",
      "Refund processed and ledger updated with reversal",
      "History/audit record persisted; notifications enqueued",
    ],
    expectedUI: [
      "Cancellation confirmation shown with policy messaging",
      "Refund status/badge visible; booking removed from upcoming list",
    ],
    touchpoints: [
      "Bookings + ledger tables via Prisma transaction",
      "Payment gateway refund + webhook handler",
      "Notification/email service",
    ],
  },
];
