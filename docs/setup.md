# Setup Guide

This guide will help you set up the UpSpace project locally.

## Prerequisites

Ensure you have the following installed:

- **Node.js**: v20.x or higher
- **pnpm**: Package manager (`npm install -g pnpm`)
- **Docker**: For running a local PostgreSQL database (optional if using Supabase directly)
- **Git**: For version control

## 1. Clone the Repository

```bash
git clone <repository_url>
cd upspace
```

## 2. Install Dependencies

Install the project dependencies using pnpm:

```bash
pnpm install
```

## 3. Environment Configuration

Create a `.env` file in the root directory. You can start by copying the example if available, or use the template below:

```bash
# Database (Prisma)
# format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/upspace?schema=public"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="your_supabase_project_url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key"

# Google Maps (Required for address autocomplete)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your_google_maps_api_key"

# Payment Gateway (PayMongo)
PAYMONGO_SECRET_KEY="your_paymongo_secret_key"
```

> **Note:** If you are connecting to a remote Supabase instance, replace `DATABASE_URL` with the connection string provided by Supabase (Transaction Pooler is recommended).

## 4. Database Setup

This project uses Prisma with PostgreSQL.

### Option A: Local Development (Docker)

If you have a `docker-compose.yml` (check project root), you can spin up a local DB. Otherwise, ensure you have a local Postgres instance running with the required extensions (`postgis`, `pgcrypto`, `pg_trgm`, `unaccent`).

### Option B: Remote Database (Supabase)

If you are using Supabase:
1. Create a new project on Supabase.
2. Get the connection string from Database settings.
3. Update `.env`.

### Run Migrations

Apply the database schema:

```bash
pnpm prisma generate
pnpm prisma migrate dev
```

## 5. Running the Application

Start the development server:

```bash
pnpm dev
```

The application should be available at `http://localhost:3000`.

## 6. Testing

Run the test suite to ensure everything is working:

```bash
pnpm test
```
