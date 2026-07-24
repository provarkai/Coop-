# NCMS User Guide

A walkthrough of NCMS's features, organized by what a member vs. governance
(admin/chairman/secretary/treasurer/auditor/loan officer) can do. Use this
alongside the live app at https://ncms-frontend-taupe.vercel.app.

## Quickstart with the demo cooperative

The backend ships an idempotent seed (`docs/DEPLOYMENT.md` explains how to run
it) that creates a ready-to-explore cooperative:

- **Cooperative:** NCMS Demo Cooperative (`ncms-demo`)
- **Admin login:** `demo-admin@ncms.example` / `DemoPass123!`

Log in with that account, or register your own account and **join** it via an
invite link shared by an existing admin. The rest of this guide assumes you're
on a cooperative's detail page (`/cooperatives/:id`), which has a left sidebar
jumping to every section described below.

Cooperatives themselves aren't self-service: per the Nigerian Co-operative
Societies Act, registering a new cooperative is done by the platform team
(`SUPER_ADMIN`) at a regulator's request, from `/cooperatives/new` — see
"As a regulator or platform admin" below.

## Getting started (anyone)

1. **Register** at `/register`, then **log in** at `/login`.
2. Optionally enable **two-factor authentication** from `/mfa` — scan the QR
   code with an authenticator app (Google Authenticator, Authy, etc.) and
   confirm with a 6-digit code.
3. **Join** an existing cooperative via an invite link shared by its admin
   (`/cooperatives/:id/join`).

## As a plain member

- **Dashboard** (sidebar → Dashboard): KPI tiles and trends are governance-only;
  members instead see their own data throughout the page (My savings, My
  loans, My payments).
- **Savings** (sidebar → Savings): once governance opens a savings account for
  you against a product, you'll see your balance, deposit/withdrawal history,
  and can download a QR-coded receipt per transaction.
- **Loans** (sidebar → Loans): apply for a loan against an open product,
  nominate guarantors (who get a "Guarantor requests" inbox to approve or
  decline), and track your repayment schedule once disbursed.
- **Payments** (sidebar → Payments): make a self-service payment toward your
  own savings or an active loan; view your own payment history.
- **Meetings** (sidebar → Meetings): see scheduled meetings, RSVP, view the
  agenda, propose resolutions, and vote (one vote per member per resolution,
  changeable until governance closes it).
- **Documents & Comms** (sidebar → Documents & Comms): download any document
  governance has uploaded (bylaws, policies, meeting minutes, reports); view
  your own notification log.
- **AI Assistant** (sidebar → AI Assistant): ask questions about your own
  savings, loans, or upcoming meetings — answers are grounded only in your own
  data.
- **Membership card**: from your member detail page, view your digital
  membership card (with QR code) and download it as a PDF.

## As governance (admin/chairman/secretary/treasurer/auditor/loan officer)

Exact permissions vary by role (see the README's per-feature API tables for
the precise role breakdown), but broadly:

- **Members**: approve/reject applications, add members directly by email,
  change roles/status, remove members.
- **Savings/Loans**: create products, open accounts, record
  deposits/withdrawals, approve/reject/disburse loans, record repayments,
  assess late-payment penalties.
- **Payments**: settle a member's initiated payment (simulated gateway
  callback) and view the full reconciliation ledger.
- **Accounting**: the chart of accounts auto-seeds on first visit; review the
  trial balance, income statement, and balance sheet; post manual journal
  entries; set budgets.
- **Meetings**: schedule meetings with an agenda (auto-invites every active
  member), record attendance and minutes, close resolutions (tallies
  FOR/AGAINST — ties reject), generate an **AI summary** of a completed
  meeting.
- **Documents & Communication**: upload documents, broadcast an announcement
  on a simulated channel (email/SMS/WhatsApp/push — logged, not really sent).
- **Reports & Dashboard**: the KPI dashboard and trend charts, CSV exports
  (members, savings transactions, loans, journal entries), and a
  **"Generate report now"** button that renders a PDF monthly digest (with an
  AI-authored commentary paragraph) and notifies every active member.
- **AI risk score / fraud alerts**: on a loan's detail view, "Check risk
  score" shows a deterministic 0–100 score plus an AI-written explanation.
  The dashboard's fraud-alerts panel (admin/chairman/auditor) flags unusually
  large transactions and rapid deposit-then-withdrawal round-trips.
- **Compliance filings**: submit filings (annual return, financial statement,
  AGM minutes, etc.) for regulator review.
- **Audit log**: a chronological record of governance actions on this
  cooperative.

## As a regulator or platform admin

Regulators are a platform-wide role (not tied to any one cooperative). A
`SUPER_ADMIN` bootstraps the first regulator via `/admin/users`.

From `/regulator`, a regulator sees only the cooperatives assigned to them
(mirroring the state-level Director of Cooperatives structure under the
Nigerian Co-operative Societies Act); `SUPER_ADMIN` sees every cooperative.
Each cooperative shows as a collapsed card (member/filing counts) — click it
to drill into that cooperative's **financial standing** (the same KPI numbers
governance sees) and **meetings**. The compliance filings section below still
lists filings across every cooperative the caller can see, with
approve/reject actions.

`SUPER_ADMIN` gets two extra things on this page: a **"+ Register
cooperative"** button (`/cooperatives/new` — name, slug, state, an
already-registered user's email as the initial admin, and an optional
regulator email to assign immediately), and, inside each cooperative's
expanded card, an inline manager to assign or remove regulators for that
cooperative by email (the target user must already hold the `REGULATOR` or
`SUPER_ADMIN` platform role).

## Times and currency

Meeting times are entered and displayed in **West Africa Time (WAT, UTC+1)**
regardless of your device's own timezone, since Nigeria has no daylight
saving time. All monetary amounts are in Naira (₦).

## Something not working?

Check `GET /health` on the backend (see `docs/DEPLOYMENT.md`) to rule out a
database connectivity issue first.
