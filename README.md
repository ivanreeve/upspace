# UpSpace

![banner](public/banner.png)

> **Coworking Space Marketplace & Booking Platform**

![stars](https://img.shields.io/github/stars/ivanreeve/capstone)
![license](https://img.shields.io/badge/license-MIT-blue.svg)

UpSpace is a comprehensive platform connecting remote workers and teams with flexible coworking spaces. It features real-time bookings, an integrated wallet system, geospatial search, and partner management tools.

## 📚 Documentation

We have detailed documentation available to help you get started:

- **[🚀 Setup Guide](docs/setup.md)**: Installation, environment configuration, and running the app.
- **[🏗️ Architecture](docs/architecture.md)**: Tech stack, database schema, and system design.
- **[💻 Development](docs/development.md)**: Coding standards, testing, and contribution guidelines.
- **[✨ Features](docs/features.md)**: Detailed breakdown of platform capabilities.

## ⚡ Quick Start

1.  **Clone & Install**:
    ```bash
    git clone <repo-url>
    cd upspace
    pnpm install
    ```

2.  **Environment**:
    Create a `.env` file (see [Setup Guide](docs/setup.md) for details).

3.  **Database**:
    ```bash
    pnpm prisma generate
    pnpm prisma migrate dev
    ```

4.  **Run**:
    ```bash
    pnpm dev
    ```
    Visit `http://localhost:3000`.

## 🛠️ Tech Stack

*   **Frontend**: Next.js 15 (App Router), React, Tailwind CSS, shadcn/ui
*   **Backend**: Next.js Server Actions, Prisma ORM
*   **Database**: PostgreSQL (Supabase) with PostGIS & pg_trgm
*   **Tools**: TypeScript, Vitest, Zod, React Query

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.