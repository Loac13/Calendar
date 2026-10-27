# Racing Calendar V64

Static, installable racing calendar for 2027–2036. Five tabs: Agenda, Calendar,
Tariffs, Invoicing and Settings. Calendar → **Open full desktop calendar** retains
the original editing, resizing, filters, holidays, family events, printing and ICS
exports. Settings provides the same desktop entry point.

## Data and calculations

The existing `loic-racing-calendar-pwa-v1` local storage key and JSON format are
preserved. V64 adds an optional `v64` object; old JSON and embedded V62 HTML backups
can still be imported. Back up each device before upgrading or resolving a sync
conflict. Import replaces the current dataset after confirmation and retains the
previous snapshot locally. Invalid stored data is retained and automatic writes
are blocked, rather than replacing it with defaults.

Tariffs and tax are shared across years, matching the original dashboard. Invoices
are separate monthly gross amounts for each year. Actual annual totals sum cents;
the adjustable annual limit applies to gross amounts actually invoiced (0 disables
it). Projection = scheduled work × work rate + travel × travel rate + manual home
days × home rate, multiplied by each championship's coefficient. The first and
last event days are travel; a single-day event counts once as travel. Monthly
projections allocate scheduled days to their calendar month. Undated home days
appear only in the annual projection. Actual invoices and projections are never
added together. These are tracking totals, not legal invoice documents.

JSON/HTML backups contain private calendar and financial data: keep them private,
never commit them to GitHub. Credentials and sessions are excluded from backups.
Browser storage can be cleared by the OS or user; export backups regularly.

## Optional private Supabase sync

No Supabase project, credentials or financial records are included in this repo.

1. Create a Supabase project and run `supabase/setup.sql` once in its SQL editor.
2. Enable email/password authentication. Configure the GitHub Pages URL as your
   Site URL / allowed confirmation redirect. Keep email confirmation enabled.
3. On each device open Settings, enter the project HTTPS URL and **publishable or
   anon** key, and save. Never use a secret/service-role key in a browser.
4. Create/confirm an account, then sign in with the same account on both devices.
5. Export backups, then select **Enable automatic sync** on each device.

RLS restricts SELECT, INSERT and UPDATE to `auth.uid() = user_id`. Anonymous access
and client deletion are not granted. Auth tokens are managed by the bundled
Supabase SDK. Configuration/session storage is device-local and excluded from
calendar snapshots. Use trusted devices; sign out on shared computers.

Sync runs after saves, on reconnect / foregrounding, and every 15 seconds while
open. Enabled sync resumes after reload. iOS does not guarantee background activity
when the app is closed. Offline edits remain local until reconnection. Concurrent
changes pause sync and offer **Use cloud version** / **Use this device version**;
they are not automatically merged. A compare-and-swap revision prevents a stale
write overwriting newer cloud changes. A recovery snapshot is retained under
`racing-v64-before-sync`; pre-import recovery uses
`loic-racing-calendar-pwa-v1-before-import`. Export both devices first if both have
valuable edits. Switching accounts does not erase local data; enabling sync on a
new account explicitly uploads that device's current calendar if its cloud is empty.

Live Supabase integration and RLS isolation must be verified after project setup:
create two test users, verify that neither can read/update the other's row and
that an unauthenticated request cannot access records. The automated sync test
uses mocked authenticated responses. A separate PGlite/PostgreSQL test executes
the setup SQL and verifies per-user isolation, anonymous denial and prohibited
deletes against a minimal Supabase auth contract. Neither test verifies your
deployed project configuration.

## GitHub Pages / iPhone

No application build is required. After approving and merging the PR, keep Pages
pointed at the repository's existing branch/root. This PR does not deploy anything.
Visit the existing HTTPS Pages URL in Safari → Share → Add to Home Screen. Keep
the same URL/origin to retain existing browser data. Open online once to cache V64,
then it works offline. New scripts, CSS, image exporter and Supabase SDK are local
assets cached by the service worker; private Supabase responses are never cached.
The external official-holiday update still requires network access.

## Development and validation

Use Node 20+ (Node 24 recommended), Python 3 and Chromium:

```sh
npm ci
npm test
```

Tests use `/usr/bin/chromium`; override with `CHROMIUM_PATH`. Start manually with
`python3 -m http.server 8765`. Tests cover responsive layouts, desktop access,
events, leap dates, persistence, rates, invoices, backup compatibility, offline
caching and simulated authenticated synchronization/conflicts. All test financial
amounts and users are synthetic. Real iPhone Safari installation and live Supabase
access require device/project acceptance testing.

`npm run build:vendor` rebuilds the checked-in Supabase browser bundle. The image
bundle is copied from `node_modules/html2canvas/dist/html2canvas.min.js`. PDF export
uses the existing browser print dialog (Save as PDF).
Dependency versions are locked; third-party licenses are in `vendor/`.
