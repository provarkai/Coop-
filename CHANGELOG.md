# Changelog

## v1.0.0 — Initial release

Built sprint-by-sprint per `docs/PLAYBOOK.md`. Sprint 11 (Mobile Apps) is
deferred until requested; every other sprint is complete.

- **Sprint 0** — Project setup.
- **Sprint 1 (Authentication & RBAC)** — Registration, login, JWT
  access/refresh tokens with rotation, password reset, TOTP-based MFA,
  role-based access control.
- **Sprint 2 (Cooperative Management)** — Cooperative creation, branches,
  committees, per-cooperative membership with roles/status/category,
  cooperative-scoped RBAC.
- **Sprint 3 (Member Management)** — Self-service applications with
  approval/rejection, KYC profile fields, guarantor nomination, beneficiaries,
  a digital membership card with a QR code, an audit log.
- **Regulatory compliance** (out-of-sequence addition) — A platform-wide
  `REGULATOR` role and a compliance-filing submit/review workflow.
- **Sprint 4 (Savings Engine)** — Configurable savings products, member
  accounts, deposit/withdrawal recording, simple-interest accrual, QR-coded
  receipts.
- **Sprint 5 (Loan Management)** — Configurable loan products, applications,
  guarantor sign-off, approval/disbursement with a generated repayment
  schedule, repayments, late-payment penalties.
- **Sprint 6 (Payments)** — A simulated payment gateway for self-service
  savings contributions and loan repayments, cooperative-wide reconciliation.
- **Sprint 7 (Accounting)** — A double-entry ledger with an auto-seeded chart
  of accounts, manual journal entries, automatic postings from savings/loan
  activity, trial balance/income statement/balance sheet reports, budgeting.
- **Sprint 8 (Meetings & Governance)** — Meeting scheduling with agendas,
  RSVP and attendance, member-proposed resolutions with voting and governance
  tallying, meeting minutes. Times entered/displayed in WAT (UTC+1).
- **Sprint 9 (Documents & Communication)** — A document repository, real
  server-rendered PDFs (membership card, meeting minutes), a simulated
  multi-channel notification log (email/SMS/WhatsApp/push).
- **Sprint 10 (Reports & Dashboards)** — An executive KPI dashboard, 6-month
  trend analytics, CSV exports, a scheduled (and on-demand) monthly PDF
  digest. Added a persistent sidebar to the cooperative page.
- **Sprint 12 (AI Features)** — Real LLM features via OpenRouter: a
  self-scoped AI assistant, AI-generated meeting summaries, AI-authored
  report commentary. Deterministic rule-based loan risk scoring and
  fraud-signal detection, each with a short AI-authored explanation.
- **Sprint 13 (Hardening)** — Helmet security headers, rate limiting (tighter
  on auth routes), a real bug fix (document uploads over ~75KB were silently
  failing against Express's default body-size limit), load testing, a scoped
  accessibility pass on the primary auth flows.
- **Sprint 14 (Deployment & Go-Live)** — A `GET /health` endpoint (database
  connectivity check, exempt from rate limiting) for uptime monitoring, an
  idempotent pilot-cooperative seed script, `docs/DEPLOYMENT.md` and
  `docs/USER_GUIDE.md`.

See `README.md` for the full per-sprint feature breakdown and API reference
tables.
