# Deployment Guide

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | build time (.env) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | build time (.env) | public anon key (safe to ship — RLS applies) |
| `PORT` | runtime | dev-server port override (vite.config.ts) |

Test/tooling variables (never needed in production):

| Variable | Used by |
|---|---|
| `E2E_BASE_URL`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_PUBLIC_SLUG`, `E2E_DRAFT_SLUG` | Playwright (`npm run test:e2e` / `test:visual`) |
| `RUN via npm run test:rpc` + `E2E_ADMIN_EMAIL/PASSWORD` | RPC integration tests |
| `LT_*` (see `docs/load-testing.md`) | load test |

`VITE_*` values are **inlined at build time** — rebuild after changing them.
The anon key is public by design; the service-role key must never appear in
this repo or the frontend.

## 1. Provision Supabase

1. Create a project at supabase.com.
2. Run every migration in `supabase/migrations/` in the SQL editor, in the
   canonical order listed in `docs/migrations.md` (edit
   `014_add_your_admin_user.sql` with your admin email/user id first —
   create the auth user in Authentication → Users beforehand).
3. Verify the security posture (from a logged-out browser console):
   `supabase.from('submissions').select('*')` must return an error/empty.

## 2. Build the app

```bash
npm install
npm run typecheck && npm test
npm run build          # outputs .output/ (Nitro server + client assets)
```

The build produces a Nitro server bundle — `.output/server/index.mjs` — plus
static client assets. `src/server.ts` wraps every response with the CSP and
hardening headers and serves `GET /health` (JSON liveness + DB probe,
returns 503 when the DB ping fails — point uptime monitors at it).

## 3. Host it

Any Node 18+ host works:

```bash
node .output/server/index.mjs        # respects PORT
```

- **VPS / container**: run the command above behind a reverse proxy
  (Caddy/nginx) that terminates TLS. HSTS is already emitted by the app.
- **Cloudflare Workers/Pages**: the repo contains a `.wrangler/` dir from
  experiments; Nitro can target Workers via its presets. If you deploy this
  way, confirm the CSP header still comes from `src/server.ts` (the default
  export's `fetch` wrapper) and `/health` responds.
- **Netlify/Vercel**: use their Nitro presets; set the two `VITE_*` env vars
  in the dashboard so the build inlines them.

## 4. Post-deploy checklist

- `/health` returns `{ ok: true, db: true }`.
- Admin login works and lands on the dashboard.
- A published form loads anonymously and submits (reference ID appears).
- File upload on a published form succeeds and shows in the response detail.
- Response export downloads an `.xlsx`.
- Response headers include `Content-Security-Policy` and
  `Strict-Transport-Security`.

## Local development

```bash
npm install
cp .env.example .env   # or create .env with the two VITE_ vars
npm run dev            # http://localhost:3000, LAN-accessible (host 0.0.0.0)
```

Note: the dev server binds `0.0.0.0` with `allowedHosts: true` for
LAN/ngrok testing — that is a development convenience; don't run the dev
server on untrusted networks with a production database configured.
