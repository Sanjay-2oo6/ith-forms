# ITH-FORMS — Roadmap

> Rewritten 2026-07-11. The previous version of this file was the launch
> "completion roadmap" (Phases 0–5: security hardening, toolchain hygiene,
> RPC migration, dashboards) — all of that shipped; its history is preserved
> in `ROADMAP_COMPLETE.md` and the migration story in `docs/migrations.md`.

## Current state

Production-capable form platform: RPC-only public writes with idempotency
and race-safe limits, admin panel (builder with drag-drop + templates +
mobile preview, theming, responses with search/status/date filters, XLSX
export, audit log), per-form reference IDs, soft delete + trash, form
duplication, URL pre-fill, unit/integration/E2E/visual test suites, load
test, and documentation under `docs/`.

## Near term (next few sessions)

- [ ] Apply `021_responses_date_filter.sql` in production (frontend already
      degrades gracefully until then).
- [ ] Cleanup migration (022): make `submit_response` scale validation read
      `config.ratingMax` (fallback to legacy `scale_min/max`), drop the dead
      `file_config` column, drop the unused global `submission_ref_seq` +
      `next_reference_id()`. See "technical debt" in `docs/migrations.md`.
- [ ] Wire the test suites into CI (GitHub Actions: typecheck + unit on PR;
      E2E/visual against a preview deploy with a staging Supabase project).
- [ ] Archive the root-level `*_SUMMARY.md` session notes into `docs/archive/`.

## Medium term

- [ ] Conditional logic (show/hide questions by previous answers) — needs a
      `visibility_rules` jsonb on `form_questions` + evaluation in
      `$slug.tsx`; keep server-side validation aligned.
- [ ] Respondent email confirmations (Supabase Edge Function or Resend) with
      the reference-ID link.
- [ ] Admin notification on new submission (digest or webhook).
- [ ] Response detail: render uploaded images inline via signed URLs.
- [ ] Form-level webhooks (POST on submission) with signing secret.
- [ ] CAPTCHA/rate limiting on public submit if abuse appears
      (`docs/security.md` "accepted risks").

## Long term / ideas

- [ ] Form versioning (freeze question set per published version; stamp
      submissions with version id).
- [ ] Multi-admin roles per form (owner/editor/viewer) — extends
      `admin_users` + RLS predicates.
- [ ] Public REST API for third-party integrations.
- [ ] Draft autosave for respondents (localStorage first; server drafts later).
- [ ] CSP nonce adoption once TanStack Start exposes nonce support
      (`docs/security.md` has the exact revisit criteria).
