# NCMS User Guide

A walkthrough of NCMS's features, organized by what a member vs. governance
(admin/chairman/secretary/treasurer/auditor/loan officer) can do. Use this
alongside the live app at https://ncms-frontend-taupe.vercel.app.

## Quickstart with the demo cooperative

The backend ships an idempotent seed (`docs/DEPLOYMENT.md` explains how to run
it) that creates a ready-to-explore cooperative:

- **Cooperative:** NCMS Demo Cooperative (`ncms-demo`)
- **Admin login:** `demo-admin@ncms.example` / `DemoPass123!`

Log in with that account, or register your own account and create a new
cooperative — either works. The rest of this guide assumes you're on a
cooperative's detail page (`/cooperatives/:id`), which has a left sidebar
jumping to every section described below.

## Getting started (anyone)

1. **Register** at `/register`, then **log in** at `/login`.
2. Optionally enable **two-factor authentication** from `/mfa` — scan the QR
   code with an authenticator app (Google Authenticator, Authy, etc.) and
   confirm with a 6-digit code.
3. From `/cooperatives`, either **create a cooperative** (you become its
   `COOPERATIVE_ADMIN`) or **join one** via an invite link shared by an
   existing admin (`/cooperatives/:id/join`).

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

## As a regulator

Regulators are a platform-wide role (not tied to any one cooperative). From
`/regulator`, review every cooperative's submitted filings and
approve/reject them. A `SUPER_ADMIN` bootstraps the first regulator via
`/admin/users`.

## Times and currency

Meeting times are entered and displayed in **West Africa Time (WAT, UTC+1)**
regardless of your device's own timezone, since Nigeria has no daylight
saving time. All monetary amounts are in Naira (₦).

## Something not working?

Check `GET /health` on the backend (see `docs/DEPLOYMENT.md`) to rule out a
database connectivity issue first.
