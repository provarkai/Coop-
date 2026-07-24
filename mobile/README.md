# NCMS Mobile

A Flutter app for NCMS members and administrators (Sprint 11 of `docs/PLAYBOOK.md`), talking
to the same NestJS API the web app (`../frontend`) uses.

## What's here

- **Auth:** login, registration, JWT access/refresh tokens with tokens kept in platform-secure
  storage (Android Keystore / iOS Keychain via `flutter_secure_storage`) and transparent
  refresh-on-401. MFA-required logins prompt for a 6-digit code, same as the web app.
- **Cooperative picker**, then a bottom-nav shell: Dashboard, Savings, Loans, Meetings,
  Notifications, and (governance roles only) Members.
- **Dashboard:** governance roles (`COOPERATIVE_ADMIN`, `CHAIRMAN`, `SECRETARY`, `TREASURER`,
  `AUDITOR`, `LOAN_OFFICER`) see the Sprint 10 KPI tiles; a plain member sees a simpler summary.
  Role is inferred the same way the web app handles it: try the governance-only endpoint, and
  treat a 403 as "this is a plain member."
- **Savings / Loans / Meetings:** members see and act on their own data (apply for a loan, RSVP to
  a meeting); governance sees the cooperative-wide list with approve/reject/disburse actions.
- **Members:** governance-only tab to approve/reject pending applications.
- **Notifications:** the Sprint 9 simulated multi-channel log (email/SMS/WhatsApp/push) — nothing
  is really sent to a device or inbox, it's a logged record members can see, exactly like the web
  app's Documents & Comms section. Governance additionally gets a "Send announcement" action to
  simulate broadcasting one.

Out of scope for this pass: accounting, compliance filings, documents, reports/CSV exports, and
the AI features. Those stay web-only for now; the mobile app covers the day-to-day member/admin
flows the Playbook calls out.

## Running it locally

```bash
cd mobile
flutter pub get
flutter run --dart-define=API_URL=http://localhost:3001   # point at your local backend
```

Pick any connected device/emulator, or run against Chrome for a quick look (see the CanvasKit
note below). Point `API_URL` at whatever backend you're using — locally, or the live Railway URL.

### Tests

```bash
flutter analyze   # static analysis, no issues
flutter test      # widget tests against a mocked backend (package:http/testing.dart)
```

## Why there's no emulator/device screenshot in this repo's history

This was built and verified in a Linux sandbox with no Android SDK/emulator and no Xcode (iOS
requires a Mac), so it was verified two ways instead:

1. `flutter analyze` and `flutter test` — clean, and passing against a mocked backend.
2. A real, non-mocked run: `flutter build web` served locally, driven with Playwright against
   the actual local NestJS backend and the real seeded demo cooperative (login, cooperative
   selection, dashboard, and the notification-simulation flow all verified against live API
   responses — confirmed via `curl` afterwards that the simulated announcement was actually
   persisted).

One caveat from that verification method: Flutter's web (CanvasKit) renderer normally fetches a
fallback text font from Google's font CDN at runtime, which this sandbox's network policy blocks,
so screenshots taken during that test show icons and layout but not text glyphs. This is a
web-rendering-in-a-restricted-sandbox artifact, not a bug in the app — Playwright's accessibility
tree (which reads Flutter's real semantics, not painted pixels) confirms the actual text and data
were all correct, and a real Android/iOS build doesn't use CanvasKit or a font CDN at all; it
renders with Skia and bundled/system fonts like any other native app.

## Distribution

Not done in this pass. Google Play Console access is available for a future release, but signing,
store listings, and release tracks are a separate step from getting the app built and functionally
verified, which is what this sprint covers. See `docs/DEPLOYMENT.md` for how the backend/web app
are deployed; there's no mobile equivalent yet.
