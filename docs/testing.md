# Testing Guide

Four suites, escalating in environment requirements:

## 1. Unit tests — `npm test`

Vitest, `src/**/*.test.ts`. Pure logic: validation schemas, export
hardening, answer display mapping. No network. Run on every change.

## 2. RPC integration tests — `npm run test:rpc`

`tests/integration/rpc.test.ts` against the **real Supabase project in
`.env`** (that's why they're opt-in behind a separate command/config —
`vitest.integration.config.ts`).

- Without extra env: runs the anon **authorization-boundary** checks
  (anon cannot read submissions/audit logs, cannot insert directly, admin
  RPCs reject anon, unknown-form/unknown-submission rejections).
- With `E2E_ADMIN_EMAIL` + `E2E_ADMIN_PASSWORD` (an active admin): also
  creates a disposable published form and verifies successful submission,
  idempotent replay, >50-answer rejection, foreign-question dropping,
  race-safe `max_responses` (two concurrent submits, exactly one wins),
  closed-form rejection, and file path-traversal rejection. Fixtures are
  soft-deleted afterwards (they appear in the admin Trash).

```powershell
$env:E2E_ADMIN_EMAIL="admin@example.com"; $env:E2E_ADMIN_PASSWORD="…"
npm run test:rpc
```

Prefer a staging/dev Supabase project; against production these tests leave
soft-deleted `RPC * Test` forms in Trash.

## 3. E2E — `npm run test:e2e`

Playwright (`e2e/*.spec.ts`, chromium). Starts/reuses the dev server on
:3000 automatically.

| Env | Enables |
|---|---|
| `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` | full admin lifecycle: login, creation validation, blank + template creation, building (sections/questions/required toggle), reorder persistence, publish, anonymous fill + submit, reference-ID verification, responses review, search/status/date filters, detail modal, XLSX export download, duplication, mobile preview |
| `E2E_PUBLIC_SLUG` (published form slug) | credential-free public specs: render, URL pre-fill (+ still-editable + doesn't bypass validation), unknown-param safety, preview banner, unknown-slug unavailable |
| `E2E_DRAFT_SLUG` (draft form slug) | verifies drafts stay unavailable to anon even with `?preview=1` |

Specs skip themselves (with a reason) when their env is missing, so partial
runs are always green rather than falsely red. First run:
`npx playwright install chromium`.

## 4. Visual regression — `npm run test:visual`

`e2e/visual.spec.ts`. Captures the public form (desktop / mobile / preview
banner), the login page (light + dark), and — with admin creds — the theme
editor's live preview across the four presets (that pane uses the exact
`themeContainerStyle()` pipeline the public form uses, giving deterministic
theme coverage without publishing throwaway forms).

Stability measures: animations/transitions/caret disabled via injected CSS,
`networkidle` waits, `maxDiffPixelRatio: 0.02`. Dynamic data (counts,
dates) doesn't appear on the captured surfaces.

Workflow: the FIRST run writes baseline PNGs next to the spec
(`e2e/visual.spec.ts-snapshots/`) — commit them. Later runs diff against the
baselines; refresh intentionally with
`npx playwright test --project=visual --update-snapshots`.
Baselines are OS/GPU-specific; generate them on the machine (or CI image)
that will run the comparisons.

## 5. Load test — `npm run loadtest`

See `docs/load-testing.md`.
