# NCMS — Nigerian Cooperative Management System

A multi-tenant SaaS platform that digitizes and automates Nigerian cooperative societies: member onboarding, savings, loans, accounting, meetings, communications, reporting, mobile access, and AI-powered insights.

See [`docs/PRD.md`](docs/PRD.md), [`docs/SDD.md`](docs/SDD.md), [`docs/ROADMAP.md`](docs/ROADMAP.md), and [`docs/PLAYBOOK.md`](docs/PLAYBOOK.md) for the product, architecture, roadmap, and sprint plan.

## Status

Sprint 0 (project setup) — repositories, tooling, and skeleton apps are in place. No features are implemented yet; see the Playbook for the sprint sequence starting with Sprint 1 (Authentication & RBAC).

## Structure

```
backend/   NestJS API (PostgreSQL via Prisma)
frontend/  Next.js web app (App Router, TypeScript, Tailwind)
docs/      Product, design, roadmap, and playbook documents
```

## Tech Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS
- **Backend:** NestJS, TypeScript
- **Database:** PostgreSQL (via Prisma)
- **Cache:** Redis
- **Mobile:** Flutter (planned, Sprint 11)

## Getting Started

### Prerequisites
- Node.js 22+
- Docker (for local Postgres/Redis)

### 1. Start local infrastructure
```bash
docker compose up -d
```

### 2. Backend
```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npm run start:dev
```
Runs at `http://localhost:3001`.

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```
Runs at `http://localhost:3000`.

## CI

GitHub Actions (`.github/workflows/ci.yml`) lints, builds, and tests both `backend` and `frontend` on every push and pull request to `main`.
