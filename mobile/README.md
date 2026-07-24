# NCMS Mobile

A Flutter app for NCMS members and administrators (Sprint 11 of `docs/PLAYBOOK.md`), talking
to the same NestJS API the web app (`../frontend`) uses.

## What's here

- **Auth:** login, registration, JWT access/refresh tokens with tokens kept in platform-secure
  storage (Android Keystore / iOS Keychain via `flutter_secure_storage`) and transparent
  refresh-on-401. MFA-required logins prompt for a 6-digit code, same as the web app.
- **Cooperative picker**, then a bottom-nav shell: Dashboard, Savings, Loans, Meetings,
  Notifications, and (governance roles only) Members.
- **Dashboard:** any exco role (`COMMITTEE_MEMBER`, `LOAN_OFFICER`, `AUDITOR`, `TREASURER`,
  `SECRETARY`, `CHAIRMAN`, `COOPERATIVE_ADMIN`) sees the Sprint 10 KPI tiles; a plain member sees
  a simpler summary. Role is inferred the same way the web app handles it: try the
  governance-only endpoint, and treat a 403 as "this is a plain member." Note this is coarser
  than the backend's actual permissions: every exco role sees the same cooperative-wide
  lists/action buttons on mobile (view and manage aren't distinguished per role here the way the
  backend's per-module role lists do), so a role without write access on a given action still
  sees the button -- tapping it just gets the same 403 back the backend would give anyone else
  without that specific permission.
- **Savings / Loans / Meetings:** members see and act on their own data (apply for a loan, RSVP to
  a meeting); any exco role sees the cooperative-wide list with approve/reject/disburse actions,
  plus can create new meetings (title, type, date/time, location, agenda items) and new
  savings/loan products (via a "manage products" icon in each tab's app bar).
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

## Branding & app identity

- App name: **NCMS**. Android application ID / iOS bundle ID: **com.ncms.app**.
- Icon: a simple green monogram (`assets/icon/icon.png`, matching the app's `#166534` theme
  color), generated across all platform sizes via `flutter_launcher_icons`
  (`dart run flutter_launcher_icons` after editing `assets/icon/`).

## Release signing (Android)

`android/app/build.gradle.kts` reads release-signing config from `android/key.properties`
(gitignored — this is a secret, same treatment as any other credential in this repo, never
committed). Without that file present, `flutter build apk/appbundle --release` silently falls
back to debug signing, which Play Console will reject.

To build a real release yourself, create `android/key.properties`:

```properties
storePassword=<your keystore password>
keyPassword=<same as storePassword -- PKCS12 keystores require these to match>
keyAlias=<your key alias>
storeFile=<absolute path to your .jks keystore>
```

Generate a keystore if you don't have one:

```bash
keytool -genkeypair -v -keystore /path/to/upload-keystore.jks \
  -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

**Keep that keystore file safe and back it up** — losing it means you can never publish an update
under the same app listing again; Play Console has no recovery path for a lost upload key.

Then:

```bash
flutter build appbundle --release --dart-define=API_URL=<your backend URL>
```

Building for a single architecture (`--target-platform=android-arm64`, which covers essentially
all real Android phones in use today) meaningfully shrinks the output if you need to hand the
`.aab` around outside Play Console's own upload flow, at the cost of not supporting 32-bit ARM or
x86 devices/emulators.

## Distribution

Not fully done in this pass — a signed release build exists and has been produced (package
`com.ncms.app`, real release keystore, pointed at the live backend), but it hasn't been rolled
out through Play Console's internal testing track yet under this repo's automation. Automating
that end-to-end needs a Google Play Developer API service-account key (JSON, from a service
account with Play Console "Release to testing tracks" permission on this specific app, with the
Android Publisher API enabled on that exact same Google Cloud project) plus the app already
existing in Play Console (the API can't create a brand-new app listing — that first "Create app"
click has to happen once in the Play Console UI). Absent that, the fallback is manual: take the
signed `.aab` and upload it yourself under Testing → Internal testing → Create new release.

See `docs/DEPLOYMENT.md` for how the backend/web app are deployed; there's no automated mobile
deploy pipeline yet.
