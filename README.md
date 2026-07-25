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
- **Sprint 6 (Payments):** done. Originally shipped as a simulated payment gateway; **upgraded to real money via Paystack** (see the out-of-sequence addition below and the Payments API section) — a member initiates a payment against their own savings account or active loan and is redirected to a real Paystack checkout, which settles via webhook, applying the deposit/repayment automatically on success or leaving the ledger untouched on failure. Includes cooperative-wide reconciliation (filterable by status) and per-member transaction history — with a matching Next.js UI ("Make a payment", "My payments", and a governance-facing reconciliation ledger).
- **Sprint 7 (Accounting):** done. A double-entry ledger — a per-cooperative chart of accounts (auto-seeded with cash, member savings, loans receivable, interest/penalty income, and savings interest expense), manual journal entries (must balance debits and credits), and automatic postings from savings and loan activity (deposits/withdrawals/interest against cash and member savings; disbursements against loans receivable; repayments split into principal and interest portions; penalties against penalty income) so the books stay in sync with the rest of the app without extra data entry. Includes trial balance, income statement, and balance sheet reports, plus simple per-account/period budgeting with variance reporting — with a matching Next.js UI (chart of accounts, journal entries with a manual-entry form, trial balance, income statement, balance sheet, and budgets).
- **Sprint 8 (Meetings & Governance):** done. Meeting scheduling (AGM/board/committee/special) with an ordered agenda, auto-inviting every active member as an attendee; self-service RSVP and governance-recorded attendance; member-proposed resolutions (optionally tied to an agenda item) with one vote per member (FOR/AGAINST/ABSTAIN, changeable while open), governance tallying on close (FOR > AGAINST passes, ties and everything else reject), and withdrawal by the proposer or governance; meeting minutes recording, which marks the meeting COMPLETED — with a matching Next.js UI. All meeting times are entered and displayed in West Africa Time (WAT, UTC+1, Nigeria has no DST) regardless of the viewer's own timezone.
- **Sprint 9 (Documents & Communication):** done. A per-cooperative document repository (arbitrary files uploaded and stored as bytes with metadata — title, category, uploader — download returns the exact original bytes with the right filename/content-type); real, on-demand-generated PDFs for the membership card and meeting minutes (no external service — rendered server-side with `pdfkit`); and a multi-channel notification log (email/SMS/WhatsApp/push) for governance announcements broadcast to every active member, plus an automatic (simulated) email notice to every invited member when a meeting is scheduled. Email/SMS/WhatsApp/push sends are **simulated** — no real provider credentials, every attempt is just logged as `SENT` — with a matching Next.js UI (document upload/list/download/delete, an announcement composer, a personal notification log, and "Download PDF" buttons on the membership card and meeting detail views).
- **Sprint 10 (Reports & Dashboards):** done. An executive KPI dashboard (active members, pending applications, total savings, outstanding loans, this-month loan disbursements/payments, upcoming meetings, open resolutions, cash balance, income/expense/net surplus) and 6-month trend analytics (new members, savings net, loan disbursed/repaid), all computed on demand from existing data — nothing new persisted. CSV exports for members, savings transactions, loans, and journal entries. A monthly digest report — a real generated PDF, stored via the Sprint 9 document repository under a new `REPORT` category, with a (simulated) email notice to every active member — runs automatically on a schedule (`@nestjs/schedule`, 1st of the month) and can also be triggered on demand by governance. Matching Next.js UI: KPI tiles, small trend charts, CSV export buttons, and a "Generate report now" button. The cooperative detail page also gained a persistent left sidebar (Dashboard, Settings, Members, Savings, Loans, Payments, Accounting, Meetings, Documents & Comms, AI Assistant, Compliance, Audit log) and the dashboard now renders at the top of the page for one-click access.
- **Sprint 11 (Mobile Apps):** done. A Flutter app (`mobile/`) for members and administrators, talking to the same NestJS API as the web app: JWT login/registration with platform-secure token storage (Keystore/Keychain on device) and transparent refresh-on-401; a cooperative picker; a role-aware dashboard (governance sees the Sprint 10 KPI tiles, plain members see a simpler summary — the same "try the governance endpoint, fall back on 403" pattern the web app uses); savings accounts and transaction history; loan applications plus governance approve/reject/disburse; meeting list and RSVP; a Members tab for governance to approve/reject pending applications; and a Notifications tab exercising the Sprint 9 simulated multi-channel log — governance can send a simulated announcement (email/SMS/WhatsApp/push) and everyone can see their own notification history, same as the web app. Distribution (Google Play/App Store listing, signing, release tracks) is intentionally out of scope for now — the app is built and tested locally against a real backend; see [`mobile/README.md`](mobile/README.md) for how to run it and why. Widget tests cover the login/MFA/session-restore flows against a mocked backend (`package:http/testing.dart`); `flutter analyze` is clean.
- **Sprint 12 (AI Features):** done. Real LLM features via [OpenRouter](https://openrouter.ai) (model configurable via `OPENROUTER_MODEL`, defaults to `anthropic/claude-haiku-4.5`): an AI assistant any active member can ask about their own savings/loans/upcoming meetings; any exco role additionally gets the same cooperative-wide KPI numbers the dashboard shows them (active members, total savings/outstanding loans, cash balance, income statement) folded into the assistant's context, so it can answer questions about the whole cooperative, not just their own membership; AI-generated meeting summaries (persisted on `Meeting.aiSummary`, since regenerating costs a real LLM call); and AI-authored management commentary woven into the Sprint 10 monthly PDF report. Loan risk scoring and fraud-signal detection are deterministic, rule-based, and fully unit-testable (loan-to-savings ratio, membership tenure, historical overdue installments, and request-vs-product-max drive the risk score; large/anomalous transactions and rapid deposit-then-withdrawal round-trips drive fraud flags) — the risk score additionally gets a short AI-authored plain-language explanation. Matching Next.js UI: an AI Assistant section, a "Summarize with AI" button on meetings, a "Check risk score" button on loans (governance), and a fraud-alerts panel on the dashboard (any exco role).

- **Sprint 13 (Hardening):** done. Security: [Helmet](https://helmetjs.github.io/) security headers on every response; rate limiting (`@nestjs/throttler`) on all routes (600 req/min per IP default — sized so a single cooperative page's dozen-plus parallel API calls never trips it) with a tighter limit (10 req/min) on brute-force-sensitive auth routes (login, register, forgot/reset password, MFA enable/disable), automatically disabled under the Jest test runner so the e2e suite isn't throttled, and trusting the first proxy hop (`app.set('trust proxy', 1)`) so it keys on the real client IP behind Railway's edge; safety caps on the two genuinely platform-wide (not cooperative-scoped) unbounded queries (list-all-users, list-all-cooperatives-for-compliance). **Bug fix:** the document-upload endpoint accepted up to ~7.5MB of base64 content per its DTO, but Express's default JSON body-parser limit is 100kb — any upload over roughly 75KB decoded would have failed silently; raised to 10MB. `npm audit`: backend is clean; the frontend's only findings are a transitive `postcss`/`sharp` pair bundled *inside* Next.js's own build tooling (not exposed to runtime request handling) with no non-preview Next.js release fixing them yet — tracked as an accepted risk pending a stable upstream release. Load testing (`autocannon`) confirmed sub-10ms median latency on the KPI dashboard endpoint under concurrent load, and confirmed the rate limiter enforces its configured cap exactly (verified against both the local dev server and the live Railway deployment). Accessibility: `aria-label`s added to the primary authentication entry flows (login, register, forgot/reset password, MFA, create-cooperative) whose inputs previously relied on placeholder text alone; a broader form-by-form audit remains follow-up work.
- **Sprint 14 (Deployment & Go-Live):** done. A `GET /health` endpoint (checks database connectivity, exempt from rate limiting) for Railway's health check and external uptime monitors. An idempotent pilot-cooperative seed script (`backend/prisma/seed.ts`, run via `npx prisma db seed`) so a fresh deployment has a demo cooperative and admin login to explore rather than an empty database. New [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) (production readiness checklist: env vars, migrations, seeding, health checks, hardening summary, pre-go-live steps) and [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) (a role-by-role walkthrough of every feature). Tagged **v1.0.0** — see [`CHANGELOG.md`](CHANGELOG.md) for the full release history.
- **Cooperative profile, logo, and post-login redirect (out-of-sequence addition):** done. `Cooperative` now has a `logo`/`logoMimeType` (uploaded via `PATCH /cooperatives/:id/logo`, base64 like document uploads, fetched via `GET /cooperatives/:id/logo`, no membership required so it displays pre-join too), and the Settings tab exposes the full profile (name, state, registration number, email, phone, address, by-laws, logo) rather than just by-laws/financial year. Every general cooperative read (list, detail, update) explicitly excludes the logo bytes from its response so listing cooperatives never balloons with binary data — only the dedicated logo endpoint fetches them. Login now skips the generic account hub when it can: a member/admin belonging to exactly one cooperative lands straight on that cooperative's Dashboard tab; `SUPER_ADMIN`/`REGULATOR` and anyone with zero or multiple cooperatives still land on `/dashboard`.
- **Cooperative page: dashboard-first navigation (out-of-sequence addition):** done. The cooperative detail page's sidebar (Dashboard, Settings, Members, Savings, Loans, Payments, Accounting, Meetings, Documents & Comms, AI Assistant, Compliance, Audit log) now switches between sections instead of just jumping to an anchor on one long scrolling page — only the Dashboard/report renders by default, and every other section only appears once its sidebar entry is clicked, keeping each cooperative's admin/member experience focused rather than a wall of every module at once.
- **Real payments via Paystack (out-of-sequence addition):** done. Sprint 6's simulated gateway is replaced with a real [Paystack](https://paystack.com) integration: each cooperative connects its own bank account (`POST /cooperatives/:id/payments/bank-account`, governance-only — resolves the account name and creates a Paystack subaccount), and every payment settles straight to that subaccount (a Paystack "split" destination, `percentage_charge: 0`) — the platform never custodies member funds. Initiating a payment now returns a real Paystack checkout `authorizationUrl`; a signed webhook (`POST /payments/webhook/paystack`, HMAC-SHA512-verified) credits the ledger on `charge.success`, with an atomic claim-before-crediting step so a retried webhook delivery can never double-credit. A manual `verify` endpoint covers the case where the webhook hasn't landed yet by the time the payer's browser returns from checkout. A cooperative with no connected bank account cannot accept payments at all. Matching Next.js UI: a Settings-tab "Connect a bank account" form (bank dropdown + account number, verified live against Paystack), a real checkout redirect in place of the old simulate buttons, and a `/payments/callback` return page.
- **Regulator-scoped cooperative onboarding (out-of-sequence addition):** done. Cooperative creation is now `SUPER_ADMIN`-only — reflecting how cooperative registration actually works in Nigeria: a `Cooperative` has a `state`, the platform team creates it on a regulator's request (per the Nigerian Co-operative Societies Act's registration process), naming an already-registered user as its `initialAdminEmail`/`COOPERATIVE_ADMIN` rather than the `SUPER_ADMIN` caller. A new `RegulatorAssignment` model (cooperative ↔ regulator, by location) scopes a regulator's access to only their assigned cooperatives — everywhere a `REGULATOR` previously had blanket cross-cooperative read access (cooperative detail, documents, meetings, savings, loans, AI assistant, compliance filings) now checks assignment instead; `SUPER_ADMIN` stays unscoped. Regulators get two new read-only endpoints per assigned cooperative — financial standing (the same KPI dashboard governance sees) and meetings — plus assignment-management endpoints for `SUPER_ADMIN`. Matching Next.js UI: a `SUPER_ADMIN`-only cooperative registration form, the self-service "+ New" button removed for everyone else, and the regulator dashboard redesigned into collapsed per-cooperative cards (member/filing counts) that expand on click into financial standing, meetings, and (`SUPER_ADMIN`) an inline regulator-assignment manager.

This is **v1.0.0** plus the regulator-scoped onboarding model described above. Every Playbook sprint is complete, including Sprint 11 (Mobile Apps).

## Structure

```
backend/   NestJS API (PostgreSQL via Prisma)
frontend/  Next.js web app (App Router, TypeScript, Tailwind)
mobile/    Flutter app for members and administrators
docs/      Product, design, roadmap, and playbook documents
```

## Tech Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS
- **Backend:** NestJS, TypeScript
- **Database:** PostgreSQL (via Prisma)
- **Cache:** Redis
- **Mobile:** Flutter (`mobile/`)

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
npx prisma db seed   # optional: creates a demo cooperative + admin login
npm run start:dev
```
Runs at `http://localhost:3001`. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the production checklist and [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) for a feature walkthrough.

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
| `POST /cooperatives` | Register a cooperative (`SUPER_ADMIN`-only): takes `name`, `slug`, `state`, `initialAdminEmail` (an already-registered user, who becomes `COOPERATIVE_ADMIN` — not the `SUPER_ADMIN` caller), optional `regulatorEmail` (immediately assigns that regulator) |
| `GET /cooperatives` | List cooperatives the caller belongs to (all, for `SUPER_ADMIN`) |
| `GET /cooperatives/:id` | Get a cooperative (any active member) |
| `PATCH /cooperatives/:id` | Update profile (name, state, registration number, email, phone, address, by-laws, financial year) (`COOPERATIVE_ADMIN`/`CHAIRMAN`) |
| `GET /cooperatives/:id/logo` | Fetch the cooperative's logo image bytes (any authenticated user, no membership required) |
| `PATCH /cooperatives/:id/logo` | Upload/replace the logo — base64 `contentBase64` + `mimeType`, same convention as document uploads (`COOPERATIVE_ADMIN`/`CHAIRMAN`) |
| `POST\|GET /cooperatives/:id/branches` | Create/list branches |
| `PATCH\|DELETE /cooperatives/:id/branches/:branchId` | Update/remove a branch |
| `POST\|GET /cooperatives/:id/committees` | Create/list committees |
| `POST\|DELETE /cooperatives/:id/committees/:committeeId/members` | Add/remove a committee member (by email; must already be a cooperative member) |
| `POST\|GET /cooperatives/:id/members` | Add/list cooperative members (by email, with role/category) |
| `PATCH\|DELETE /cooperatives/:id/members/:userId` | Update a member's role/status, or remove them |

Cooperative-scoped RBAC is enforced by `@CooperativeRoles(...)` + `CooperativeRolesGuard`, which checks the caller's `CooperativeMembership.role` for the cooperative in the `:id` route param (a platform `SUPER_ADMIN` bypasses this check).

### Cooperative roles: exco read access vs. major-exco privileges

Every non-`MEMBER` cooperative role (`COMMITTEE_MEMBER`, `LOAN_OFFICER`, `AUDITOR`, `TREASURER`, `SECRETARY`, `CHAIRMAN`, `COOPERATIVE_ADMIN` — collectively "exco" here, defined as `EXCO_ROLES` in `backend/src/cooperatives/roles.constants.ts`) has **at least read access** to every governance section: the KPI dashboard, cooperative-wide savings/loans/payments ledgers, the chart of accounts and financial statements, and the audit log/fraud alerts. A plain `MEMBER` gets none of that — only their own data.

Write/manage actions stay restricted to the narrower, function-specific role lists that already existed (e.g. only `TREASURER` + `CHAIRMAN`/`COOPERATIVE_ADMIN` can manage savings; only `LOAN_OFFICER` + `CHAIRMAN`/`COOPERATIVE_ADMIN` can approve loans) — read access being broader than write access doesn't change who can actually take an action. `CHAIRMAN` and `COOPERATIVE_ADMIN` ("major exco") are the only two roles with a manage permission in *every* module, including the ability to change another member's role or status (`PATCH /cooperatives/:id/members/:userId`, `MANAGE_COOPERATIVE_ROLES`) — i.e. only major exco can promote/demote other exco members.

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
| `GET /compliance/cooperatives` | List cooperatives (`REGULATOR`/`SUPER_ADMIN`) — a `REGULATOR` only sees cooperatives assigned to them via `RegulatorAssignment`; `SUPER_ADMIN` sees every cooperative |
| `GET /compliance/filings` | List filings, optional `?status=` filter — same assignment scoping as above |
| `GET /compliance/filings/:id` | Filing detail (403 if the caller is a `REGULATOR` not assigned to that filing's cooperative) |
| `PATCH /compliance/filings/:id/review` | Approve/reject a filing (can't re-review one already decided; same assignment scoping) |
| `GET /compliance/cooperatives/:id/financial-standing` | The same KPI dashboard governance sees (`REGULATOR` must be assigned; `SUPER_ADMIN` unrestricted) |
| `GET /compliance/cooperatives/:id/meetings` | A cooperative's meetings (same access rule) |
| `GET /compliance/cooperatives/:id/assignments` | List regulators assigned to a cooperative (`SUPER_ADMIN`-only) |
| `POST /compliance/assignments` | Assign a regulator to a cooperative by email (`SUPER_ADMIN`-only); the target user must already have the `REGULATOR` or `SUPER_ADMIN` platform role |
| `DELETE /compliance/assignments/:id` | Remove a regulator assignment (`SUPER_ADMIN`-only) |

**Bootstrapping:** there's no admin yet to grant the first `SUPER_ADMIN`, so it must be set directly in the database (`UPDATE "User" SET role = 'SUPER_ADMIN' WHERE email = '...'`). From then on, use `PATCH /users/:id/role` (or the "Manage user roles" page) to promote further admins or regulators. Role changes are embedded in the JWT at login, so a promoted user must log in again before the new role takes effect.

**Regulator scoping:** every other read endpoint a `REGULATOR` can reach cooperative-scoped data through (`GET /cooperatives/:id`, documents, meetings, savings, loans, the AI assistant) applies the same `RegulatorAssignment` check as above — a `REGULATOR` who isn't assigned to a cooperative gets a `403` even though the route itself doesn't live under `/compliance`. `SUPER_ADMIN` bypasses this check everywhere.

## Savings API

| Endpoint | Description |
| --- | --- |
| `POST\|GET /cooperatives/:id/savings/products` | Create/list savings products (create is `COOPERATIVE_ADMIN`/`CHAIRMAN`/`TREASURER`; list is any active member) |
| `PATCH /cooperatives/:id/savings/products/:productId` | Update a product's name, rate, minimum balance, or active flag |
| `POST\|GET /cooperatives/:id/members/:userId/savings/accounts` | Open/list a member's savings accounts (open is governance/treasurer; list is self or governance/treasurer/auditor) |
| `GET /cooperatives/:id/savings/accounts` | Cooperative-wide account ledger (any exco role -- read access, see below) |
| `POST\|GET /cooperatives/:id/savings/accounts/:accountId/transactions` | Record a deposit/withdrawal (governance/treasurer; withdrawals can't breach the product minimum balance) or list the account statement (self or any exco role) |
| `POST /cooperatives/:id/savings/accounts/:accountId/accrue-interest` | Post simple interest since the last accrual (governance/treasurer) |
| `GET /cooperatives/:id/savings/accounts/:accountId/transactions/:transactionId/receipt` | QR-coded transaction receipt (self or any exco role) |

## Loans API

| Endpoint | Description |
| --- | --- |
| `POST\|GET /cooperatives/:id/loan-products` | Create/list loan products (create is `COOPERATIVE_ADMIN`/`CHAIRMAN`/`LOAN_OFFICER`; list is any active member) |
| `PATCH /cooperatives/:id/loan-products/:productId` | Update a product's rate, max amount/term, penalty rate, required guarantors, or active flag |
| `POST /cooperatives/:id/loans` | Apply for a loan (self-service; validated against the product's max amount/term) |
| `GET /cooperatives/:id/loans` | Cooperative-wide loan ledger (any exco role) |
| `GET /cooperatives/:id/members/:userId/loans` | A member's own loans (self or any exco role) |
| `GET /cooperatives/:id/loans/:loanId` | Loan detail with guarantors, repayment schedule, and ledger (self, a nominated guarantor, or any exco role) |
| `POST\|GET /cooperatives/:id/loans/:loanId/guarantors` | Nominate (borrower only, while `PENDING`) or list a loan's guarantors |
| `GET /cooperatives/:id/loan-guarantor-requests` | The caller's own pending/decided guarantor requests across the cooperative |
| `PATCH /cooperatives/:id/loans/:loanId/guarantors/:guarantorId/respond` | Only the nominated guarantor can approve/decline |
| `POST /cooperatives/:id/loans/:loanId/approve` | Approve a `PENDING` loan (requires enough `APPROVED` guarantors) |
| `POST /cooperatives/:id/loans/:loanId/reject` | Reject a `PENDING` loan |
| `POST /cooperatives/:id/loans/:loanId/disburse` | Disburse an `APPROVED` loan; generates an equal-installment repayment schedule |
| `POST /cooperatives/:id/loans/:loanId/repayments` | Record a repayment; allocates oldest-installment-first and completes the loan once paid off |
| `POST /cooperatives/:id/loans/:loanId/assess-penalty` | Charge a penalty on newly overdue installments |

## Payments API

Real money, via [Paystack](https://paystack.com) — requires `PAYSTACK_SECRET_KEY` (see `backend/.env.example`). Each cooperative settles straight to its own bank account through a Paystack **subaccount** (a "split" destination); the platform never custodies member funds and takes no cut (`percentage_charge: 0`). A cooperative with no connected subaccount cannot accept payments.

| Endpoint | Description |
| --- | --- |
| `GET /cooperatives/payments/banks` | List Nigerian banks for the connect-bank-account form (any authenticated user) |
| `GET /cooperatives/:id/payments/bank-account` | Whether this cooperative has connected a bank account, and its details (any authenticated user — the cooperative's own bank details, not a member's private data) |
| `POST /cooperatives/:id/payments/bank-account` | Connect a bank account: resolves the account name via Paystack, creates a subaccount (`COOPERATIVE_ADMIN`/`CHAIRMAN`/`TREASURER`) |
| `POST /cooperatives/:id/payments` | Initiate a payment against the caller's own savings account or active loan (self-service); returns a Paystack `authorizationUrl` to redirect the payer to checkout |
| `GET /cooperatives/:id/payments` | Cooperative-wide reconciliation ledger, optional `?status=` filter (any exco role) |
| `GET /cooperatives/:id/members/:userId/payments` | A member's own payment history (self or any exco role) |
| `GET /cooperatives/:id/payments/:paymentId` | Payment detail (self or any exco role) |
| `POST /cooperatives/:id/payments/:paymentId/verify` | Force a live Paystack verify of an `INITIATED` payment (self or any exco role) — a belt-and-braces check for the checkout-return page in case the webhook hasn't landed yet |
| `POST /payments/webhook/paystack` | Paystack's webhook (public, HMAC-SHA512-signature-verified, not JWT-authenticated) — `charge.success` credits the savings deposit or loan repayment, `charge.failed` leaves the ledger untouched. Idempotent: the payment row is atomically claimed (`INITIATED` → `SUCCESS`/`FAILED`) before crediting, so a retried webhook delivery racing a manual verify can never double-credit |

## Accounting API

Restricted to exco roles — there's no member self-service view, since this is the cooperative's books rather than an individual's data. `GET` routes are any exco role (read access, see below); posting routes (`POST /accounting/accounts`, `/journal-entries`, `/budgets`) stay restricted to `COOPERATIVE_ADMIN`/`CHAIRMAN`/`TREASURER`.

| Endpoint | Description |
| --- | --- |
| `GET /cooperatives/:id/accounting/accounts` | Chart of accounts; auto-seeds the default system accounts (cash, member savings, loans receivable, interest/penalty income, savings interest expense) on first access |
| `POST /cooperatives/:id/accounting/accounts` | Add a custom account (code, name, type) |
| `POST /cooperatives/:id/accounting/journal-entries` | Post a manual journal entry — 2+ lines, must balance (sum of debits = sum of credits) |
| `GET /cooperatives/:id/accounting/journal-entries` | List journal entries, optional `?accountId=` filter; includes auto-posted entries from savings/loan activity |
| `GET /cooperatives/:id/accounting/trial-balance` | Per-account debit/credit totals and balance |
| `GET /cooperatives/:id/accounting/income-statement` | Income vs expense and net surplus |
| `GET /cooperatives/:id/accounting/balance-sheet` | Assets, liabilities, and equity |
| `POST\|GET /cooperatives/:id/accounting/budgets` | Set a per-account/period planned amount, or list budgets (optional `?period=`) with actual and variance |

Savings deposits/withdrawals/interest and loan disbursements/repayments/penalties are posted automatically (see `AccountingService.postSavings*`/`postLoan*` in `backend/src/accounting/accounting.service.ts`) — no manual bookkeeping needed for activity that happens elsewhere in the app.

## Meetings & Governance API

Scheduling, updating, recording minutes, and recording another member's attendance are restricted to `COOPERATIVE_ADMIN`/`CHAIRMAN`/`SECRETARY`. Viewing, RSVPing, proposing resolutions, and voting are open to any active member (self-service). Withdrawing a resolution is allowed for its proposer or governance. All `scheduledAt` values are ISO 8601 UTC instants over the wire; the frontend converts to/from West Africa Time (WAT, UTC+1) for entry and display.

| Endpoint | Description |
| --- | --- |
| `POST /cooperatives/:id/meetings` | Schedule a meeting (title, type, `scheduledAt`, location, optional ordered agenda items); auto-invites every active member as an `INVITED` attendee |
| `GET /cooperatives/:id/meetings` | List meetings for the cooperative (any active member) |
| `GET /cooperatives/:id/meetings/:meetingId` | Meeting detail with agenda, attendance, and resolutions (any active member) |
| `PATCH /cooperatives/:id/meetings/:meetingId` | Update title/type/`scheduledAt`/location/status |
| `POST /cooperatives/:id/meetings/:meetingId/minutes` | Record minutes; marks the meeting `COMPLETED` |
| `POST /cooperatives/:id/meetings/:meetingId/rsvp` | Self-service RSVP (`CONFIRMED`/`DECLINED`) |
| `GET /cooperatives/:id/meetings/:meetingId/attendance` | List attendance (any active member) |
| `POST /cooperatives/:id/meetings/:meetingId/attendance/:userId` | Record another member's attendance (`ATTENDED`/`ABSENT`/`EXCUSED`) |
| `POST /cooperatives/:id/meetings/:meetingId/resolutions` | Propose a resolution, optionally tied to an agenda item (any active member) |
| `GET /cooperatives/:id/meetings/:meetingId/resolutions` | List resolutions with vote tallies (any active member) |
| `POST /cooperatives/:id/meetings/:meetingId/resolutions/:resolutionId/vote` | Cast or change a vote (`FOR`/`AGAINST`/`ABSTAIN`) — one per active member while the resolution is `PROPOSED` |
| `POST /cooperatives/:id/meetings/:meetingId/resolutions/:resolutionId/close` | Tally votes and close — `FOR` > `AGAINST` passes, otherwise (including ties) rejects |
| `POST /cooperatives/:id/meetings/:meetingId/resolutions/:resolutionId/withdraw` | Withdraw a still-open resolution (proposer or governance) |
| `GET /cooperatives/:id/meetings/:meetingId/minutes.pdf` | Real, on-demand-generated PDF of the meeting (agenda, resolutions with vote tallies, minutes) — any active member |

## Documents & Communication API

Uploading and deleting documents, and sending announcements, are restricted to `COOPERATIVE_ADMIN`/`CHAIRMAN`/`SECRETARY`. Viewing/downloading documents and viewing one's own notification log are open to any active member. Email/SMS/WhatsApp/push are **simulated** — no real provider is called, every attempt is just recorded as `SENT`.

| Endpoint | Description |
| --- | --- |
| `POST /cooperatives/:id/documents` | Upload a document — JSON body with base64-encoded content (title, category, file name, MIME type) |
| `GET /cooperatives/:id/documents` | List document metadata (no content) for the cooperative (any active member) |
| `GET /cooperatives/:id/documents/:documentId` | Download the original file bytes with the correct `Content-Type`/`Content-Disposition` (any active member) |
| `DELETE /cooperatives/:id/documents/:documentId` | Delete a document |
| `GET /cooperatives/:id/members/:userId/card.pdf` | Real, on-demand-generated PDF of the digital membership card (self or governance) |
| `POST /cooperatives/:id/notifications/announcements` | Broadcast a message on a chosen channel (`EMAIL`/`SMS`/`WHATSAPP`/`PUSH`) to every active member (simulated send, logged as `SENT`) |
| `GET /cooperatives/:id/notifications` | List the requester's own received notifications |
| `GET /cooperatives/:id/notifications/all` | List every notification sent within the cooperative |

Scheduling a meeting automatically sends a simulated `EMAIL` notification to every invited member (see `MeetingsService.createMeeting` in `backend/src/meetings/meetings.service.ts`).

## Reports & Dashboards API

`GET` routes are any exco role (read access, see the roles section above) — there's no member self-service view, since this is cooperative-wide financial and operational data. Everything is computed on demand from existing tables; nothing new is persisted except the generated monthly report document itself.

| Endpoint | Description |
| --- | --- |
| `GET /cooperatives/:id/dashboard` | KPI summary: active members, pending applications, total savings balance, total outstanding loans, this-month loan disbursements/payments, upcoming meetings, open resolutions, cash balance, total income/expense, net surplus |
| `GET /cooperatives/:id/dashboard/trends?months=` | Month-over-month series (default 6, max 24): new members, savings net (deposits − withdrawals), loans disbursed, loans repaid |
| `GET /cooperatives/:id/exports/members.csv` | CSV export of all memberships |
| `GET /cooperatives/:id/exports/savings-transactions.csv` | CSV export of every savings transaction |
| `GET /cooperatives/:id/exports/loans.csv` | CSV export of every loan |
| `GET /cooperatives/:id/exports/journal-entries.csv` | CSV export of every journal line, one row per line |
| `POST /cooperatives/:id/reports/monthly-digest` | Generate a monthly report now: renders a PDF of the KPI summary, stores it in the Document repository (category `REPORT`), and sends a simulated `EMAIL` notice to every active member — restricted to `COOPERATIVE_ADMIN`/`CHAIRMAN`/`SECRETARY` |

The same monthly digest also runs automatically for every active cooperative on the 1st of each month (`@nestjs/schedule`, see `ReportsService.runScheduledMonthlyDigests` in `backend/src/reports/reports.service.ts`); the endpoint above triggers the identical logic on demand rather than waiting for the schedule.

## AI Features API

Requires `OPENROUTER_API_KEY` (see `backend/.env.example`) — an [OpenRouter](https://openrouter.ai) account and API key. Model is configurable via `OPENROUTER_MODEL` (defaults to `anthropic/claude-haiku-4.5`). The loan risk score and fraud-alert endpoints are deterministic/rule-based at their core (only the risk score's plain-language explanation is AI-authored) so they stay exact and unit-testable even though they call the LLM.

| Endpoint | Description |
| --- | --- |
| `POST /cooperatives/:id/ai/assistant` | Ask a question; answered from the requester's own membership/savings/loans/upcoming-meetings data (any active member), plus the cooperative-wide dashboard KPIs if the requester has any exco role |
| `POST /cooperatives/:id/meetings/:meetingId/summarize` | Generate and persist an AI summary of a meeting's agenda, resolutions, and minutes (`COOPERATIVE_ADMIN`/`CHAIRMAN`/`SECRETARY`) |
| `GET /cooperatives/:id/loans/:loanId/risk-score` | Deterministic 0–100 risk score and LOW/MEDIUM/HIGH rating (loan-to-savings ratio, membership tenure, historical overdue installments, request-vs-product-max), plus an AI-authored plain-language explanation (any exco role) |
| `GET /cooperatives/:id/fraud-alerts` | Deterministic scan of the last 30 days of savings transactions for unusually large transactions and rapid deposit-then-withdrawal round-trips (any exco role) |

## Kesa Module Suite API

Three modules from the "Kesa" product spec (Provark Global Services Ltd), each its own sidebar tab on the cooperative page. As with Payments, Kesa never touches real money or a real land registry: escrow funding just records an external trustee's reference/amount, and land verification/dispute notes are entered by a human, not fetched from a registry API. A new `LAND_DESK_OFFICER` cooperative role was added for the Land Banking desk; it's deliberately **not** part of `EXCO_ROLES` (unlike `LOAN_OFFICER`), so it doesn't get the blanket exco read access described above — it's scoped to its own function.

### Contribution Engine (Ajo/Esusu)

Managing groups/members/periods is restricted to `COOPERATIVE_ADMIN`/`CHAIRMAN`/`SECRETARY`/`TREASURER` (`MANAGE_GROUP_ROLES`); any active member can read groups, contributions, and trust scores they're party to.

| Endpoint | Description |
| --- | --- |
| `POST\|GET /cooperatives/:id/contribution-groups` | Create/list `ROTATING`/`TARGET` groups (name, coordinator, per-period amount, frequency, optional target amount) |
| `GET /cooperatives/:id/contribution-groups/:groupId` | Group detail with members |
| `POST /cooperatives/:id/contribution-groups/:groupId/members` | Add a member by email (coordinator or governance) |
| `POST /cooperatives/:id/contribution-groups/:groupId/contributions` | Record a new due period, creating one `Contribution` per active group member |
| `GET /cooperatives/:id/contribution-groups/:groupId/contributions` | List contributions for the group |
| `POST /cooperatives/:id/contribution-groups/:groupId/contributions/:contributionId/confirm` | Mark a contribution `CONFIRMED` |
| `POST /cooperatives/:id/contribution-groups/:groupId/contributions/:contributionId/flag` | Mark `LATE` or `DEFAULTED` |
| `GET /cooperatives/:id/contribution-groups/:groupId/trust-score` | Group-average trust score + rating |
| `GET /cooperatives/:id/members/:userId/trust-score` | One member's deterministic (non-AI) trust score — reliability rate + tenure bonus − late/default penalties, banded into HIGH/STANDARD/BELOW_THRESHOLD |

### Land Banking

Listing/publishing/reserving is restricted to `COOPERATIVE_ADMIN`/`CHAIRMAN`/`LAND_DESK_OFFICER` (`MANAGE_LAND_ROLES`); reading parcels/reservations is open to any active member.

| Endpoint | Description |
| --- | --- |
| `POST\|GET /cooperatives/:id/land-parcels` | List a parcel (location, price, size, Minna/WGS84 coordinates, title status) as `UNDER_REVIEW`, or list all parcels |
| `PATCH /cooperatives/:id/land-parcels/:parcelId` | Update details, including a manually-entered `verificationScore` (0–100) and dispute-check notes |
| `POST /cooperatives/:id/land-parcels/:parcelId/publish` | Publish a parcel (moves `UNDER_REVIEW` → `PUBLISHED`) |
| `POST\|GET /cooperatives/:id/land-parcels/:parcelId/reservations` | Reserve a published parcel for a group (requires the group's trust score to clear the eligibility threshold; 30-day hold) / list its reservations |
| `GET /cooperatives/:id/reservations/:reservationId` | Reservation detail, including the group's saved total vs. the parcel price |
| `POST /cooperatives/:id/reservations/:reservationId/confirm` | Confirm once the group's confirmed contributions cover the full parcel price |
| `POST /cooperatives/:id/reservations/:reservationId/cancel` | Cancel an active reservation, freeing the parcel |

### Property Syndication

Managing escrow/milestones/allocations is restricted to `COOPERATIVE_ADMIN`/`CHAIRMAN`/`TREASURER` (`MANAGE_SYNDICATION_ROLES`); reading is open to any active member.

| Endpoint | Description |
| --- | --- |
| `POST /cooperatives/:id/reservations/:reservationId/syndication` | Start a syndication from a confirmed reservation; auto-creates 3 milestones (Title Transfer 50%, Survey & Subdivision 30%, Final Allocation 20%) |
| `GET /cooperatives/:id/syndications` \| `/:syndicationId` | List/detail, including milestones and allocations |
| `PATCH /cooperatives/:id/syndications/:syndicationId/fund-escrow` | Record that funds moved to an external trustee (reference + amount) |
| `PATCH /cooperatives/:id/syndications/:syndicationId/milestones/:milestoneId/verify` | Mark a milestone verified with proof notes |
| `PATCH /cooperatives/:id/syndications/:syndicationId/milestones/:milestoneId/release` | Release a verified milestone's funds; releasing the last milestone completes the syndication and marks the parcel `SOLD` |
| `POST /cooperatives/:id/syndications/:syndicationId/allocations` | Record a member's plot allocation once the syndication is `COMPLETED` |

## CI

GitHub Actions (`.github/workflows/ci.yml`) lints, builds, and tests both `backend` and `frontend` on every push and pull request to `main`. The backend job runs against a real Postgres service container so the auth e2e suite exercises the full stack.
