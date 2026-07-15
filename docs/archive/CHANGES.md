# ITH-FORMS — Remediation Changelog

Fixes applied against the **Bug & Test Report** and **Solutions & Remediation Guide**.
Each entry lists the original ID, what was wrong, what changed, and the file(s) touched.

Date: 04 July 2026

---

## 1. Database — run this first

All schema/RLS fixes are consolidated into a single idempotent migration:

**`supabase/migrations/004_solutions_migration.sql`** — run it in Supabase → SQL Editor.
(This supersedes the earlier `002_audit_actor.sql` and `003_fixes.sql`; running 004 alone is sufficient.)

It applies:

| Action | Fixes | What it does |
|--------|-------|--------------|
| 1 | B-02 | Adds `actor_email` column to `audit_logs` |
| 2 | B-01, B-05 | Admin SELECT policy on `submissions`; SELECT + INSERT policies on `submission_files`; drops NOT NULL on `submission_files.submission_id` |
| 3 | R-04 | `forms_slug_unique` UNIQUE constraint on `forms.slug` |
| 4 | R-03 | `increment_response_count()` trigger so `max_responses` is actually enforced |
| R-05 | R-05 | `idempotency_key` column + unique index on `submissions` |

> **Before running:** if `forms.slug` has duplicates, Action 3 fails. Check with
> `SELECT slug, count(*) FROM public.forms GROUP BY slug HAVING count(*) > 1;` and clean up first.

---

## 2. Code changes

### Critical / High

- **B-02 — Audit inserts no longer fail silently**
  Fire-and-forget `audit_logs` inserts now log their error via `.then(({ error }) => …)`
  instead of discarding it, so future schema drift is caught immediately.
  Files: `src/routes/_admin/forms/index.tsx`, `src/routes/_admin/forms/$formId/responses/$submissionId.tsx`

- **B-03 — Question-type picker flips upward near the viewport bottom**
  Picker measures available space and opens upward when there isn't room below.
  File: `src/routes/_admin/forms/$formId/edit.tsx` (`QuestionTypePicker`)

- **B-04 — Form builder scrolls naturally**
  Removed the height-capped inner scroll container; header + tabs are now `sticky`,
  content flows in normal document scroll.
  File: `src/routes/_admin/forms/$formId/edit.tsx`

- **B-05 — XLSX export is tracked in Files**
  After download, the workbook is uploaded to `submission-files/exports/…` and a
  `submission_files` row (with null `submission_id`) is inserted. Files page shows it as "export".
  Files: `src/routes/_admin/forms/$formId/responses/index.tsx`, `src/routes/_admin/files.tsx`

- **B-06 — Login field is a real email input**
  `type="email"`, `inputMode="email"`, `autoComplete="email"`, label "Email address".
  Browser validates format before submit.
  File: `src/routes/admin/login.tsx`

- **B-11 — File-upload failures are surfaced, not swallowed**
  Each upload is checked; failures are collected and shown on the success screen as a
  warning listing which attachments failed (the submission is still recorded, so the
  reference ID is preserved and the user is told to email the files).
  File: `src/routes/forms/$slug[.]html.tsx`

### Medium

- **B-07 — Opens/Closes datetime shows local time**
  Added `toLocalDatetimeInput()` — converts the stored UTC ISO to local wall-clock for the
  `datetime-local` input, and back to ISO on save. Verified: 23:30 local round-trips to 23:30.
  File: `src/routes/_admin/forms/$formId/edit.tsx`

- **B-08 / B-13 — Export buttons say "Export XLSX"**
  Both the (now-removed) Registrations button and the per-form Responses button label match the actual file type.
  File: `src/routes/_admin/forms/$formId/responses/index.tsx`

- **B-09 — Registrations feature removed**
  Removed from the sidebar and deleted the route file; all submission review now flows through
  Forms → Responses → Submission Detail.
  Files: `src/components/admin/AdminShell.tsx`, deleted `src/routes/_admin/registrations.tsx`

- **B-10 — Question type can be changed after creation**
  The type badge is now a button that reopens the picker. Changing type PATCHes the row and
  guards the data transition: switching to a choice type seeds two default options; switching
  away drops options.
  File: `src/routes/_admin/forms/$formId/edit.tsx` (`QuestionCard.changeType`)

### Low

- **B-12 — Removed dead `formatDistanceToNow` import** — `src/routes/_admin/dashboard.tsx`
- **B-14 — Null-guarded `submission_id.slice()`** on the Files page (shows "export" for tracked exports) — `src/routes/_admin/files.tsx`
- **B-15 — Audit log Refresh button** added — `src/routes/_admin/audit.tsx`

### Risk mitigations

- **R-02 — Hardened XLSX formula-injection guard**
  New shared `safeCell` / `safeRow` helpers strip leading whitespace before testing for the
  formula triggers (`= + - @ | %`), so tab/space-hidden payloads can't slip through.
  Files: `src/lib/export-utils.ts` (new), `src/routes/_admin/forms/$formId/responses/index.tsx`

- **R-04 — Slug race handled at the DB**
  New Form now catches Postgres `23505` (unique violation) and shows "Slug already in use",
  backed by the `forms_slug_unique` constraint.
  File: `src/routes/_admin/forms/new.tsx`

- **R-05 — Idempotency key prevents duplicate submissions**
  One `crypto.randomUUID()` per page load is sent with the submission. A duplicate (resubmit
  after crash) is rejected by the unique index (`23505`). Falls back gracefully if the column
  isn't present yet (`42703` → retry without the key), so submissions are never blocked.
  File: `src/routes/forms/$slug[.]html.tsx`

- **R-07 — Session-expiry redirect**
  `AdminShell` subscribes to `onAuthStateChange`; a `SIGNED_OUT` event redirects to
  `/admin/login` instead of showing empty data.
  File: `src/components/admin/AdminShell.tsx`

---

## 3. Still requires you (dashboard / deployment)

- **R-06 — Confirmation email:** deploy `supabase/functions/send-confirmation`, set
  `RESEND_API_KEY` + `FROM_EMAIL`, and add a Database Webhook on `submissions` INSERT.
- **R-01 — Service-role key guard:** optional pre-commit `grep` guard (repo isn't a git repo yet).

## 4. Deferred to next sprint (large features)

- **R-08** drag-and-drop reordering (needs `@dnd-kit/core`)
- Theme editor UI over the existing `form_themes` table
- Bulk status change, form analytics

---

## 5. Verification performed

- `npx tsc --noEmit` → 0 errors
- `npm run build` → succeeds; all bundles (incl. new `qrcode`) generated
- Pure-logic checks: timezone round-trip (B-07) and formula sanitizer (R-02) both PASS
- Full browser runtime testing pending on your running dev server (HMR picks up changes live)
