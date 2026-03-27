# Development Guide

This document translates the repository standards into day-to-day engineering practice. Use it when adding routes, changing business logic, introducing UI, or preparing a pull request.

## Baseline Standards

### TypeScript

- Keep TypeScript strict.
- Avoid `any`.
- Prefer explicit domain types and Zod inference over ad hoc inline object typing.
- Preserve existing serialization contracts for route handlers and hooks unless the change is intentional and documented.

### Validation

- Validate request bodies, query parameters, and path-dependent payloads at the route boundary.
- Zod is the default runtime validation layer.
- Do not let unvalidated values reach Prisma or raw SQL.

### Error handling

- API handlers should return explicit, human-readable JSON errors.
- Client-facing flows should surface meaningful failures through Sonner.
- Avoid silent failures or logging-only error handling when the user needs feedback.

### UI implementation

- New UI must use components from `@/components/ui/*`.
- Do not introduce a parallel UI component library.
- Keep accessibility intact: labels, focus states, semantic markup, and dialog titles are required.
- Prefer `rounded-md` when adding rounded corners.

### Icons

- Use `react-icons` only.
- Import from subpaths such as `react-icons/fi` and `react-icons/fa`.
- Decorative icons should usually be `aria-hidden="true"` and use `className="size-4"` unless the design needs something else.

## Project Conventions By Area

## Route handlers

When editing `src/app/api/v1/**/route.ts`:

- validate early with Zod;
- resolve the actor and enforce role access before business logic;
- keep serialization explicit;
- return stable JSON envelopes;
- update docs with `pnpm docs:api`.

Practical rule: if you changed a route signature, added a query parameter, renamed a route, or introduced a new handler file, the docs must be regenerated in the same change.

## Business logic

When code starts growing inside a route handler or component:

- move reusable logic into `src/lib`;
- move repeated query logic into a domain helper;
- keep serializers and shape-normalization code close to the owning domain.

Good examples in the repository:

- booking lifecycle helpers under `src/lib/bookings`
- pricing rule logic under `src/lib/pricing-rules*`
- provider integrations under `src/lib/providers`
- notification mapping under `src/lib/notifications`

## Hooks and client data

- Use React Query for business data that benefits from caching and invalidation.
- Put API-oriented hooks in `src/hooks/api`.
- Keep hook APIs aligned with the route contracts they depend on.

## Raw SQL and Prisma

The repository explicitly treats raw SQL as a review hotspot.

If you need raw SQL:

- prefer Prisma query building when possible;
- if raw SQL is necessary, validate inputs first;
- keep SQL in multi-line template strings;
- preserve parameter binding and avoid string concatenation;
- document why the query is safe in code review.

## Recommended Workflow

### 1. Inspect before editing

Before changing a feature:

- read the route or component you are touching;
- trace supporting `src/lib` helpers;
- inspect related hooks and page-level UI;
- check whether the behavior is already described in `docs/features.md` or `docs/api-reference.md`.

### 2. Make the smallest change that actually solves the problem

Prefer minimal diff churn, but do not preserve a bad abstraction just to keep the patch small. If the current structure causes duplication or hides business logic, extract the logic properly.

### 3. Regenerate documentation when routes change

```bash
pnpm docs:api
```

This updates:

- `public/openapi.json`
- `docs/api-reference.md`

### 4. Run verification commands

At minimum, run:

```bash
pnpm lint
pnpm test
pnpm build
```

If your change affects Prisma schema or migrations, also run:

```bash
pnpm prisma generate
```

## Testing Expectations

### What to test

- business logic in `src/lib`
- complex hooks in `src/hooks`
- route behavior for new or high-risk API changes
- edge cases around role access, validation failure, and status transitions

### Existing tooling

- `pnpm test`
- `pnpm test:watch`
- `pnpm test:coverage`

### High-value targets

The following areas deserve extra care:

- booking lifecycle transitions
- pricing rule evaluation
- wallet and payout side effects
- verification and moderation flows
- AI assistant tool execution boundaries
- account deactivation and deletion workflows

## Documentation Maintenance

Documentation is now a first-class maintenance task.

### When you must update docs

- new route handler added
- route removed or renamed
- request or response contract changed
- auth requirements changed
- feature moved from legacy to active state or vice versa
- setup prerequisites changed

### Documentation surfaces to consider

| Surface | When to update it |
| --- | --- |
| `README.md` | Entry-point understanding, commands, and major capability changes |
| `docs/setup.md` | New env vars, services, extensions, or setup steps |
| `docs/architecture.md` | Domain boundaries, route groups, or subsystem ownership changes |
| `docs/features.md` | User-visible behavior changes |
| `pnpm docs:api` output | Any `src/app/api/v1` change |

## Pull Request Checklist

Use this before opening or updating a PR:

- run `pnpm lint`
- run `pnpm test`
- run `pnpm build`
- run `pnpm docs:api` if API routes changed
- confirm no secrets were added
- check keyboard accessibility for UI changes
- verify user-facing error states are still clear

## Design and Frontend Notes

The project standards are explicit:

- preserve the existing design language when working inside an established screen;
- do not introduce random visual systems or external component libraries;
- use shadcn/ui primitives and compose from there;
- keep forms accessible and properly labeled;
- keep dialog content paired with dialog titles.

## Legacy and Transitional Areas

Be careful with features that still exist as compatibility surfaces.

### Base rates

Legacy base-rate routes still exist under:

- `/api/v1/spaces/{space_id}/areas/{area_id}/rates`
- `/api/v1/spaces/{space_id}/areas/{area_id}/rates/{rate_id}`

They intentionally return `410 Gone`. Do not build new pricing work against them. Use partner pricing-rule endpoints instead.

### AI search alias

`/api/v1/ai-search` is a deprecated alias for `/api/v1/ai-assistant`. Prefer the assistant route for new work.

## If You Are Unsure

When the right location for logic is unclear, default to this order:

1. business rules in `src/lib`
2. thin route handlers in `src/app/api/v1`
3. data hooks in `src/hooks/api`
4. UI composition in `src/components/pages`

That order matches how the codebase is already organized and helps prevent route files and React components from becoming the place where everything accumulates.
