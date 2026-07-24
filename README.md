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
- **Sprint 6 (Payments):** done. A simulated payment gateway (no real money movement or provider keys) for self-service savings contributions and loan repayments — a member initiates a payment against their own savings account or active loan, then a "callback" (simulated here in place of a real gateway webhook, triggerable by the payer or by governance) settles it, applying the deposit/repayment automatically on success or leaving the ledger untouched on failure. Includes cooperative-wide reconciliation (filterable by status) and per-member transaction history — with a matching Next.js UI ("Make a payment", "My payments", and a governance-facing reconciliation ledger).
- **Sprint 7 (Accounting):** done. A double-entry ledger — a per-cooperative chart of accounts (auto-seeded with cash, member savings, loans receivable, interest/penalty income, and savings interest expense), manual journal entries (must balance debits and credits), and automatic postings from savings and loan activity (deposits/withdrawals/interest against cash and member savings; disbursements against loans receivable; repayments split into principal and interest portions; penalties against penalty income) so the books stay in sync with the rest of the app without extra data entry. Includes trial balance, income statement, and balance sheet reports, plus simple per-account/period budgeting with variance reporting — with a matching Next.js UI (chart of accounts, journal entries with a manual-entry form, trial balance, income statement, balance sheet, and budgets).
- **Sprint 8 (Meetings & Governance):** done. Meeting scheduling (AGM/board/committee/special) with an ordered agenda, auto-inviting every active member as an attendee; self-service RSVP and governance-recorded attendance; member-proposed resolutions (optionally tied to an agenda item) with one vote per member (FOR/AGAINST/ABSTAIN, changeable while open), governance tallying on close (FOR > AGAINST passes, ties and everything else reject), and withdrawal by the proposer or governance; meeting minutes recording, which marks the meeting COMPLETED — with a matching Next.js UI. All meeting times are entered and displayed in West Africa Time (WAT, UTC+1, Nigeria has no DST) regardless of the viewer's own timezone.
- **Sprint 9 (Documents & Communication):** done. A per-cooperative document repository (arbitrary files uploaded and stored as bytes with metadata — title, category, uploader — download returns the exact original bytes with the right filename/content-type); real, on-demand-generated PDFs for the membership card and meeting minutes (no external service — rendered server-side with `pdfkit`); and a multi-channel notification log (email/SMS/WhatsApp/push) for governance announcements broadcast to every active member, plus an automatic (simulated) email notice to every invited member when a meeting is scheduled. Email/SMS/WhatsApp/push sends are **simulated** — no real provider credentials, every attempt is just logged as `SENT` — with a matching Next.js UI (document upload/list/download/delete, an announcement composer, a personal notification log, and "Download PDF" buttons on the membership card and meeting detail views).
- **Sprint 10 (Reports & Dashboards):** done. An executive KPI dashboard (active members, pending applications, total savings, outstanding loans, this-month loan disbursements/payments, upcoming meetings, open resolutions, cash balance, income/expense/net surplus) and 6-month trend analytics (new members, savings net, loan disbursed/repaid), all computed on demand from existing data — nothing new persisted. CSV exports for members, savings transactions, loans, and journal entries. A monthly digest report — a real generated PDF, stored via the Sprint 9 document repository under a new `REPORT` category, with a (simulated) email notice to every active member — runs automatically on a schedule (`@nestjs/schedule`, 1st of the month) and can also be triggered on demand by governance. Matching Next.js UI: KPI tiles, small trend charts, CSV export buttons, and a "Generate report now" button. The cooperative detail page also gained a persistent left sidebar (Dashboard, Settings, Members, Savings, Loans, Payments, Accounting, Meetings, Documents & Comms, AI Assistant, Compliance, Audit log) and the dashboard now renders at the top of the page for one-click access.
- **Sprint 12 (AI Features):** done (Sprint 11, Mobile Apps, deferred until requested). Real LLM features via [OpenRouter](https://openrouter.ai) (model configurable via `OPENROUTER_MODEL`, defaults to `anthropic/claude-haiku-4.5`): a self-scoped AI assistant any active member can ask about their own savings/loans/upcoming meetings; AI-generated meeting summaries (persisted on `Meeting.aiSummary`, since regenerating costs a real LLM call); and AI-authored management commentary woven into the Sprint 10 monthly PDF report. Loan risk scoring and fraud-signal detection are deterministic, rule-based, and fully unit-testable (loan-to-savings ratio, membership tenure, historical overdue installments, and request-vs-product-max drive the risk score; large/anomalous transactions and rapid deposit-then-withdrawal round-trips drive fraud flags) — the risk score additionally gets a short AI-authored plain-language explanation. Matching Next.js UI: an AI Assistant section, a "Summarize with AI" button on meetings, a "Check risk score" button on loans (governance), and a fraud-alerts panel on the dashboard (admin/chairman/auditor).

See the Playbook for the remaining sprint sequence: Sprint 11 (Mobile Apps, deferred until requested), Sprint 13 (Hardening), and Sprint 14 (Deployment & Go-Live).

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

## Payments API

A simulated gateway: no real provider or money movement. `simulate-callback` stands in for the webhook a real gateway would call.

| Endpoint | Description |
| --- | --- |
| `POST /cooperatives/:id/payments` | Initiate a payment against the caller's own savings account or active loan (self-service) |
| `GET /cooperatives/:id/payments` | Cooperative-wide reconciliation ledger, optional `?status=` filter (`COOPERATIVE_ADMIN`/`CHAIRMAN`/`TREASURER`/`LOAN_OFFICER`/`AUDITOR`) |
| `GET /cooperatives/:id/members/:userId/payments` | A member's own payment history (self or governance/treasurer/loan officer/auditor) |
| `GET /cooperatives/:id/payments/:paymentId` | Payment detail (self or governance/treasurer/loan officer/auditor) |
| `POST /cooperatives/:id/payments/:paymentId/simulate-callback` | Settle an `INITIATED` payment (payer or `COOPERATIVE_ADMIN`/`CHAIRMAN`/`TREASURER`); `SUCCESS` applies the savings deposit or loan repayment, `FAILED` leaves the ledger untouched |

## Accounting API

Restricted to governance/treasurer/auditor — there's no member self-service view, since this is the cooperative's books rather than an individual's data. `GET` routes are `COOPERATIVE_ADMIN`/`CHAIRMAN`/`TREASURER`/`AUDITOR`; posting routes (`POST /accounting/accounts`, `/journal-entries`, `/budgets`) are `COOPERATIVE_ADMIN`/`CHAIRMAN`/`TREASURER`.

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

All routes are restricted to governance/treasurer/auditor/loan-officer (`COOPERATIVE_ADMIN`/`CHAIRMAN`/`SECRETARY`/`TREASURER`/`AUDITOR`/`LOAN_OFFICER`) — there's no member self-service view, since this is cooperative-wide financial and operational data. Everything is computed on demand from existing tables; nothing new is persisted except the generated monthly report document itself.

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
| `POST /cooperatives/:id/ai/assistant` | Ask a question; answered only from the requester's own membership/savings/loans/upcoming-meetings data (any active member) |
| `POST /cooperatives/:id/meetings/:meetingId/summarize` | Generate and persist an AI summary of a meeting's agenda, resolutions, and minutes (`COOPERATIVE_ADMIN`/`CHAIRMAN`/`SECRETARY`) |
| `GET /cooperatives/:id/loans/:loanId/risk-score` | Deterministic 0–100 risk score and LOW/MEDIUM/HIGH rating (loan-to-savings ratio, membership tenure, historical overdue installments, request-vs-product-max), plus an AI-authored plain-language explanation (`VIEW_LOAN_ROLES`) |
| `GET /cooperatives/:id/fraud-alerts` | Deterministic scan of the last 30 days of savings transactions for unusually large transactions and rapid deposit-then-withdrawal round-trips (`COOPERATIVE_ADMIN`/`CHAIRMAN`/`AUDITOR`) |

## CI

GitHub Actions (`.github/workflows/ci.yml`) lints, builds, and tests both `backend` and `frontend` on every push and pull request to `main`. The backend job runs against a real Postgres service container so the auth e2e suite exercises the full stack.
