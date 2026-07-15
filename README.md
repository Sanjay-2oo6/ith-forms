# ITH-FORMS

**Self-hosted form builder and response collection platform.** Admins design
and publish forms; anyone with the public link submits responses; admins
review, track statuses, and export — all backed by Supabase with row-level
security end to end.

Built with React 19 · TanStack Start/Router/Query · Tailwind CSS v4 ·
Supabase (Postgres + Auth + Storage) · TypeScript (strict).

---

## Features

- **Form builder** — drag-and-drop sections & questions (14+ types: text,
  choice, dropdown, poll, grid, date/time, rating, file upload), one-click
  question templates, per-question validation config, explicit atomic Save,
  live mobile/desktop preview of unsaved drafts
- **Publishing** — public URL per form, open/close scheduling, response
  limits, consent text, QR-code & social sharing, duplication
- **Response collection** — paginated multi-section public form, client +
  server validation, idempotent submission with per-form reference IDs
  (`ABBR-form-00001`), secure file uploads, URL pre-fill
  (`?name=…&email=…`), "view your submission" link for respondents
- **Response management** — server-side search / status / date-range
  filters, bulk status changes, notes & status history, XLSX export with
  formula-injection protection, secure Open/Download for uploaded files
- **Administration** — dashboard with trends, audit log with readable
  labels, application settings (branding, default appearance, default
  confirmation message), system health checks, light/dark mode

## Architecture

No custom backend server: the browser talks directly to Supabase.

- **Admin pages** use the authenticated session; every table is gated by an
  `is_admin()` RLS policy (active row in `admin_users`).
- **The public form** reads published forms via anon RLS policies and writes
  **only** through the `submit_response` SECURITY DEFINER RPC — idempotent
  via `idempotency_key`, race-safe response limits via row locking.
- **Files** live in a private bucket; uploads are registered through a
  validating RPC (path/extension/size) and admins read via signed URLs.
- The bundled Nitro server (`src/server.ts`) only adds security headers
  (CSP, HSTS, etc.) and a `/health` endpoint.

Details: [docs/database-schema.md](docs/database-schema.md) ·
[docs/api-rpc.md](docs/api-rpc.md) · [docs/security.md](docs/security.md)

## Getting started

### Prerequisites

- Node.js 18+ (20+ recommended) and npm
- A [Supabase](https://supabase.com) project (free tier works)

### 1. Configure environment

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | `https://<your-project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | your project's anon/public key |

Both are inlined at build time; the anon key is safe to ship (RLS applies).
Never put the service-role key anywhere in this project.

### 2. Set up the database

Run every file in `supabase/migrations/` in the Supabase **SQL Editor**, in
the canonical order documented in [docs/migrations.md](docs/migrations.md)
(a few numbers are duplicated across two historical tracks — the doc lists
the exact order). Before running `014_add_your_admin_user.sql`, create your
admin user under Authentication → Users and edit the file with your email
and user id (see `ADMIN_SETUP.md`).

### 3. Run

```bash
npm install
npm run dev        # http://localhost:3000
```

Sign in at `/admin/login` with the admin user you provisioned.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | dev server (port 3000) |
| `npm run build` | production build (Nitro output in `.output/`) |
| `npm run typecheck` | TypeScript strict check |
| `npm test` | unit tests (Vitest) |
| `npm run test:rpc` | integration tests against your real Supabase project (opt-in; see [docs/testing.md](docs/testing.md)) |
| `npm run test:e2e` | Playwright E2E (`E2E_ADMIN_EMAIL/PASSWORD`, `E2E_PUBLIC_SLUG`) |
| `npm run test:visual` | visual regression baselines/diffs |
| `npm run loadtest` | public-submission load test (`LT_*` vars, `LT_CONFIRM=yes`) |

## Project structure

```
src/
  routes/            file-based routes (TanStack Router)
    _admin/          admin pages (guarded: session + active admin row)
    forms/$slug.tsx  the public form renderer
    view-response/   respondent's read-only submission view
  components/        form-builder/, responses/, admin shell, shared UI
  lib/               validation (Zod), settings/branding hooks, export
                     pipeline, duplication, audit labels
  integrations/      Supabase client
supabase/migrations/ SQL migrations (run manually, ordered)
docs/                schema, RPC API, security, testing, deployment docs
e2e/                 Playwright E2E + visual specs
tests/integration/   RPC/RLS integration tests
load-test/           zero-dependency load-test script
```

## Security overview

- RLS on every table; admin writes require an active `admin_users` row
- Public writes only via validating SECURITY DEFINER RPCs (no direct
  anon table access); submissions are idempotent and race-safe
- Private file storage with signed, expiring download URLs
- CSP + HSTS + frame/embed hardening on every response
  (nonce limitation documented in [docs/security.md](docs/security.md))
- XLSX export cells are neutralised against formula injection
- Append-only audit log with DB-constrained action values

## Deployment

Any Node 18+ host can run the built output:

```bash
npm run build
node .output/server/index.mjs   # respects PORT
```

Put a TLS-terminating reverse proxy in front, set the two `VITE_*` env vars
at build time, and point an uptime monitor at `GET /health`. Platform notes
(Cloudflare/Netlify/Vercel presets): [docs/deployment.md](docs/deployment.md).

## Known limitations & manual steps

- **Migrations are manual** — run new SQL files in the Supabase SQL Editor
  (there is no CLI ledger). Check `docs/migrations.md` for what's pending.
- The CSP keeps `'unsafe-inline'` for scripts because the current TanStack
  Start version cannot stamp nonces on streamed hydration scripts —
  compensating controls and revisit criteria in `docs/security.md`.
- Admin accounts are provisioned manually (`ADMIN_SETUP.md`) — deliberate:
  there is no self-signup.
- No CAPTCHA/rate limiting on public submissions beyond per-form response
  caps (accepted risk; see `docs/security.md`).
- Reference-ID links (`/view-response/…`) act as capability tokens — anyone
  holding a link can view that submission.

## Screenshots

_Add screenshots of the dashboard, form builder, and a public form here
(e.g. `docs/screenshots/`) — none are bundled to keep the repo lean._

## License

Private project of InnoTech-Hub. All rights reserved.
