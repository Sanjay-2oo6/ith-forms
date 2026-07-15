# RPC / API Reference

All server-side logic lives in Postgres functions called through Supabase's
PostgREST RPC endpoint (`/rest/v1/rpc/<name>`). Functions marked
**SECURITY DEFINER** run as the table owner and do their own authorization —
RLS on the underlying tables still protects every other access path.

Authorization legend:
- **anon** — callable with the public anon key (the public form uses these)
- **admin** — requires an authenticated session whose user has an active
  `admin_users` row (`is_admin()` returns true), otherwise raises `unauthorized`

---

## submit_response — anon + authenticated

The ONLY public write path for submissions (defined in migration 005,
current version in 018_validate_scale_values.sql).

```sql
submit_response(
  p_form_id         uuid,
  p_name            text,
  p_email           text,
  p_idempotency_key uuid,
  p_answers         jsonb DEFAULT '[]'   -- [{question_id: uuid, value: text}]
) RETURNS jsonb
```

Returns `{ submission_id: uuid, reference_id: text, duplicate: boolean }`.

Validation / behavior:
- **Idempotent**: if `p_idempotency_key` matches an existing submission the
  original `{submission_id, reference_id}` is returned with `duplicate: true`
  — no second row. Concurrent duplicates are resolved via the unique index
  on `idempotency_key` (unique_violation → return the winner).
- `p_answers` must be a JSON array with ≤ 50 items, else `invalid_payload`.
- Form gates (raised as exceptions): `form_unavailable` (missing / deleted /
  not published), `form_not_open` (before `opens_at`), `form_closed` (after
  `closes_at`), `limit_reached` (`response_count ≥ max_responses`).
- The form row is locked with `SELECT … FOR UPDATE`, making the
  max-responses check race-safe (the counter trigger updates the locked row).
- `rating` / `linear_scale` answers must parse as integers within the
  question's configured range, else `invalid_scale_value` /
  `scale_value_out_of_range`.
- Answers whose `question_id` doesn't belong to this form are silently
  dropped. Values are truncated to 20 000 chars.
- A trigger assigns `reference_id` (per-form format, migration 010) and a
  second trigger increments `forms.response_count` (exactly once — 016).

## register_submission_file — anon + authenticated

Registers metadata for a file already uploaded to the private
`submission-files` bucket (current version in 020_production_readiness.sql).

```sql
register_submission_file(
  p_submission_id uuid,
  p_question_id   uuid,
  p_file_path     text,
  p_file_name     text,
  p_file_size     bigint,
  p_mime_type     text
) RETURNS void
```

Validation:
- Submission must exist, belong to a published non-deleted form, and be
  **less than 1 hour old** (`submission_not_found` otherwise — blocks
  retro-attaching files to old submissions).
- Question must belong to the same form (`invalid_question`).
- `p_file_path` must start with `<submission_id>/` (`invalid_path` — path
  traversal protection).
- Size limit from the question's `config.maxSizeMB` (default 10, hard cap
  50 MB) → `file_too_large`.
- Extension must be in the question's `config.accept` list when configured
  → `invalid_file_type`.

## get_form_responses_tabular — admin

Server-side searched/filtered/paginated response list (current version in
021_responses_date_filter.sql).

```sql
get_form_responses_tabular(
  p_form_id   uuid,
  p_limit     integer     DEFAULT 50,     -- clamped 1..10000
  p_offset    integer     DEFAULT 0,
  p_search    text        DEFAULT NULL,   -- ILIKE on reference_id/name/email
  p_status    text        DEFAULT NULL,   -- submission_status or NULL/'all'
  p_date_from timestamptz DEFAULT NULL,   -- inclusive lower bound
  p_date_to   timestamptz DEFAULT NULL    -- EXCLUSIVE upper bound
) RETURNS json
```

Returns `{ submissions: [...], questions: [...], total_count: n }` where each
submission embeds its answers (keyed by question id) and file metadata.
The date bounds filter `submitted_at`; the client passes "day after the picked
end date" as `p_date_to` so the whole end day is included.

> If 021 has not been applied, the frontend detects PGRST202 and retries
> without the date parameters, warning the admin.

## get_submission_detail — admin

One call returning `{ submission, answers, notes, history }` for the detail
page (defined in 006_dashboard_aggregates.sql).

```sql
get_submission_detail(p_submission_id uuid) RETURNS json
```

## get_dashboard_stats — admin

Aggregate counts for the dashboard (current version in 020).

```sql
get_dashboard_stats(p_days integer DEFAULT 0) RETURNS json
-- p_days ≤ 0 → all time. Soft-deleted forms are excluded everywhere.
```

Returns form counts by status, submission counts by status within the
period, `today_submissions`, `total_submissions_all_time`, `period_start`.

## get_daily_submission_trend — admin

```sql
get_daily_submission_trend(p_days integer DEFAULT 30)
RETURNS TABLE(day_label text /* 'DD/MM' */, count bigint)
-- p_days clamped 1..90; zero-filled series, soft-deleted forms excluded.
```

## get_submission_by_reference — anon + authenticated

Public "view your submission" lookup used by `/view-response/$referenceId`
(defined in 011_public_view_response.sql).

```sql
get_submission_by_reference(p_reference_id text) RETURNS json
```

Returns `{ found: false }` or `{ found: true, submission, form: {title,
description}, answers, files }`. Anyone holding a reference ID can view that
submission — reference IDs act as capability tokens; they are unguessable
only to the extent of the sequence format, so treat links as semi-private.

## Helper functions (not called from the frontend)

- `is_admin() → boolean` — RLS predicate: active `admin_users` row exists.
- `next_form_reference_id(form_id)` / `generate_form_abbreviation(title)` —
  per-form reference IDs (migration 010); invoked by trigger.
- `increment_response_count()`, `assign_reference_id()`,
  `check_question_limit()` (25-question cap), `set_updated_at()`,
  `audit_log_set_actor()` — trigger functions.

## Direct table access (PostgREST, RLS-enforced)

Admins CRUD `forms`, `form_sections`, `form_questions`, `form_themes`,
`submissions` (status updates), `submission_notes`,
`submission_status_history`, `audit_logs` (insert/select) directly — all
gated by `is_admin()`. Anon may only SELECT published forms/sections/
questions/themes and INSERT nothing directly.
