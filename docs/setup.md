# Setup Guide

This guide is the authoritative local-environment reference for UpSpace. It covers the services the app expects, the environment variables currently referenced by the codebase, database extension requirements, and the checks you should run before trusting a local instance.

## What You Need Before Starting

### Required tooling

- Node.js `20.x`
- `pnpm`
- Git
- PostgreSQL or a Supabase project

### Required platform services

- Supabase project with Auth enabled
- PostgreSQL database reachable from Prisma

### Optional but strongly recommended services

- Redis or Upstash Redis for cached listings and rate limiting
- SMTP credentials for OTP and booking emails
- Xendit sandbox account for checkout, refunds, payouts, and payout-account sync
- OpenRouter API key for the marketplace AI assistant
- Google Maps API key for address autocomplete

## Clone and Install

```bash
git clone https://github.com/ivanreeve/upspace.git
cd upspace
pnpm install
```

## Environment Variables

The repository currently does not include a committed `.env.example`, so create `.env` manually in the project root.

### Core application variables

These are the baseline values most local environments need:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Prisma connection string for PostgreSQL. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL used by server and client helpers. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anonymous key used by Supabase client helpers. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for admin/profile sync flows | Required by server-side profile creation and admin sync work. |
| `NEXT_PUBLIC_APP_URL` | Yes | Base URL used in redirect and email links. |
| `NEXT_PUBLIC_APP_NAME` | Recommended | Branding label used by some UX and email flows. |

### Storage and client-facing assets

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SPACE_IMAGES_BUCKET` | Recommended | Public bucket path used for space media resolution. |
| `NEXT_PUBLIC_VERIFICATION_DOCS_BUCKET` | Recommended | Bucket used for verification document uploads. |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Optional | Enables address autocomplete and Places-powered UX. |
| `NEXT_PUBLIC_FACEBOOK_APP_ID` | Optional | Reserved for future client integration needs. |

### AI and search

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | Required for AI assistant | Enables `/api/v1/ai-assistant`. |
| `OPENROUTER_MODEL` | Optional | Overrides the default assistant model. |
| `GEMINI_API_KEY` | Optional | Reserved for alternate AI provider work. |
| `AI_COMMIT_INSTRUCTIONS_PATH` | Optional | Internal file path used by AI tooling. |

### Redis and rate limiting

| Variable | Required | Purpose |
| --- | --- | --- |
| `REDIS_URL` | Optional | Enables Redis-backed listing caches and rate limiting. |
| `SPACES_LIST_CACHE_TTL_SECONDS` | Optional | Overrides the public spaces cache TTL. |

### Financial and payout provider variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `XENDIT_SECRET_KEY` | Required for financial flows | Main provider credential. |
| `XENDIT_WEBHOOK_VERIFICATION_TOKEN` | Required for webhook verification | Preferred token for `/api/provider/webhook`. |
| `XENDIT_CALLBACK_TOKEN` | Optional fallback | Legacy callback token fallback for webhook verification. |
| `XENDIT_API_URL` | Optional | Override provider base URL, usually only for testing. |
| `XENDIT_COUNTRY` | Optional | Defaults to `PH` for Philippine payout channels. |
| `FINANCIAL_DATA_ENCRYPTION_KEY` | Strongly recommended | Encrypts payout-destination data at rest. |
| `CHECKOUT_ALLOWED_REDIRECT_ORIGINS` | Optional | Restricts allowed checkout redirect origins. |

### Email and OTP delivery

| Variable | Required | Purpose |
| --- | --- | --- |
| `EMAIL_SMTP_HOST` | Required for OTP and booking mail | SMTP hostname. |
| `EMAIL_SMTP_PORT` | Required for OTP and booking mail | SMTP port. |
| `EMAIL_SMTP_SECURE` | Optional | Set to `true` or `1` for secure SMTP transport. |
| `EMAIL_SMTP_USER` | Required for OTP and booking mail | SMTP username. |
| `EMAIL_SMTP_PASSWORD` | Required for OTP and booking mail | SMTP password. |
| `EMAIL_FROM` | Optional | Override sender email address. |
| `EMAIL_FROM_NAME` | Optional | Override sender display name. |

### Testing and runtime toggles

| Variable | Required | Purpose |
| --- | --- | --- |
| `TESTING_MODE_ENABLED` | Optional | Enables testing-oriented behavior where supported. |
| `NODE_ENV` | Managed by runtime | Standard Node environment mode. |

### Example `.env`

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/upspace?schema=public"

NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="UpSpace"

NEXT_PUBLIC_SPACE_IMAGES_BUCKET="space-images"
NEXT_PUBLIC_VERIFICATION_DOCS_BUCKET="verification-docs"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your-google-maps-key"

OPENROUTER_API_KEY="your-openrouter-key"
OPENROUTER_MODEL="anthropic/claude-haiku-4.5"

REDIS_URL="redis://localhost:6379"
SPACES_LIST_CACHE_TTL_SECONDS="60"

XENDIT_SECRET_KEY="xnd_development_your_xendit_secret_key"
XENDIT_WEBHOOK_VERIFICATION_TOKEN="your-webhook-token"
FINANCIAL_DATA_ENCRYPTION_KEY="replace-with-a-long-random-secret"

EMAIL_SMTP_HOST="smtp.example.com"
EMAIL_SMTP_PORT="587"
EMAIL_SMTP_SECURE="false"
EMAIL_SMTP_USER="smtp-user"
EMAIL_SMTP_PASSWORD="smtp-password"
EMAIL_FROM="noreply@example.com"
EMAIL_FROM_NAME="UpSpace"
```

## Database Requirements

UpSpace expects PostgreSQL with geospatial, text search, and UUID support.

### Required extensions

- `postgis`
- `pgcrypto`
- `pg_trgm`
- `unaccent`
- `uuid-ossp`

### Why each extension matters

| Extension | Why it matters in UpSpace |
| --- | --- |
| `postgis` | Supports geospatial search and coordinate-aware listing behavior. |
| `pgcrypto` | Supports `gen_random_uuid()` usage in the schema and related database logic. |
| `pg_trgm` | Supports fuzzy search across names and location fields. |
| `unaccent` | Makes search more forgiving for accented text. |
| `uuid-ossp` | Required by the Prisma datasource extension configuration. |

### Example SQL

Run this once against your local database if the extensions are not already enabled:

```sql
create extension if not exists postgis;
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists unaccent;
create extension if not exists "uuid-ossp";
```

## Supabase Notes

UpSpace uses Supabase in several places:

- browser and server auth sessions;
- admin profile synchronization;
- storage-backed image and verification-document URL resolution;
- SSR-safe middleware and route handlers.

Make sure the following are consistent:

- the Supabase project URL matches `NEXT_PUBLIC_SUPABASE_URL`;
- anon and service-role keys belong to the same project;
- storage buckets used for images and verification documents exist;
- Auth is configured for the sign-up and sign-in flows you expect to test.

## Prisma and Migrations

Generate the Prisma client and apply the current schema:

```bash
pnpm prisma generate
pnpm prisma migrate dev
```

If you only need a fresh local client after pulling changes:

```bash
pnpm prisma generate
```

## Generate API Documentation

Regenerate the checked-in API docs before or after route work:

```bash
pnpm docs:api
```

This command updates:

- `public/openapi.json`
- `docs/api-reference.md`

## Run the Application

```bash
pnpm dev
```

Important local URLs:

- Product UI: `http://localhost:3000`
- Scalar API docs: `http://localhost:3000/docs`
- Raw OpenAPI document: `http://localhost:3000/openapi.json`

## Verification Checklist

Run these before assuming the environment is healthy:

```bash
pnpm lint
pnpm test
pnpm build
```

If the app starts but critical features fail, verify the relevant service class below.

## Feature-Specific Setup Notes

### Redis-backed caching and rate limiting

Without `REDIS_URL`, the app can still run, but you lose:

- Redis-backed public space list caching;
- shared rate-limit state across instances;
- some production-like behavior for partner inventory throttling.

### Xendit webhooks

Provider callbacks are handled at:

```text
https://<your-domain>/api/provider/webhook
```

For local tunnel testing, make sure:

- your tunnel forwards to the local Next.js server;
- the verification token configured in Xendit matches `XENDIT_WEBHOOK_VERIFICATION_TOKEN` or the legacy fallback `XENDIT_CALLBACK_TOKEN`;
- `NEXT_PUBLIC_APP_URL` matches the user-visible origin used in redirect links.

### Email flows

The following features depend on working SMTP:

- sign-up OTP delivery;
- forgot-password OTP delivery;
- booking lifecycle emails;
- complaint and payout-adjacent operational messaging.

### AI assistant

`/api/v1/ai-assistant` requires a valid `OPENROUTER_API_KEY`. Without it, AI-assisted marketplace search will not function.

## Troubleshooting

### `Missing Supabase configuration`

Check:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` for admin sync flows

### Prisma or migration failures around extensions

Check that the database really has:

- `postgis`
- `pgcrypto`
- `pg_trgm`
- `unaccent`
- `uuid-ossp`

### Auth works but profile-backed routes fail

This usually means the auth session exists but the internal `user` row has not been created or synced. Re-check:

- `SUPABASE_SERVICE_ROLE_KEY`
- `/api/v1/auth/sync-profile`
- sign-up flow completion

### Wallet and payout flows fail immediately

Check:

- `XENDIT_SECRET_KEY`
- `FINANCIAL_DATA_ENCRYPTION_KEY`
- provider webhook token configuration

### AI assistant returns configuration errors

Check:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- any non-ASCII characters accidentally pasted into the API key

## Recommended First Run Order

If you are bringing up the project from scratch, this is the most reliable sequence:

1. Create `.env`.
2. Enable the required PostgreSQL extensions.
3. Run `pnpm install`.
4. Run `pnpm prisma generate`.
5. Run `pnpm prisma migrate dev`.
6. Run `pnpm docs:api`.
7. Run `pnpm dev`.
8. Run `pnpm lint`, `pnpm test`, and `pnpm build` once the app boots.
