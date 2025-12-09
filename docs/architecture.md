# Architecture & Tech Stack

UpSpace is a modern full-stack application designed for performance, scalability, and type safety.

## Technology Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Database**: PostgreSQL (hosted on [Supabase](https://supabase.com/))
- **ORM**: [Prisma](https://www.prisma.io/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Components**: [shadcn/ui](https://ui.shadcn.com/) (based on Radix UI)
- **State Management**: [React Query](https://tanstack.com/query/latest) (Server state), [Zustand](https://github.com/pmndrs/zustand) (Client state)
- **Testing**: [Vitest](https://vitest.dev/)
- **Maps**: Google Maps Platform

## System Overview

The application follows a standard Next.js App Router architecture:

1.  **Frontend (Client/Server Components)**: 
    -   Pages and layouts are defined in `src/app`.
    -   Reusable UI components in `src/components/ui`.
    -   Feature-specific components in `src/components`.

2.  **API Layer**:
    -   Server Actions are used for mutations (form submissions, data updates).
    -   Route Handlers (`src/app/api/...`) may be used for webhooks or external integrations.

3.  **Data Layer**:
    -   Prisma Client interacts with the PostgreSQL database.
    -   Zod is used for runtime validation of data at the API boundary.

## Database Schema

The database is built on PostgreSQL with several extensions enabled for advanced functionality:

*   **`postgis`**: Handles geospatial data for Spaces (lat/long).
*   **`pg_trgm` / `unaccent`**: Powers fuzzy search capabilities for finding spaces.
*   **`pgcrypto`**: Used for secure UUID generation.

### Key Entities

*   **User**: The central actor (Customer, Partner, or Admin).
*   **Space**: Represents a coworking property. Contains location, amenities, and images.
*   **Area**: Sub-units within a space (e.g., "Hot Desk Area", "Meeting Room A").
*   **Booking**: A reservation for a specific Area within a Space.
*   **Wallet**: Holds user balances for transactions.
*   **Review**: User feedback for spaces.

## Key Integrations

*   **Supabase**: Provides the PostgreSQL database and potential Auth/Storage services.
*   **Google Maps**: Used for address autocomplete (`useGoogleMapsPlaces.ts`) and displaying maps.
*   **PayMongo**: Payment gateway for handling transactions (`src/lib/paymongo.ts`).
