# Migrations — History, Numbering Conflicts, and Canonical Order

Migrations are applied **manually** in the Supabase SQL editor (there is no
CLI ledger / `schema_migrations` table). Every file is written to be
idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS`),
which is what makes the duplicate numbering below survivable.

## The numbering conflicts (and the decision)

Two parallel work tracks were numbered independently, producing FOUR
duplicate pairs:

| # | Track A ("bug-fix" track) | Track B ("config" track) |
|---|---|---|
| 015 | `015_expand_audit_actions.sql` | `015_file_upload_configuration.sql` |
| 016 | `016_fix_double_increment.sql` | `016_linear_scale_configuration.sql` |
| 017 | `017_fix_checkbox_delimiter.sql` | `017_question_config.sql` |
| 018 | `018_validate_scale_values.sql` | `018_reset_reference_sequences.sql` |

**Decision: files are NOT renamed.** Reasons:

1. There is no migration ledger — nothing mechanical breaks from duplicate
   numbers; only humans reading the folder are affected.
2. Renaming would desynchronise the many historical docs (`RUN_THESE_
   MIGRATIONS.md`, `MIGRATION_GUIDE.md`, session summaries) that reference
   the current filenames, creating more confusion than it removes.
3. Every file in both tracks is idempotent and the pairs touch DISJOINT
   objects (audit constraint vs. file_config column; counter trigger vs.
   scale columns; answer delimiter vs. config column; submit_response vs.
   reference sequences) — apply order *within a pair* does not matter.
   The only cross-pair dependency is that `018_validate_scale_values.sql`
   redefines `submit_response` and reads `scale_min/scale_max`, which
   `016_linear_scale_configuration.sql` creates — the canonical order below
   respects that.

**Going forward: the next migration number is 024** (022 is
`022_save_form_builder.sql`, 023 is `023_audit_actions_canonical.sql`).
Never reuse a number; check this file and the folder before numbering.

## Canonical apply order (fresh environment)

```
001_init.sql
002_audit_actor.sql
003_fixes.sql
004_solutions_migration.sql
005_security_hardening.sql          ← RPC-only public writes, storage, indexes
006_dashboard_aggregates.sql
007_response_view_and_fixes.sql
008_complete_fixes.sql
009_fix_audit_actor.sql
010_per_form_reference_ids.sql
011_public_view_response.sql
012_fix_audit_log_actions.sql
013_fix_dashboard_functions.sql
014_add_your_admin_user.sql         ← EDIT FIRST: your email/user_id
015_file_upload_configuration.sql   (config track)
015_expand_audit_actions.sql        (fix track — restores actions 012 dropped)
016_linear_scale_configuration.sql  (config track — adds scale_min/max)
016_fix_double_increment.sql        (fix track — ONE counter trigger)
017_question_config.sql             (config track — the ACTIVE config column)
017_fix_checkbox_delimiter.sql      (fix track — ',' → '||' delimiter)
018_validate_scale_values.sql       (fix track — needs scale_min/max ⇒ after 016 config)
018_reset_reference_sequences.sql   (config track)
019_normalize_yes_no_values.sql
020_production_readiness.sql        ← supersedes several earlier functions
021_responses_date_filter.sql       ← current get_form_responses_tabular
022_save_form_builder.sql           ← atomic builder save RPC + upsert-aware 25-limit trigger
023_audit_actions_canonical.sql     ← current audit action CHECK (adds form.updated etc.)
```

"Which version of a function is live?" — the LAST file in this order that
defines it:

| Function | Authoritative file |
|---|---|
| `submit_response` | 018_validate_scale_values.sql |
| `register_submission_file` | 020_production_readiness.sql |
| `get_form_responses_tabular` | **021**_responses_date_filter.sql |
| `get_dashboard_stats`, `get_daily_submission_trend` | 020 |
| `get_submission_detail` | 006 |
| `get_submission_by_reference` | 011 |
| `save_form_builder`, `check_question_limit` | 022 |
| audit `action` CHECK constraint | **023** |

## Known technical debt (forward-only cleanup candidates)

- **Legacy question-config columns.** `form_questions.file_config`
  (015-config) is dead — superseded by `config` (017-config) and unread by
  the app and by the current `register_submission_file` (020). `scale_min`/
  `scale_max` (016-config) are still read by `submit_response`'s scale
  validation, while the builder writes `config.ratingMax` — a rating built
  today validates against the 1–5 default rather than its configured max.
  *Safe forward fix:* a future migration that makes `submit_response` read
  `config.ratingMax` (fallback `scale_max`), then drops `file_config`.
- **Audit action list churn.** The CHECK constraint was rewritten in 001→012
  →015→020. It works, but a lookup table (or dropping the CHECK in favour of
  app-level discipline) would stop the migration-per-new-action pattern.
- **Theme presets are hardcoded** in the frontend (`theme.tsx` PRESETS) and
  the default in 001 — fine for one org; a `theme_presets` table is the
  obvious extension point if presets should become editable.
- **Global → per-form reference IDs.** 001 created `submission_ref_seq`
  (global `ITH-YYYY-000001`); 010 replaced it with per-form sequences.
  The global sequence + `next_reference_id()` still exist but are unused by
  the trigger — droppable in a future cleanup migration.
- **Manual admin provisioning.** 014 is a template you edit by hand. This is
  a deliberate security choice (no self-signup), but documentation lives in
  `ADMIN_SETUP.md`; a small SECURITY DEFINER "invite" RPC would be the
  next step if more admins are needed regularly.
- **Root-level session docs.** The many `*_SUMMARY.md` / `*_COMPLETE.md`
  files at the repo root are historical working notes from past sessions,
  not documentation of record — `docs/` and `CLAUDE.md` supersede them.
