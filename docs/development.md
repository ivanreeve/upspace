# Development Guide

> This document translates the repository standards into day-to-day engineering practice. Use it when adding routes, changing business logic, introducing UI, or preparing a pull request.

---

## 📚 Table of Contents

- [Baseline Standards](#baseline-standards)
- [Project Conventions By Area](#project-conventions-by-area)
- [Recommended Workflow](#recommended-workflow)
- [Testing Expectations](#testing-expectations)
- [Documentation Maintenance](#documentation-maintenance)
- [Pull Request Checklist](#pull-request-checklist)
- [Design and Frontend Notes](#design-and-frontend-notes)
- [Legacy and Transitional Areas](#legacy-and-transitional-areas)
- [If You Are Unsure](#if-you-are-unsure)

---

## 📋 Baseline Standards

### TypeScript

| Standard | Details |
| --- | --- |
| Strict mode | Keep TypeScript strict |
| Types | Avoid `any` |
| Typing | Prefer explicit domain types and Zod inference over ad hoc inline object typing |
| Contracts | Preserve existing serialization contracts for route handlers and hooks unless the change is intentional and documented |

### Validation

| Standard | Details |
| --- | --- |
| Boundary | Validate request bodies, query parameters, and path-dependent payloads at the route boundary |
| Layer | Zod is the default runtime validation layer |
| Safety | Do not let unvalidated values reach Prisma or raw SQL |

### Error handling

| Standard | Details |
| --- | --- |
| API errors | API handlers should return explicit, human-readable JSON errors |
| Client errors | Client-facing flows should surface meaningful failures through Sonner |
| Silent failures | Avoid silent failures or logging-only error handling when the user needs feedback |

### UI implementation

| Standard | Details |
| --- | --- |
| Components | New UI must use components from `@/components/ui/*` |
| Libraries | Do not introduce a parallel UI component library |
| Accessibility | Keep accessibility intact: labels, focus states, semantic markup, and dialog titles are required |
| Styling | Prefer `rounded-md` when adding rounded corners |

### Icons

| Standard | Details |
| --- | --- |
| Library | Use `react-icons` only |
| Import | Import from subpaths such as `react-icons/fi` and `react-icons/fa` |
| Decorative | Decorative icons should usually be `aria-hidden="true"` and use `className="size-4"` unless the design needs something else |

---

## 🔧 Project Conventions By Area

### Route handlers

When editing `src/app/api/v1/**/route.ts`:

| Step | Action |
| --- | --- |
| 1 | Validate early with Zod |
| 2 | Resolve the actor and enforce role access before business logic |
| 3 | Keep serialization explicit |
| 4 | Return stable JSON envelopes |
| 5 | Update docs with `pnpm docs:api` |

> **Practical rule:** If you changed a route signature, added a query parameter, renamed a route, or introduced a new handler file, the docs must be regenerated in the same change.

### Business logic

When code starts growing inside a route handler or component:

| Action | Destination |
| --- | --- |
| Move reusable logic | `src/lib` |
| Move repeated query logic | Domain helper |
| Keep serializers | Close to the owning domain |

Good examples in the repository:

| Area | Location |
| --- | --- |
| Booking lifecycle helpers | `src/lib/bookings` |
| Pricing rule logic | `src/lib/pricing-rules*` |
| Provider integrations | `src/lib/providers` |
| Notification mapping | `src/lib/notifications` |

### Hooks and client data

| Standard | Details |
| --- | --- |
| React Query | Use React Query for business data that benefits from caching and invalidation |
| Location | Put API-oriented hooks in `src/hooks/api` |
| Alignment | Keep hook APIs aligned with the route contracts they depend on |

### Raw SQL and Prisma

The repository explicitly treats raw SQL as a review hotspot.

If you need raw SQL:

| Step | Action |
| --- | --- |
| 1 | Prefer Prisma query building when possible |
| 2 | If raw SQL is necessary, validate inputs first |
| 3 | Keep SQL in multi-line template strings |
| 4 | Preserve parameter binding and avoid string concatenation |
| 5 | Document why the query is safe in code review |

---

## 🔄 Recommended Workflow

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

---

## 🧪 Testing Expectations

### What to test

| Target | Details |
| --- | --- |
| Business logic | `src/lib` |
| Complex hooks | `src/hooks` |
| Route behavior | New or high-risk API changes |
| Edge cases | Role access, validation failure, and status transitions |

### Existing tooling

| Command | Purpose |
| --- | --- |
| `pnpm test` | Run the Vitest suite |
| `pnpm test:watch` | Run Vitest in watch mode |
| `pnpm test:coverage` | Run Vitest with coverage reporting |

### High-value targets

The following areas deserve extra care:

- booking lifecycle transitions
- pricing rule evaluation
- wallet and payout side effects
- verification and moderation flows
- AI assistant tool execution boundaries
- account deactivation and deletion workflows

---

## 📝 Documentation Maintenance

Documentation is now a first-class maintenance task.

### When you must update docs

| Trigger | Action |
| --- | --- |
| New route handler added | Update docs |
| Route removed or renamed | Update docs |
| Request or response contract changed | Update docs |
| Auth requirements changed | Update docs |
| Feature moved from legacy to active state or vice versa | Update docs |
| Setup prerequisites changed | Update docs |

### Documentation surfaces to consider

| Surface | When to update it |
| --- | --- |
| `README.md` | Entry-point understanding, commands, and major capability changes |
| `docs/setup.md` | New env vars, services, extensions, or setup steps |
| `docs/architecture.md` | Domain boundaries, route groups, or subsystem ownership changes |
| `docs/features.md` | User-visible behavior changes |
| `pnpm docs:api` output | Any `src/app/api/v1` change |

---

## ✅ Pull Request Checklist

Use this before opening or updating a PR:

| # | Check |
| --- | --- |
| 1 | Run `pnpm lint` |
| 2 | Run `pnpm test` |
| 3 | Run `pnpm build` |
| 4 | Run `pnpm docs:api` if API routes changed |
| 5 | Confirm no secrets were added |
| 6 | Check keyboard accessibility for UI changes |
| 7 | Verify user-facing error states are still clear |

---

## 🎨 Design and Frontend Notes

The project standards are explicit:

| Standard | Details |
| --- | --- |
| Design language | Preserve the existing design language when working inside an established screen |
| External libraries | Do not introduce random visual systems or external component libraries |
| Composition | Use shadcn/ui primitives and compose from there |
| Forms | Keep forms accessible and properly labeled |
| Dialogs | Keep dialog content paired with dialog titles |

---

## ⚠️ Legacy and Transitional Areas

Be careful with features that still exist as compatibility surfaces.

### Base rates

Legacy base-rate routes still exist under:

- `/api/v1/spaces/{space_id}/areas/{area_id}/rates`
- `/api/v1/spaces/{space_id}/areas/{area_id}/rates/{rate_id}`

They intentionally return `410 Gone`. Do not build new pricing work against them. Use partner pricing-rule endpoints instead.

### AI search alias

`/api/v1/ai-search` is a deprecated alias for `/api/v1/ai-assistant`. Prefer the assistant route for new work.

---

## ❓ If You Are Unsure

When the right location for logic is unclear, default to this order:

| Priority | Location |
| --- | --- |
| 1 | Business rules in `src/lib` |
| 2 | Thin route handlers in `src/app/api/v1` |
| 3 | Data hooks in `src/hooks/api` |
| 4 | UI composition in `src/components/pages` |

That order matches how the codebase is already organized and helps prevent route files and React components from becoming the place where everything accumulates.
