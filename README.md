# UpSpace

![banner](public/banner.png)

**Coworking space marketplace and booking platform built with Next.js, TypeScript, Prisma, and Supabase.**

[![Build Status](https://img.shields.io/badge/build-manual-lightgrey)](https://github.com/ivanreeve/upspace)
[![Version](https://img.shields.io/badge/version-0.1.0-E10600)](https://github.com/ivanreeve/upspace)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE.md)

> UpSpace connects customers, remote teams, partners, and administrators through one product surface: customers discover coworking spaces, compare inventory, book areas, pay, chat with hosts, bookmark listings, and leave reviews; partners create and manage spaces, configure inventory, define pricing rules, submit verification documents, monitor wallets, and request payouts; administrators moderate listings, review verifications, reconcile payouts, review complaints and chat reports, and manage user lifecycle actions; AI-assisted search and chat-driven booking workflows sit alongside the traditional marketplace flow.

---

## 📚 Table of Contents

- [About the Project](#about-the-project)
- [Live Demo](#live-demo)
- [Getting Started](#getting-started)
- [System Config](#system-config)
- [Test Credentials / Access Roles](#test-credentials-access-roles)
- [User Roles & Permissions](#user-roles-permissions)
- [Usage Guide](#usage-guide)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)
- [Contact & Support](#contact-support)

---

<a name="about-the-project"></a>
## 📖 About the Project

### Overview

UpSpace is a full-stack coworking space marketplace and booking application built with modern web standards. The platform combines public-facing marketplace features with partner inventory management and administrative tooling in a single Next.js monorepo.

### Key Features

- Multi-role authentication and access control for customers, partners, and administrators
- Public marketplace with search, filtering, geospatial ranking, AI-assisted discovery, and bookmarking
- Booking lifecycle management with area-level inventory, capacity rules, dynamic pricing rules, and state transitions
- Partner space creation and editing with addresses, coordinates, amenities, images, weekly availability, and verification workflows
- Partner wallet with transaction ledger, payout requests, refund actions, and provider-backed payout-account setup
- Administrative moderation: user lifecycle actions, space visibility controls, verification review, complaint resolution, chat-report moderation, payout review, and reconciliation
- AI marketplace assistant with conversational search, space comparison, budget reasoning, and persisted multi-turn conversations
- Space-scoped chat between customers and partners with moderation reporting
- In-app notification feeds with cursor pagination, unread filtering, and bulk actions
- Reviews with star ratings, quick tags, aggregate ratings, and rating distributions

### Tech Stack

| Layer | Technologies |
| --- | --- |
| Web app | Next.js 15 App Router + React 19 |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Data access | Prisma ORM |
| Database | PostgreSQL via Supabase |
| Search and geo | `pg_trgm`, PostGIS |
| Auth | Supabase Auth |
| Client data | React Query (TanStack Query) |
| Validation | Zod |
| Payments and payouts | Xendit (integrated via custom provider code; no dedicated npm package) |
| Tests | Vitest |
| API docs | Scalar + generated OpenAPI |

---

<a name="live-demo"></a>
## 🚀 Live Demo

[**Live Website: https://upspaceph.com**](https://upspaceph.com)

> **Note:** This is the production deployment. A separate staging environment is not currently published.

---

<a name="getting-started"></a>
## 🛠️ Getting Started

### Prerequisites

- Node.js `20.x` (recommended; not enforced in `package.json`)
- `pnpm` (lockfile present)
- Git
- PostgreSQL database or a Supabase project
- Supabase project with Auth enabled
- (Optional but strongly recommended) Redis or Upstash Redis for caching and rate limiting
- (Optional) SMTP credentials for OTP and booking emails
- (Optional) Xendit sandbox account for checkout, refunds, payouts, and payout-account sync
- (Optional) OpenRouter API key for the marketplace AI assistant
- (Optional) Google Maps API key for address autocomplete

### Installation

1. Clone the repository.

```bash
git clone https://github.com/ivanreeve/upspace.git
cd upspace
```

2. Install dependencies.

```bash
pnpm install
```

3. Create `.env` in the project root. The repository does not currently ship a checked-in `.env.example`, so create it manually. See the Environment Variables section below for required values.

4. Enable required PostgreSQL extensions.

```sql
create extension if not exists postgis;
create extension if not exists pg_trgm;
create extension if not exists "uuid-ossp";
```

5. Generate the Prisma client and apply the schema.

```bash
pnpm prisma generate
pnpm prisma migrate dev
```

6. Generate the API documentation.

```bash
pnpm docs:api
```

7. Start the application.

```bash
pnpm dev
```

8. Open the local applications.

- Product UI: [http://localhost:3000](http://localhost:3000)
- Scalar API docs: [http://localhost:3000/docs](http://localhost:3000/docs)
- Raw OpenAPI document: [http://localhost:3000/openapi.json](http://localhost:3000/openapi.json)

### Helpful Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the App Router development server (also runs `prisma generate`) |
| `pnpm lint` | Run ESLint across the repository |
| `pnpm test` | Run the Vitest suite |
| `pnpm test:watch` | Run Vitest in watch mode |
| `pnpm test:coverage` | Run Vitest with coverage reporting |
| `pnpm build` | Verify the production build |
| `pnpm docs:api` | Regenerate Scalar/OpenAPI and markdown API inventory |
| `pnpm prisma generate` | Refresh the Prisma client |
| `pnpm prisma migrate dev` | Apply local schema changes (not defined as a script; run directly) |

### Environment Variables

The repository does not currently include a committed `.env.example`, so create `.env` manually in the project root.

#### Core application variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Prisma connection string for PostgreSQL |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL used by server and client helpers |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anonymous key used by Supabase client helpers |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for admin/profile sync flows | Required by server-side profile creation and admin sync work |
| `NEXT_PUBLIC_APP_URL` | Yes | Base URL used in redirect and email links |
| `NEXT_PUBLIC_APP_NAME` | Recommended | Branding label used by some UX and email flows |

#### Storage and client-facing assets

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SPACE_IMAGES_BUCKET` | Recommended | Public bucket path used for space media resolution |
| `NEXT_PUBLIC_VERIFICATION_DOCS_BUCKET` | Recommended | Bucket used for verification document uploads |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Optional | Enables address autocomplete and Places-powered UX |
| `NEXT_PUBLIC_FACEBOOK_APP_ID` | Optional | Reserved for future client integration needs |

#### AI and search

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | Required for AI assistant | Enables `/api/v1/ai-assistant` |
| `OPENROUTER_MODEL` | Optional | Overrides the default assistant model |
| `GEMINI_API_KEY` | Optional | Reserved for alternate AI provider work |

#### Redis and rate limiting

| Variable | Required | Purpose |
| --- | --- | --- |
| `REDIS_URL` | Optional | Enables Redis-backed listing caches and rate limiting |
| `SPACES_LIST_CACHE_TTL_SECONDS` | Optional | Overrides the public spaces cache TTL |

#### Financial and payout provider variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `XENDIT_SECRET_KEY` | Required for financial flows | Main provider credential |
| `XENDIT_WEBHOOK_VERIFICATION_TOKEN` | Required for webhook verification | Preferred token for `/api/provider/webhook` |
| `XENDIT_CALLBACK_TOKEN` | Optional fallback | Legacy callback token fallback for webhook verification |
| `XENDIT_API_URL` | Optional | Override provider base URL, usually only for testing |
| `XENDIT_COUNTRY` | Optional | Defaults to `PH` for Philippine payout channels |
| `FINANCIAL_DATA_ENCRYPTION_KEY` | Strongly recommended | Encrypts payout-destination data at rest |
| `CHECKOUT_ALLOWED_REDIRECT_ORIGINS` | Optional | Restricts allowed checkout redirect origins |

#### Email and OTP delivery

| Variable | Required | Purpose |
| --- | --- | --- |
| `EMAIL_SMTP_HOST` | Required for OTP and booking mail | SMTP hostname |
| `EMAIL_SMTP_PORT` | Required for OTP and booking mail | SMTP port |
| `EMAIL_SMTP_SECURE` | Optional | Set to `true` or `1` for secure SMTP transport |
| `EMAIL_SMTP_USER` | Required for OTP and booking mail | SMTP username |
| `EMAIL_SMTP_PASSWORD` | Required for OTP and booking mail | SMTP password |
| `EMAIL_FROM` | Optional | Override sender email address |
| `EMAIL_FROM_NAME` | Optional | Override sender display name |

#### Rate limiting overrides

| Variable | Required | Purpose |
| --- | --- | --- |
| `RATE_LIMIT_SPACES_LIMIT` | Optional | Override public spaces list rate limit |
| `RATE_LIMIT_SPACES_WINDOW` | Optional | Override public spaces list rate-limit window (seconds) |
| `RATE_LIMIT_SPACES_SUGGEST_LIMIT` | Optional | Override search-suggestion rate limit |
| `RATE_LIMIT_SPACES_SUGGEST_WINDOW` | Optional | Override suggestion rate-limit window |
| `RATE_LIMIT_BOOKING_CHECKOUT_LIMIT` | Optional | Override booking checkout rate limit |
| `RATE_LIMIT_BOOKING_CHECKOUT_WINDOW` | Optional | Override checkout rate-limit window |
| `RATE_LIMIT_BOOKING_CANCEL_LIMIT` | Optional | Override booking cancellation rate limit |
| `RATE_LIMIT_BOOKING_CANCEL_WINDOW` | Optional | Override cancellation rate-limit window |
| `RATE_LIMIT_BOOKMARK_TOGGLE_LIMIT` | Optional | Override bookmark toggle rate limit |
| `RATE_LIMIT_BOOKMARK_TOGGLE_WINDOW` | Optional | Override bookmark rate-limit window |
| `RATE_LIMIT_CHAT_MESSAGES_LIMIT` | Optional | Override chat message creation rate limit |
| `RATE_LIMIT_CHAT_MESSAGES_WINDOW` | Optional | Override chat rate-limit window |
| `RATE_LIMIT_PARTNER_DASHBOARD_FEED_LIMIT` | Optional | Override partner dashboard feed rate limit |
| `RATE_LIMIT_PARTNER_DASHBOARD_FEED_WINDOW` | Optional | Override dashboard feed rate-limit window |
| `RATE_LIMIT_PARTNER_SPACES_LIMIT` | Optional | Override partner spaces list rate limit |
| `RATE_LIMIT_PARTNER_SPACES_WINDOW` | Optional | Override partner spaces rate-limit window |
| `RATE_LIMIT_PAYOUT_REQUEST_LIMIT` | Optional | Override payout request rate limit |
| `RATE_LIMIT_PAYOUT_REQUEST_WINDOW` | Optional | Override payout request rate-limit window |
| `RATE_LIMIT_REVIEW_CREATE_LIMIT` | Optional | Override review creation rate limit |
| `RATE_LIMIT_REVIEW_CREATE_WINDOW` | Optional | Override review rate-limit window |

> Each rate-limit variable has a hardcoded default in `src/lib/rate-limit.ts`. These env vars only need to be set if you want to override the defaults.

#### Testing and runtime toggles

| Variable | Required | Purpose |
| --- | --- | --- |
| `TESTING_MODE_ENABLED` | Optional | Enables testing-oriented behavior where supported |
| `NODE_ENV` | Managed by runtime | Standard Node environment mode |

> **Note:** Do not commit real environment files or service credentials to version control.
> 
> Some variables may exist in your `.env` but are not actively used by the current codebase, including legacy provider credentials and platform-management tokens. Keep `.env` aligned with the tables above to avoid drift.

---

<a name="system-config"></a>
## ⚙️ System Config

### Local

| Item | Details |
| --- | --- |
| **Installation** | `git clone https://github.com/ivanreeve/upspace.git`, `cd upspace`, `pnpm install` |
| **Tools** | Node.js `20.x`, `pnpm`, Git, PostgreSQL (or Supabase project) |
| **Environment setup** | Create `.env` manually; enable PostgreSQL extensions (`postgis`, `pg_trgm`, `uuid-ossp`); run `pnpm prisma generate` and `pnpm prisma migrate dev` |
| **Test credentials** | Not currently published; create locally or in a controlled staging environment (see [Test Credentials / Access Roles](#test-credentials-access-roles)) |

### Cloud

| Item | Details |
| --- | --- |
| **Hosting platform** | Vercel (production) |
| **URL** | [https://upspaceph.com](https://upspaceph.com) |
| **Deployment account** | — |
| **Access credentials** | — |

> **Note:** A separate staging environment is not currently published.

---

<a name="test-credentials-access-roles"></a>
## 🔐 Test Credentials / Access Roles

> **⚠️ SECURITY WARNING:** If test/demo credentials are created for QA, demonstration, or evaluation, rotate them immediately in any real deployment, never reuse them in production, and restrict access to authorized reviewers.

Test credentials are not currently published in this repository. When needed, they should be created locally or in a controlled staging environment, and limited to approved testers and evaluators only.

### Role-Based Access Notes

- `customer` can browse the marketplace, manage bookings, communicate with partners, and submit reviews.
- `partner` can create and manage spaces, configure inventory and pricing rules, monitor wallets, and request payouts.
- `admin` can moderate listings, review verifications, handle complaints, manage users, and run reconciliation.

---

<a name="user-roles-permissions"></a>
## 👥 User Roles & Permissions

UpSpace supports three principal application roles. The matrix below focuses on representative capabilities.

| Capability | Customer | Partner | Admin | Notes |
| --- | --- | --- | --- | --- |
| Browse public marketplace | ✅ | ✅ | ✅ | Public and authenticated access |
| Search and filter spaces | ✅ | ✅ | ✅ | Includes AI-assisted search |
| Bookmark listings | ✅ | ❌ | ❌ | Customer-only |
| Create and manage bookings | ✅ | ❌ | ❌ | Customer initiates; partner views incoming bookings |
| Submit reviews | ✅ | ❌ | ❌ | After eligible bookings |
| File complaints | ✅ | ❌ | ❌ | Booking-scoped |
| Create and manage spaces | ❌ | ✅ | ❌ | Partner-only |
| Define pricing rules | ❌ | ✅ | ❌ | Partner-only |
| Submit verification materials | ❌ | ✅ | ❌ | Partner-only |
| Manage wallet and request payouts | ❌ | ✅ | ❌ | Partner-only |
| View and act on incoming bookings | ❌ | ✅ | ❌ | Partner-only |
| Moderate listings | ❌ | ❌ | ✅ | Admin-only |
| Review verifications | ❌ | ❌ | ✅ | Admin-only |
| Resolve complaints and chat reports | ❌ | ❌ | ✅ | Admin-only |
| Manage users (enable/disable) | ❌ | ❌ | ✅ | Admin-only |
| Review payout requests and run reconciliation | ❌ | ❌ | ✅ | Admin-only |
| Access admin dashboard and reports | ❌ | ❌ | ✅ | Admin-only |

### Role Distinctions

- `customer` is the default traveler-facing role for discovery, booking, and communication.
- `partner` is the space-owner role for inventory, pricing, verification, and finance operations.
- `admin` is the platform governance role with moderation, verification review, finance oversight, and user administration capabilities.

---

<a name="usage-guide"></a>
## 🧭 Usage Guide

### How to Sign Up or Log In

1. Open the local application at [http://localhost:3000](http://localhost:3000).
2. Navigate to the sign-up or sign-in page.
3. Complete the auth flow (email availability check, OTP delivery, and account creation if signing up).
4. Upon success, the profile is synced and role-specific routes become available.

### Basic Workflow: Customer

1. Browse the marketplace and use search, filters, or the AI assistant to discover spaces.
2. Inspect a space’s details, amenities, availability, and reviews.
3. Select an area, choose duration and guest count, and proceed to booking.
4. Complete checkout and receive a booking confirmation.
5. Communicate with the partner via chat, view booking history, and submit a review after the visit.

### Basic Workflow: Partner

1. Sign in with a partner account.
2. Create a space with address, coordinates, amenities, images, and weekly availability.
3. Define areas and attach pricing rules.
4. Submit verification materials for the space.
5. Monitor incoming bookings, manage wallet transactions, and request payouts.
6. Respond to customer messages and handle complaints.

### Basic Workflow: Admin

1. Sign in with an admin account.
2. Open the admin dashboard to review platform metrics, recent activity, and reporting windows.
3. Process the verification queue, review complaints and chat reports, and manage user lifecycle actions.
4. Review payout requests, run reconciliation, and adjust space visibility as needed.
5. Confirm outcomes and sign out after review.

### Screenshots

Product screenshots are not currently embedded in this README. Recommended captures for future updates are the marketplace browse screen, the AI assistant panel, the partner dashboard, the admin moderation queue, and the booking detail view.

---

<a name="api-documentation"></a>
## 🔌 API Documentation

Most backend routes are exposed under the `/api/v1` prefix. A small number of system-level routes (auth callback, provider webhooks, onboarding) live directly under `/api/*`.

### Base URL

- Local: `http://localhost:3000/api/v1`
- Production: `https://upspaceph.com/api/v1`

### Authentication

- Production authentication uses Supabase sessions.
- Most non-public endpoints require an authenticated Supabase session established by the web app.
- Role-restricted routes enforce access before business logic.

### Route Groups

| Route Group | Description |
| --- | --- |
| `/api/v1/auth/*` | Profile sync, sign-up, deactivation, reactivation, and account removal |
| `/api/v1/spaces*` | Public marketplace, space details, amenities, reviews, suggestions |
| `/api/v1/bookings*` | Booking creation, lifecycle, cancellation, rescheduling, receipts |
| `/api/v1/notifications*` | In-app notification feed and mark-as-read |
| `/api/v1/complaints` | Customer complaint creation |
| `/api/v1/partner/*` | Partner space management, bookings, pricing rules, wallet, complaints |
| `/api/v1/admin/*` | Admin moderation, verification, payout, reconciliation, user management |
| `/api/v1/chat/*` | Chat rooms, messages, and moderation reports |
| `/api/v1/ai-assistant` | Marketplace AI assistant |
| `/api/v1/ai-search` | Deprecated alias for `/api/v1/ai-assistant` |
| `/api/v1/ai/*` | Persisted AI conversation state |
| `/api/v1/wallet*` | Partner wallet and payout operations |
| `/api/v1/financial/*` | Checkout, provider accounts, payout channels |
| `/api/v1/account/*` | Account data export and account-related utilities |
| `/api/v1/customer/*` | Customer-specific operations (transactions, etc.) |
| `/api/v1/bookmarks*` | Saved listings management |
| `/api/v1/reviews*` | Review submission and retrieval |
| `/api/v1/amenities/choices` | Static amenity catalog |
| `/api/v1/reviews/tags` | Review quick-tag catalog |
| `/api/auth/callback` | Supabase auth callback and role-based redirect |
| `/api/onboarding/info` | Onboarding profile completion |
| `/api/provider/webhook` | Xendit financial provider webhook receiver |

### Reference Materials

- API reference document: [`docs/api-reference.md`](docs/api-reference.md)
- Architecture and implementation notes: [`docs/architecture.md`](docs/architecture.md)
- Scalar UI: [`/docs`](http://localhost:3000/docs) (when running locally)
- Machine-readable spec: [`public/openapi.json`](public/openapi.json)

---

<a name="contributing"></a>
## 🤝 Contributing

Contributions should follow the project’s review and testing expectations before merge.

### Contribution Workflow

1. Create a feature branch from the main integration branch.
2. Make focused changes in the appropriate area (`src/app`, `src/lib`, `src/components`, `src/hooks`).
3. Run relevant tests and lint checks locally (`pnpm lint`, `pnpm test`, `pnpm build`).
4. If API routes changed, run `pnpm docs:api` to regenerate documentation.
5. Open a pull request with a clear summary, screenshots if UI-related, and testing notes.

### Branch Naming Convention

Use descriptive branch names such as:

- `feature/short-description`
- `fix/issue-summary`
- `docs/readme-update`
- `chore/dependency-maintenance`

### Project Policies

- Keep TypeScript strict; avoid `any`.
- Validate inputs with Zod at route boundaries.
- Use `@/components/ui/*` for new UI; do not introduce other UI libraries.
- Use `react-icons` exclusively for icons.
- Surface user-facing errors clearly, typically through Sonner toasts.
- Keep raw SQL parameterized and documented.
- Maintain accessibility: labels, focus states, semantic markup, and dialog titles.
- Documentation is part of the feature surface, not post-work cleanup.

See [`docs/development.md`](docs/development.md) for the full development guide.

---

<a name="security"></a>
## 🛡️ Security

Security is a shared responsibility across development, QA, deployment, and administrative operations.

### Reporting Vulnerabilities

- Report security concerns privately to the project maintainers.
- Do not disclose sensitive vulnerabilities in public issues or pull requests.

### Credential Handling Best Practices

- Rotate all demo and seeded credentials before production rollout.
- Never commit `.env`, `.env.local`, service role keys, or database secrets.
- Limit access to administrative accounts using least-privilege principles.
- Store production secrets in managed environment variable platforms.
- Review access logs and administrative activity regularly.

### Test Credential Disclaimer

> If test credentials are created for controlled testing and evaluation environments, they must not remain active in production or publicly exposed administrative deployments.

---

<a name="license"></a>
## 📄 License

This project is licensed under the MIT License. See [`LICENSE.md`](LICENSE.md) for details.

---

<a name="contact-support"></a>
## 📬 Contact & Support

| Topic | Details |
| --- | --- |
| Maintainer | UpSpace Team |
| Issue Tracker | [GitHub Issues](https://github.com/ivanreeve/upspace/issues) |

For operational questions, bug reports, or deployment support, use the issue tracker above.
