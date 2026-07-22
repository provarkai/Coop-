# NCMS — Nigerian Cooperative Management System

A multi-tenant SaaS platform that digitizes and automates Nigerian cooperative societies: member onboarding, savings, loans, accounting, meetings, communications, reporting, mobile access, and AI-powered insights.

See [`docs/PRD.md`](docs/PRD.md), [`docs/SDD.md`](docs/SDD.md), [`docs/ROADMAP.md`](docs/ROADMAP.md), and [`docs/PLAYBOOK.md`](docs/PLAYBOOK.md) for the product, architecture, roadmap, and sprint plan.

## Status

- **Sprint 0 (project setup):** done.
- **Sprint 1 (Authentication & RBAC):** done. Registration, login, JWT access/refresh tokens with rotation, password reset, TOTP-based MFA, and role-based access control, with a matching Next.js UI (login, register, dashboard, MFA management, forgot/reset password).
- **Sprint 2 (Cooperative Management):** done. Cooperative creation (creator becomes `COOPERATIVE_ADMIN`), branches, committees with membership, per-cooperative membership with roles/status/category, by-laws and financial-year settings, and cooperative-scoped RBAC, with a matching Next.js UI (cooperative list/create/detail pages).
- **Sprint 3 (Member Management):** done. Self-service membership applications with admin approval/rejection (auto-assigning a membership number), KYC profile fields (DOB, gender, phone, address, BVN, NIN), guarantor nomination with guarantor-side confirmation, beneficiaries, a digital membership card with a QR code, and an audit log of membership lifecycle events — with a matching Next.js UI (profile page, join-by-invite-link flow, pending-applications approval, member detail page with card/guarantors/beneficiaries, audit log view).
- **Regulatory compliance (out-of-sequence addition):** done. A platform-wide `REGULATOR` role with read-only, cross-cooperative oversight (no membership required), plus a compliance-filing workflow — cooperatives submit filings (annual return, financial statement, AGM minutes, etc.), regulators review and approve/reject them. Includes a `SUPER_ADMIN`-only endpoint to promote a user's platform role (needed to bootstrap the first regulator) and a matching Next.js UI (regulator dashboard, admin user-role management, compliance-filings section on the cooperative page).
- **Sprint 4 (Savings Engine):** done. Configurable savings products (interest rate, minimum balance), per-member savings accounts opened by governance/treasurer, deposit/withdrawal recording with minimum-balance enforcement, simple-interest accrual, account statements, and a QR-coded transaction receipt — with a matching Next.js UI (savings products, a self-service "My savings" view, and a governance-facing savings-accounts ledger on the cooperative page).
- **Sprint 5 (Loan Management):** done. Configurable loan products (rate, max amount/term, penalty rate, required guarantor count); self-service loan applications; per-loan guarantor nomination and guarantor sign-off (with a dedicated endpoint so a nominated guarantor can discover and act on their own pending requests); governance approval (gated on enough approved guarantors) and rejection; disbursement that generates an equal-installment repayment schedule; repayment recording that allocates oldest-installment-first and completes the loan once paid off; and late-payment penalty assessment on overdue installments — with a matching Next.js UI (loan products, a self-service "My loans" + application form, a "Guarantor requests" inbox, and a governance-facing loan ledger with approve/reject/disburse/repay/penalize actions and schedule/ledger drill-down).

See the Playbook for the remaining sprint sequence, starting with Sprint 6 (Payments).

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

## Member Management API

| Endpoint | Description |
| --- | --- |
| `GET /cooperatives/:id/preview` | Cooperative name/slug only, visible to non-members (used by the join flow) |
| `POST /cooperatives/:id/apply` | Apply for membership as `PENDING` |
| `POST /cooperatives/:id/members/:userId/approve` \| `/reject` | Governance-only; approving assigns a membership number |
| `GET /cooperatives/:id/members/:userId/card` | Digital membership card + QR code (self or governance) |
| `POST\|GET /cooperatives/:id/members/:userId/guarantors` | Nominate/list guarantors (self or governance) |
| `PATCH /cooperatives/:id/guarantors/:guarantorId/respond` | Only the nominated guarantor can approve/decline |
| `DELETE /cooperatives/:id/members/:userId/guarantors/:guarantorId` | Remove a guarantor nomination |
| `POST\|GET\|PATCH\|DELETE /cooperatives/:id/members/:userId/beneficiaries` | Beneficiary CRUD (self or governance) |
| `GET /cooperatives/:id/audit-logs` | Membership lifecycle audit trail (`COOPERATIVE_ADMIN`/`CHAIRMAN`/`AUDITOR`) |
| `GET\|PATCH /users/me` | View/update the caller's own KYC profile (DOB, gender, phone, address, BVN, NIN) |

## Regulatory Compliance API

| Endpoint | Description |
| --- | --- |
| `GET /users` \| `PATCH /users/:id/role` | `SUPER_ADMIN`-only: list platform users and change a user's platform role |
| `POST /cooperatives/:id/compliance-filings` | Submit a filing (`COOPERATIVE_ADMIN`/`CHAIRMAN`) |
| `GET /cooperatives/:id/compliance-filings` | List a cooperative's own filings (any active member) |
| `GET /compliance/cooperatives` | Cross-tenant list of all cooperatives (`REGULATOR`/`SUPER_ADMIN`) |
| `GET /compliance/filings` | Cross-tenant list of all filings, optional `?status=` filter (`REGULATOR`/`SUPER_ADMIN`) |
| `GET /compliance/filings/:id` | Filing detail |
| `PATCH /compliance/filings/:id/review` | Approve/reject a filing (can't re-review one already decided) |

**Bootstrapping:** there's no admin yet to grant the first `SUPER_ADMIN`, so it must be set directly in the database (`UPDATE "User" SET role = 'SUPER_ADMIN' WHERE email = '...'`). From then on, use `PATCH /users/:id/role` (or the "Manage user roles" page) to promote further admins or regulators. Role changes are embedded in the JWT at login, so a promoted user must log in again before the new role takes effect.

## Savings API

| Endpoint | Description |
| --- | --- |
| `POST\|GET /cooperatives/:id/savings/products` | Create/list savings products (create is `COOPERATIVE_ADMIN`/`CHAIRMAN`/`TREASURER`; list is any active member) |
| `PATCH /cooperatives/:id/savings/products/:productId` | Update a product's name, rate, minimum balance, or active flag |
| `POST\|GET /cooperatives/:id/members/:userId/savings/accounts` | Open/list a member's savings accounts (open is governance/treasurer; list is self or governance/treasurer/auditor) |
| `GET /cooperatives/:id/savings/accounts` | Cooperative-wide account ledger (`COOPERATIVE_ADMIN`/`CHAIRMAN`/`TREASURER`/`AUDITOR`) |
| `POST\|GET /cooperatives/:id/savings/accounts/:accountId/transactions` | Record a deposit/withdrawal (governance/treasurer; withdrawals can't breach the product minimum balance) or list the account statement (self or governance/treasurer/auditor) |
| `POST /cooperatives/:id/savings/accounts/:accountId/accrue-interest` | Post simple interest since the last accrual (governance/treasurer) |
| `GET /cooperatives/:id/savings/accounts/:accountId/transactions/:transactionId/receipt` | QR-coded transaction receipt (self or governance/treasurer/auditor) |

## Loans API

| Endpoint | Description |
| --- | --- |
| `POST\|GET /cooperatives/:id/loan-products` | Create/list loan products (create is `COOPERATIVE_ADMIN`/`CHAIRMAN`/`LOAN_OFFICER`; list is any active member) |
| `PATCH /cooperatives/:id/loan-products/:productId` | Update a product's rate, max amount/term, penalty rate, required guarantors, or active flag |
| `POST /cooperatives/:id/loans` | Apply for a loan (self-service; validated against the product's max amount/term) |
| `GET /cooperatives/:id/loans` | Cooperative-wide loan ledger (`COOPERATIVE_ADMIN`/`CHAIRMAN`/`LOAN_OFFICER`/`TREASURER`/`AUDITOR`) |
| `GET /cooperatives/:id/members/:userId/loans` | A member's own loans (self or governance/loan officer/treasurer/auditor) |
| `GET /cooperatives/:id/loans/:loanId` | Loan detail with guarantors, repayment schedule, and ledger (self, a nominated guarantor, or governance/loan officer/treasurer/auditor) |
| `POST\|GET /cooperatives/:id/loans/:loanId/guarantors` | Nominate (borrower only, while `PENDING`) or list a loan's guarantors |
| `GET /cooperatives/:id/loan-guarantor-requests` | The caller's own pending/decided guarantor requests across the cooperative |
| `PATCH /cooperatives/:id/loans/:loanId/guarantors/:guarantorId/respond` | Only the nominated guarantor can approve/decline |
| `POST /cooperatives/:id/loans/:loanId/approve` | Approve a `PENDING` loan (requires enough `APPROVED` guarantors) |
| `POST /cooperatives/:id/loans/:loanId/reject` | Reject a `PENDING` loan |
| `POST /cooperatives/:id/loans/:loanId/disburse` | Disburse an `APPROVED` loan; generates an equal-installment repayment schedule |
| `POST /cooperatives/:id/loans/:loanId/repayments` | Record a repayment; allocates oldest-installment-first and completes the loan once paid off |
| `POST /cooperatives/:id/loans/:loanId/assess-penalty` | Charge a penalty on newly overdue installments |

## CI

GitHub Actions (`.github/workflows/ci.yml`) lints, builds, and tests both `backend` and `frontend` on every push and pull request to `main`. The backend job runs against a real Postgres service container so the auth e2e suite exercises the full stack.
