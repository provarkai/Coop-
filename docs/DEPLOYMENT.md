# Deployment & Go-Live (Sprint 14)

This is the production readiness checklist for NCMS: what's already live, what
to check before a real go-live, and how to operate the deployed app day to day.

## Current live deployment

| Component | Platform | URL |
| --- | --- | --- |
| Backend (NestJS + Postgres) | Railway | https://backend-production-0153.up.railway.app |
| Frontend (Next.js) | Vercel | https://ncms-frontend-taupe.vercel.app |

Both redeploy automatically: Railway on every push to `main` (via its GitHub
integration), Vercel via `vercel --prod` from the `frontend/` directory.

## Environment variables (backend)

See `backend/.env.example` for the full list. In production (Railway), these
are set as service variables rather than a `.env` file:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (Railway provisions this automatically for its Postgres plugin) |
| `PORT` | HTTP port (Railway sets this automatically) |
| `FRONTEND_URL` | Used for CORS `origin` — must match the deployed frontend's URL exactly |
| `APP_URL` | Used to build membership-card verification links |
| `JWT_ACCESS_SECRET` | Signs access tokens — a long random string, unique per environment |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | Token lifetimes |
| `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` | AI features (Sprint 12) — omitting the key disables AI endpoints with a clear 500, not a silent failure |

The frontend needs `NEXT_PUBLIC_API_URL` pointing at the backend's public URL,
set as a Vercel project environment variable (and in `frontend/.env.local` for
local dev).

## Database migrations

The backend's Railway service is configured (in Railway's own service
settings, not a repo file) with the start command
`npx prisma migrate deploy && node dist/main`, so every deploy applies any
pending migrations before the app starts. There is no separate manual
migration step for normal deploys.

## Seeding a pilot cooperative

`backend/prisma/seed.ts` is an idempotent seed that creates one demo
cooperative (`NCMS Demo Cooperative`, slug `ncms-demo`) with a
`COOPERATIVE_ADMIN` login, so a fresh environment has somewhere to log in and
explore rather than an empty database. It deliberately does not seed
savings/loan/meeting activity — that goes through real service-layer logic
(auto-posting, schedule generation, etc.) and is best exercised through the
actual UI rather than duplicated in a seed script.

```bash
cd backend
npx prisma db seed
```

Running it again is a no-op if the demo cooperative already exists. See
`docs/USER_GUIDE.md` for the demo login and a walkthrough of what to do next.

## Health check & monitoring

`GET /health` (no auth required, exempt from rate limiting) checks database
connectivity and returns:

```json
{ "status": "ok", "database": "ok", "uptimeSeconds": 1234, "timestamp": "..." }
```

or a `503` with `{ "status": "error", "database": "unreachable" }` if the
database is unreachable. Point Railway's health check and any external uptime
monitor (UptimeRobot, Better Uptime, etc.) at this endpoint rather than `/`,
since `/` doesn't verify the database.

## Hardening already in place (Sprint 13)

- Helmet security headers on every response.
- Rate limiting: 600 req/min per IP by default, 10 req/min on auth routes
  (login, register, forgot/reset password, MFA enable/disable). The app
  trusts the first proxy hop (`app.set('trust proxy', 1)`) so this keys on
  the real client IP behind Railway's edge, not an intermediate hop.
- 10MB JSON body limit (needed for base64 document uploads).
- `npm audit`: backend clean. Frontend has two high-severity advisories
  (`postcss`, `sharp`) that are transitive dependencies bundled *inside*
  Next.js's own build tooling — not reachable from runtime request handling —
  with no non-preview Next.js release fixing them yet. Re-run `npm audit` in
  `frontend/` periodically and upgrade once a stable fix ships; do not force
  a downgrade (npm's suggested fix regresses Next.js by several major
  versions and would break the app).

## Before onboarding real users (pilot rollout)

1. Rotate `JWT_ACCESS_SECRET` to a fresh random value if it hasn't been
   changed since initial setup.
2. Confirm `FRONTEND_URL` on the backend matches the real frontend domain
   exactly (CORS will silently reject requests otherwise).
3. Confirm Railway's Postgres plugin has automated backups enabled (Railway's
   dashboard, under the Postgres service's Settings → Backups).
4. Decide on `OPENROUTER_API_KEY` billing/usage limits if AI features will
   see real traffic — OpenRouter enforces its own per-key spend caps.
5. Walk through `docs/USER_GUIDE.md` end to end against the live URLs as a
   final smoke check.

## Version

This is **v1.0.0** — see `CHANGELOG.md` for the full sprint-by-sprint history.
Sprint 11 (Mobile Apps) is the only Playbook item not yet built; it's deferred
until requested. Sprints 0–10 and 12–14 are complete.
