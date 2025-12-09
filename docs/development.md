# Development Guidelines

This document outlines the standards and workflows for contributing to UpSpace.

## Code Quality Standards

*   **TypeScript**: Strict mode is enforced. Do not use `any`. Define interfaces/types for all data structures.
*   **Linting**: We use ESLint and Prettier. Run `pnpm lint` to check for issues.
*   **Async/Await**: Prefer `async/await` syntax over `.then()` chains. Avoid floating promises.
*   **Validation**: Use [Zod](https://zod.dev/) for validating API inputs, environment variables, and form data.
*   **DRY (Don't Repeat Yourself)**: Extract common logic into hooks (`src/hooks`) or utility functions (`src/lib`).

## UI Development

We use **shadcn/ui** for our component library.

*   **Adding Components**: Use the CLI to add new components:
    ```bash
    pnpm dlx shadcn@latest add <component-name>
    ```
*   **Styling**: Use Tailwind CSS utility classes. Avoid custom CSS files unless absolutely necessary.
*   **Icons**: Use `react-icons`. Import specific icons to optimize bundle size (e.g., `import { FiSearch } from "react-icons/fi"`).
*   **Accessibility**: Ensure all interactive elements have accessible names (`aria-label`) and visible focus states.

## Testing

We use **Vitest** for unit and integration testing.

*   **Run Tests**: `pnpm test`
*   **Watch Mode**: `pnpm test:watch`
*   **Coverage**: `pnpm test:coverage`

Write tests for:
1.  Business logic in `src/lib`.
2.  Complex hooks in `src/hooks`.
3.  API endpoints and Server Actions.

## Directory Structure

*   `src/app`: Next.js App Router pages and layouts.
*   `src/components`: React components.
    *   `ui/`: Generic shadcn/ui components.
    *   `auth/`, `spaces/`, etc.: Feature-specific components.
*   `src/hooks`: Custom React hooks.
*   `src/lib`: Utility functions, API clients, and business logic.
*   `src/types`: TypeScript type definitions.
*   `prisma/`: Database schema and migrations.
*   `public/`: Static assets.

## Git Workflow

1.  Create a feature branch.
2.  Make your changes.
3.  Run `pnpm lint --fix` and `pnpm test` to ensure quality.
4.  Commit your changes using clear messages.
5.  Push and create a Pull Request.

**Pre-Commit Checklist:**
*   [ ] Linting passes.
*   [ ] No secrets committed.
*   [ ] TypeScript compiles without errors.
*   [ ] Accessibility checks passed.
