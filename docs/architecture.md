# Architecture

This document describes how UpSpace is structured today: the route groups, the domain boundaries, the data model, the integration points, and the documentation pipeline that now feeds Scalar and the generated markdown API inventory.

## System Overview

UpSpace is a full-stack App Router application with a single TypeScript codebase and a PostgreSQL-backed data model. The main architectural layers are:

1. App Router pages and layouts in `src/app`
2. Feature components in `src/components`
3. Hooks and client data access in `src/hooks`
4. Server-side business logic in `src/lib`
5. Prisma-backed persistence in `prisma/schema.prisma`
6. Route handlers under `src/app/api/v1`
7. Generated API documentation under `public/openapi.json` and `docs/api-reference.md`

## App Router Structure

### Route groups

The UI is split into role-oriented route groups:

| Route group | Purpose |
| --- | --- |
| `src/app/(marketplace)` | Public marketplace browsing, detail pages, AI search, and customer-facing discovery flows |
| `src/app/(auth)` | Sign-in, sign-up, and forgot-password experiences |
| `src/app/customer` | Customer account, bookings, messages, notifications, bookmarks, and transactions |
| `src/app/partner` | Partner inventory management, dashboard, wallet, complaints, and messaging |
| `src/app/admin` | Moderation, verification, finance, reporting, and user-management interfaces |
| `src/app/docs` | Scalar API documentation UI |

### Shared page concerns

Several cross-cutting concerns are handled centrally:

- `src/app/layout.tsx` provides global providers, styles, and shell behavior.
- `src/middleware.ts` handles role-aware routing, auth checks, and public-path detection.
- `src/components/providers.tsx` and `src/components/providers/QueryProvider.tsx` wire client state and React Query.

## API Architecture

The versioned REST surface lives under `src/app/api/v1`. The route families map closely to product domains:

| Domain | Representative route families |
| --- | --- |
| Public marketplace | `/api/v1/spaces`, `/api/v1/spaces/{space_id}`, `/api/v1/spaces/suggest`, `/api/v1/reviews/tags`, `/api/v1/amenities/choices` |
| Auth and profile | `/api/v1/auth/*` |
| Bookings | `/api/v1/bookings*` |
| Notifications | `/api/v1/notifications*` |
| Complaints | `/api/v1/complaints`, `/api/v1/partner/complaints*`, `/api/v1/admin/complaints*` |
| Chat | `/api/v1/chat/*` |
| AI | `/api/v1/ai-assistant`, `/api/v1/ai-search`, `/api/v1/ai/conversations*` |
| Partner operations | `/api/v1/partner/*` |
| Wallet and finance | `/api/v1/wallet*`, `/api/v1/financial/*` |
| Admin operations | `/api/v1/admin/*` |
| Account export | `/api/v1/account/export` |

### Route-handler style

Most route handlers follow the same broad shape:

1. Validate auth or actor role if the route is not public.
2. Parse query or body data with Zod.
3. Delegate business rules to `src/lib` helpers where possible.
4. Persist or fetch through Prisma.
5. Serialize the result into a UI-friendly payload.
6. Return JSON with explicit error states.

### Auth model

Authentication relies on Supabase sessions, typically resolved server-side through:

- `createSupabaseServerClient`
- `requirePartnerSession`
- `requireAdminSession`

Authorization is role-based, with three principal roles:

- `customer`
- `partner`
- `admin`

## Domain Model

The Prisma schema is the best source of truth for persisted state. The following entities form the core business model.

### Identity and access

| Model | Purpose |
| --- | --- |
| `user` | Internal profile row mapped to a Supabase auth user |
| `deactivation_request` | Tracks account deactivation and deletion workflows |
| `audit_event` | Captures operator and system actions for operational traceability |

### Marketplace inventory

| Model | Purpose |
| --- | --- |
| `space` | Public coworking listing |
| `area` | Reservable inventory unit inside a space |
| `amenity_choice` | Static amenity definition catalog |
| `amenity` | Join table between a space and an amenity choice |
| `space_image` and related storage paths | Public listing media resolved through Supabase storage helpers |
| `availability`-adjacent records | Weekly opening hours and availability rows |

### Booking and experience

| Model | Purpose |
| --- | --- |
| `booking` | Reservation record with lifecycle state, cached names, pricing snapshot, and occupancy fields |
| `review` | Customer review for a visited space |
| `common_review` | Review quick tags |
| `bookmark` | Customer-saved listing |
| `chat_room` | Space-scoped customer-partner thread |
| `chat_message` | Individual message rows |
| `chat_report` | Moderation report for chat abuse or misconduct |
| `complaint` | Booking-scoped complaint and escalation workflow |
| `app_notification` | In-app notification feed |

### Pricing and finance

| Model | Purpose |
| --- | --- |
| `price_rule` | Declarative pricing-rule definition attached to a space |
| `wallet` | Partner balance row |
| `wallet_transaction` | Wallet ledger entries for charges, refunds, and payouts |
| `transaction` / payment-related tables | Booking payment and settlement records |
| `provider-account`-adjacent persisted records | Provider-backed payout-account state |

### Verification and moderation

| Model | Purpose |
| --- | --- |
| `verification` | Reviewable verification submission |
| `verification_document` | Stored supporting documents for verification workflows |
| moderation queues | Surface from complaints, chat reports, unpublish requests, and deactivation requests |

## Booking Lifecycle Design

Bookings are central to the application and drive multiple downstream systems.

### State model

The booking type currently recognizes:

- `pending`
- `confirmed`
- `cancelled`
- `rejected`
- `expired`
- `checkedin`
- `checkedout`
- `completed`
- `noshow`

Allowed transitions are encoded in `src/lib/bookings/constants.ts`.

### Supporting subsystems

Booking flows touch:

- occupancy checks in `src/lib/bookings/occupancy.ts`
- expiration handling in `src/lib/bookings/expiration.ts`
- detail serialization in `src/lib/bookings/detail.ts`
- booking email delivery in `src/lib/email.ts`
- in-app notifications in `src/lib/notifications/booking.ts`
- pricing-rule evaluation in `src/lib/pricing-rules-evaluator.ts`
- checkout creation in `src/lib/bookings/checkout-session.ts`

## Pricing Model

UpSpace no longer treats area pricing as a static rate table. The current architecture favors declarative pricing rules:

- rule definitions live in `src/lib/pricing-rules.ts`;
- evaluation lives in `src/lib/pricing-rules-evaluator.ts`;
- partner CRUD endpoints live under `/api/v1/partner/spaces/{space_id}/pricing-rules*`;
- legacy base-rate endpoints under `/api/v1/spaces/{space_id}/areas/{area_id}/rates*` are intentionally left as `410 Gone`.

This matters when changing booking or checkout behavior: if you try to reintroduce direct rates in one part of the stack, you will immediately diverge from the current owner-facing product model.

## Wallet and Financial Design

Wallet behavior is tied to partner operations rather than generic stored-value top-ups.

### Key rules

- wallet balance is derived from booking-driven credits and operational debits;
- refunds and payouts create ledger entries, not silent balance mutations;
- payout-account state is mirrored from Xendit;
- finance operations expose both admin and partner workflows.

### Relevant modules

| Path | Responsibility |
| --- | --- |
| `src/lib/wallet-server.ts` | Auth-aware wallet resolution |
| `src/lib/wallet.ts` | Wallet utility behavior |
| `src/lib/financial/provider-accounts.ts` | Provider-account synchronization |
| `src/lib/financial/xendit-payouts.ts` | Payout behavior |
| `src/lib/financial/xendit-refunds.ts` | Refund behavior |
| `src/lib/providers/xendit/*` | Low-level provider client and payload parsing |

## AI Architecture

The AI layer is not isolated in a separate service. It is embedded into the Next.js backend.

### Main route

- `/api/v1/ai-assistant`

### Supporting modules

| Path | Responsibility |
| --- | --- |
| `src/lib/assistant-agent.ts` | System prompt composition |
| `src/lib/ai/space-agent.ts` | Marketplace space search tools |
| `src/lib/ai/booking-tools.ts` | Booking-aware tool operations |
| `src/lib/ai/comparison-tools.ts` | Space comparison helpers |
| `src/lib/ai/recommendation-tools.ts` | Personalized recommendation helpers |
| `src/lib/ai/budget-tools.ts` | Budget-oriented ranking and estimation |
| `src/lib/ai/search-reference-data.ts` | Lookup data exposed to the assistant |
| `src/lib/ai/booking-action.ts` | Tool-initiated booking mutations |

The assistant route can search, compare, validate availability, and move users into booking-related flows. This means AI route work must be treated as product work, not just experimentation.

## Search, Geo, and Caching

### Search

Search spans several layers:

- SQL and Prisma-backed listing queries
- trigram and unaccent support in PostgreSQL
- geospatial filters and proximity ranking with PostGIS
- suggestion endpoints for autocomplete
- AI-driven search as a separate higher-level surface

### Caching and rate limiting

Redis-backed helpers in `src/lib/cache/redis.ts` and `src/lib/rate-limit.ts` accelerate and protect:

- public space listings
- suggestion queries
- partner listing views
- partner dashboard feed endpoints

Without Redis, the app can still run, but you should expect behavior to be less production-like.

## UI Layer and Component Architecture

The frontend follows a feature-first organization:

- `src/components/pages/*` contains page-specific views and panels
- `src/components/ui/*` contains shadcn/ui primitives and wrappers
- `src/hooks/api/*` provides client-side hooks mapped to route-handler families

Important UI rules enforced by project conventions:

- new UI should use `@/components/ui/*`
- icons should come from `react-icons`
- user-visible failures should surface clearly through Sonner
- accessibility constraints matter for dialogs, labels, and focus states

## Documentation Architecture

The repository now treats API documentation as generated output instead of a manually curated stub.

### Source of truth

- live route inventory: `src/app/api/v1/**/route.ts`
- generator: `scripts/generate-openapi.mjs`

### Outputs

- Scalar/OpenAPI source: `public/openapi.json`
- generated markdown inventory: `docs/api-reference.md`
- UI: `src/app/docs/page.tsx` and `src/app/docs/ScalarApiReference.tsx`

### Why this matters

If a route is added or changed but `pnpm docs:api` is not run, the UI docs and the markdown reference will drift from the code. Documentation maintenance is part of route maintenance.

## Suggested Reading Order

If you are new to the codebase:

1. Read [`README.md`](../README.md)
2. Read [`setup.md`](setup.md)
3. Read [`features.md`](features.md)
4. Skim `prisma/schema.prisma`
5. Read [`api-reference.md`](api-reference.md)
6. Open `/docs` while inspecting `src/app/api/v1`
