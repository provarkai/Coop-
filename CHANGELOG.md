# Changelog

## Unreleased

- **Kesa module suite (out-of-sequence addition)** — Three new modules built
  from the Provark "Kesa" product spec, added as cooperative features
  alongside the existing savings/loans engine, each with its own sidebar tab:
  - *Contribution Engine (Ajo/Esusu)* — `ContributionGroup`s (rotating or
    target-savings) with a coordinator, members, and per-period
    `Contribution`s that governance confirms, flags late, or flags
    defaulted. A deterministic (non-AI) trust score per member and per group
    — reliability rate, tenure bonus, late/default penalties — bands into
    HIGH/STANDARD/BELOW_THRESHOLD, mirroring the existing loan-risk-score
    pattern of being rule-based and exactly testable.
  - *Land Banking* — Cooperatives list `LandParcel`s (location, price,
    Minna/WGS84 coordinates, title status); a `LAND_DESK_OFFICER` role (or
    `COOPERATIVE_ADMIN`/`CHAIRMAN`) records a manually-entered verification
    score and publishes it. A group whose trust score clears the eligibility
    threshold can reserve a published parcel for 30 days; the reservation
    confirms once the group's confirmed contributions cover the full price.
  - *Property Syndication* — Initiating a syndication from a confirmed
    reservation auto-creates 3 milestones (Title Transfer 50%, Survey &
    Subdivision 30%, Final Allocation 20%). Escrow funding, milestone
    verification/release, and per-member plot allocation are all recorded
    directly — releasing the last milestone marks the syndication complete
    and the parcel sold.

  As with the Payments module, Kesa **never touches real money or land
  registries**: escrow funding just records an external trustee's reference
  and amount, and land verification/dispute notes are entered by a human,
  not fetched from a registry API — the same simulated-external-partner
  convention used throughout this codebase where a real integration doesn't
  exist. New Prisma models: `ContributionGroup`, `ContributionGroupMember`,
  `Contribution`, `LandParcel`, `ParcelReservation`, `Syndication`,
  `SyndicationMilestone`, `Allocation`. Frontend: three new sections
  (Contribution Groups, Land Banking, Syndication) under the cooperative
  page's sidebar.
- **Cooperative profile, logo, and post-login redirect** — `Cooperative` gets
  a logo (`PATCH/GET /cooperatives/:id/logo`, base64 upload like documents,
  excluded from every general cooperative read so listings stay light) and a
  full editable profile (name, state, registration number, email, phone,
  address, by-laws) in the Settings tab. Login now skips the generic account
  hub when a member/admin belongs to exactly one cooperative, landing
  straight on its Dashboard tab instead.
- **Cooperative page: dashboard-first navigation** — The sidebar now switches
  between sections (only the active one renders) instead of jumping to an
  anchor on one long scrolling page. The Dashboard/report is the default
  view; Settings, Members, Savings, Loans, Payments, Accounting, Meetings,
  Documents & Comms, AI Assistant, Compliance, and Audit log each only render
  once clicked.
- **Regulator-scoped cooperative onboarding** — Cooperative creation is now
  `SUPER_ADMIN`-only: the platform team registers a cooperative on a
  regulator's request (per the Nigerian Co-operative Societies Act's
  registration process), naming an already-registered `initialAdminEmail` as
  its `COOPERATIVE_ADMIN` and an optional `state` + `regulatorEmail` for
  immediate assignment. New `RegulatorAssignment` model scopes a regulator's
  read access (cooperative detail, documents, meetings, savings, loans, AI
  assistant, compliance filings/financial-standing) to only the cooperatives
  assigned to them — `SUPER_ADMIN` remains unscoped. New endpoints:
  `POST/DELETE /compliance/assignments`, `GET
  /compliance/cooperatives/:id/assignments`, and read-only
  `GET /compliance/cooperatives/:id/financial-standing` /
  `/meetings` for regulators. Frontend: a SUPER_ADMIN-only cooperative
  registration form (name/slug/state/initial admin/regulator), the
  self-service "+ New" cooperative button removed for everyone else, and the
  regulator dashboard redesigned into collapsed per-cooperative
  report/dashboard cards with a drill-down for financial standing, meetings,
  and (SUPER_ADMIN) regulator-assignment management.
- **Sprint 11 (Mobile Apps)** — A Flutter app (`mobile/`) for members and
  administrators, talking to the same NestJS API as the web app: JWT auth
  with platform-secure token storage and refresh-on-401, a cooperative
  picker, a role-aware dashboard (governance KPI tiles vs. a plain-member
  summary), savings/loans/meetings (member self-service plus governance
  approve/reject/disburse and a member-applications approval tab), and the
  Sprint 9 simulated multi-channel notification log, including sending a
  simulated announcement. Verified with `flutter analyze`/`flutter test`
  plus a real run against the live local backend. Distribution (Play
  Store/App Store) is a follow-up item — see `mobile/README.md`.

## v1.0.0 — Initial release

Built sprint-by-sprint per `docs/PLAYBOOK.md`. Sprint 11 (Mobile Apps) was
deferred until requested at the time of this release; every other sprint
was complete.

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
