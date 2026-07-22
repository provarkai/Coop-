# NCMS — Nigerian Cooperative Management System

A multi-tenant SaaS platform that digitizes and automates Nigerian cooperative societies: member onboarding, savings, loans, accounting, meetings, communications, reporting, mobile access, and AI-powered insights.

See [`docs/PRD.md`](docs/PRD.md), [`docs/SDD.md`](docs/SDD.md), [`docs/ROADMAP.md`](docs/ROADMAP.md), and [`docs/PLAYBOOK.md`](docs/PLAYBOOK.md) for the product, architecture, roadmap, and sprint plan.

## Status

- **Sprint 0 (project setup):** done.
- **Sprint 1 (Authentication & RBAC):** done. Registration, login, JWT access/refresh tokens with rotation, password reset, TOTP-based MFA, and role-based access control, with a matching Next.js UI (login, register, dashboard, MFA management, forgot/reset password).

See the Playbook for the remaining sprint sequence, starting with Sprint 2 (Cooperative Management).

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
npx prisma migrate dev
npm run start:dev
```
Runs at `http://localhost:3001`.

### 3. Frontend
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```
Runs at `http://localhost:3000`.

## Auth API

| Endpoint | Description |
| --- | --- |
| `POST /auth/register` | Create an account (returns access + refresh tokens) |
| `POST /auth/login` | Log in; requires `mfaCode` if MFA is enabled |
| `POST /auth/refresh` | Rotate a refresh token for a new token pair |
| `POST /auth/logout` | Revoke a refresh token |
| `POST /auth/forgot-password` | Request a reset link (logged to the console; no email provider yet) |
| `POST /auth/reset-password` | Reset password with a token, revoking existing sessions |
| `POST /auth/mfa/setup` | Generate a TOTP secret + QR code |
| `POST /auth/mfa/enable` / `/auth/mfa/disable` | Confirm a TOTP code to toggle MFA |
| `GET /auth/me` | Current authenticated user |

All routes require a valid JWT except the ones above marked public by design (register, login, refresh, forgot/reset password). Use `@Roles(...)` + the global `RolesGuard` to restrict a route to specific cooperative roles.

## CI

GitHub Actions (`.github/workflows/ci.yml`) lints, builds, and tests both `backend` and `frontend` on every push and pull request to `main`. The backend job runs against a real Postgres service container so the auth e2e suite exercises the full stack.
