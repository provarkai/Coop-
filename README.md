# NCMS — Nigerian Cooperative Management System

A multi-tenant SaaS platform that digitizes and automates Nigerian cooperative societies: member onboarding, savings, loans, accounting, meetings, communications, reporting, mobile access, and AI-powered insights.

See [`docs/PRD.md`](docs/PRD.md), [`docs/SDD.md`](docs/SDD.md), [`docs/ROADMAP.md`](docs/ROADMAP.md), and [`docs/PLAYBOOK.md`](docs/PLAYBOOK.md) for the product, architecture, roadmap, and sprint plan.

## Status

- **Sprint 0 (project setup):** done.
- **Sprint 1 (Authentication & RBAC):** done. Registration, login, JWT access/refresh tokens with rotation, password reset, TOTP-based MFA, and role-based access control, with a matching Next.js UI (login, register, dashboard, MFA management, forgot/reset password).
- **Sprint 2 (Cooperative Management):** done. Cooperative creation (creator becomes `COOPERATIVE_ADMIN`), branches, committees with membership, per-cooperative membership with roles/status/category, by-laws and financial-year settings, and cooperative-scoped RBAC, with a matching Next.js UI (cooperative list/create/detail pages).

See the Playbook for the remaining sprint sequence, starting with Sprint 3 (Member Management).

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

All routes require a valid JWT except the ones above marked public by design (register, login, refresh, forgot/reset password). Use `@Roles(...)` + the global `RolesGuard` to restrict a route to specific platform-wide roles.

## Cooperatives API

| Endpoint | Description |
| --- | --- |
| `POST /cooperatives` | Create a cooperative; creator becomes its `COOPERATIVE_ADMIN` |
| `GET /cooperatives` | List cooperatives the caller belongs to (all, for `SUPER_ADMIN`) |
| `GET /cooperatives/:id` | Get a cooperative (any active member) |
| `PATCH /cooperatives/:id` | Update settings, by-laws, financial year (`COOPERATIVE_ADMIN`/`CHAIRMAN`) |
| `POST\|GET /cooperatives/:id/branches` | Create/list branches |
| `PATCH\|DELETE /cooperatives/:id/branches/:branchId` | Update/remove a branch |
| `POST\|GET /cooperatives/:id/committees` | Create/list committees |
| `POST\|DELETE /cooperatives/:id/committees/:committeeId/members` | Add/remove a committee member (by email; must already be a cooperative member) |
| `POST\|GET /cooperatives/:id/members` | Add/list cooperative members (by email, with role/category) |
| `PATCH\|DELETE /cooperatives/:id/members/:userId` | Update a member's role/status, or remove them |

Cooperative-scoped RBAC is enforced by `@CooperativeRoles(...)` + `CooperativeRolesGuard`, which checks the caller's `CooperativeMembership.role` for the cooperative in the `:id` route param (a platform `SUPER_ADMIN` bypasses this check).

## CI

GitHub Actions (`.github/workflows/ci.yml`) lints, builds, and tests both `backend` and `frontend` on every push and pull request to `main`. The backend job runs against a real Postgres service container so the auth e2e suite exercises the full stack.
