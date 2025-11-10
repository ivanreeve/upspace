## Project

**UpSpace** – A coworking space marketplace and booking application built with modern web standards.

- **Stack**: Next.js (App Router) + TypeScript (strict) + Prisma + Supabase Postgres
- **Package manager**: pnpm
- **Node**: 20.x

## Database

PostgreSQL with required extensions:
- **Geospatial**: PostGIS
- **Security**: `pgcrypto`
- **Search**: `pg_trgm`, `unaccent`

## Development Standards

### Code Quality

- **TypeScript**: Strict mode enforced. No `any` types.
- **Linting**: ESLint + Prettier. Fix all errors before commit (`pnpm lint`).
- **Patterns**: Prefer async/await over promises. No floating promises.
- **Validation**: Use Zod for runtime validation of inputs and API payloads.

### UI Development

All new React UI must use **shadcn/ui** components from `@/components/ui/*`. Do not add other UI libraries.

To add a missing component:
```bash
pnpm dlx shadcn@latest add <component>
```

**Accessibility requirements**: Label all inputs with `aria-*` attributes, maintain visible focus states, and use semantic HTML.

### Icons

Use **react-icons** exclusively. Import from pack subpaths to minimize bundle size:

```tsx
import { FiSearch } from "react-icons/fi";    // Feather icons
import { FaUser } from "react-icons/fa";      // Font Awesome
```

Decorative icons should have `aria-hidden="true"` and use `className="size-4"` by default.

#### Example: SearchBar Component

```tsx
import { Button, Input } from "@/components/ui";
import { FiSearch } from "react-icons/fi";

export function SearchBar() {
  return (
    <form className="flex items-center gap-2">
      <Input placeholder="Search" aria-label="Search query" />
      <Button type="submit">
        <FiSearch className="size-4" aria-hidden="true" />
        <span className="sr-only">Search</span>
      </Button>
    </form>
  );
}
```

## Security

- **Secrets & tokens**: Never hardcode. Use environment variables only.
- **Input handling**: Treat all user input as untrusted. Sanitize and validate using Zod.
- **Dangerous functions**: Avoid `eval`, dynamic `Function` constructors, and unsafe regex patterns.

## Performance

- **Server-side rendering**: Prefer incremental rendering on the server where feasible.
- **Database queries**: Avoid N+1 problems by using Prisma `include`/`select` properly and maintaining appropriate database indexes.

## Pre-Commit Checklist

Before creating a PR:
1. Run `pnpm lint --fix --` and fix all errors
2. Ensure no secrets in code or tests
3. Verify TypeScript builds without errors
4. Test accessibility with keyboard navigation

## For AI Agents (Codex)

1. **Keep conventions**: Maintain existing patterns and standards with minimal diff churn.
2. **Run checks**: Use linting and type-checking commands before proposing changes.