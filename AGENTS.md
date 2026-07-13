# AGENTS.md — ITH Forms

Form builder + response collection app for InnoTech-Hub. Admins build and
publish forms; anyone with the public link submits responses; admins review,
track statuses, and export.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on port 3000 (strict) |
| `npm run build` | Production build (TanStack Start / Nitro) |
| `npm run typecheck` | `tsc --noEmit` (strict mode) |
| `npm test` | Vitest unit tests (`src/**/*.test.ts`) |
| `npm run test:rpc` | Integration tests vs the REAL Supabase project — opt-in, writes fixtures (see `docs/testing.md`) |
| `npm run test:e2e` | Playwright E2E (needs `E2E_ADMIN_EMAIL/PASSWORD`; see `e2e/`) |
| `npm run test:visual` | Playwright visual regression (needs `E2E_PUBLIC_SLUG`) |
| `npm run loadtest` | Public-submission load test (needs `LT_FORM_ID`, `LT_CONFIRM=yes`; see `docs/load-testing.md`) |

## Stack

React 19 + TanStack Start (SSR shell, but every route sets `ssr: false`) ·
TanStack Router (file-based, `src/routes/`) · TanStack Query · Tailwind v4
(design tokens in `src/styles.css`) · Supabase (Postgres + Auth + Storage) ·
Zod · @dnd-kit · Vitest + Playwright.

## Architecture in one paragraph

There is no custom backend: the browser talks straight to Supabase. Admin
pages use the authenticated session (RLS policy `is_admin()` gates every
table); the public form reads published forms via anon RLS policies and
writes **only** through the `submit_response` SECURITY DEFINER RPC
(idempotent via `idempotency_key`, race-safe limits via `FOR UPDATE`).
File uploads go to the private `submission-files` bucket and are registered
through `register_submission_file` (path/extension/size validated
server-side). `src/server.ts` only adds security headers (CSP) and `/health`.

## Key paths

- `src/routes/_admin/` — admin pages, guarded by `_admin/route.tsx`
  (Supabase session + active `admin_users` row, else redirect to login)
- `src/routes/forms/$slug.tsx` — THE public form renderer (validation,
  pagination, file upload, URL pre-fill, `?preview=1` mode)
- `src/components/form-builder/` — builder UI extracted from `edit.tsx`
  (`QuestionCard`, `SectionBlock`, `BuilderTab`, `SettingsTab`, `PreviewModal`)
- `src/components/responses/` + `src/lib/responses.ts` — responses table,
  filters, bulk actions, XLSX export pipeline
- `src/components/ui.tsx` — shared input/button class constants + `Field`
- `src/lib/validation.ts` — Zod schemas (`FormCreateSchema`,
  `SubmitPayloadSchema`), uuid fallback, file checks
- `src/lib/duplicate-form.ts` — form cloning (sections/questions/theme)
- `supabase/migrations/` — run MANUALLY in the SQL editor, in order; see
  `docs/migrations.md` for the numbering conflicts and canonical order
- `docs/` — RPC API, schema, deployment, security, testing, load-testing

## Conventions (follow these)

- Route components own state + Supabase calls; presentational pieces live in
  `src/components/`. No Redux/Zustand — local state + TanStack Query only.
- Query keys in use: `["form-meta", formId]`, `["option-map", formId]`,
  `["responses-tabular", formId, …filters]`, `["submission-detail", id]`,
  `["forms-list", showTrash]`. Invalidate rather than refetch manually.
- Debounced saves (600 ms) with the `SaveIndicator` pattern in the builder.
- Every admin mutation writes an `audit_logs` row — the allowed `action`
  values are constrained by a DB CHECK (see `docs/database-schema.md`).
- Toasts (`sonner`) for user-facing errors; `console.error` for diagnostics.
- Comments explain *why* (constraints, fixed bugs `#N` / `F<N>` / `B<N>`).
- Styling: Tailwind utilities against CSS-variable tokens only; primary
  buttons become pills via a global rule in `styles.css`.

## Things that will bite you

- **Never** give anon direct table write access; `submit_response` is the
  only public write path (migration 005 dropped the legacy policies).
- The CSP intentionally keeps `'unsafe-inline'` for scripts WITHOUT a nonce —
  adding a nonce makes browsers ignore `'unsafe-inline'` and blanks the app.
  Details: `docs/security.md`.
- `forms.response_count` is trigger-maintained; migration 016 fixed a double
  increment — never add another AFTER INSERT counter trigger.
- Reference IDs are per-form (`{ABBR}-{form-prefix}-{00001}`, migration 010).
- Choice answers store option *values*; UI/export map value→label through
  `optionMap` (`buildOptionMap`). Checkbox multi-values join with `||`.
- Migrations have duplicate numbers (two 015/016/017/018 files). Canonical
  order and rationale: `docs/migrations.md`. Next free number: 022.
