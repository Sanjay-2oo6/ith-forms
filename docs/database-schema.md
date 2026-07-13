# Database Schema

Authoritative description of the live schema after applying all migrations
in the canonical order (see `docs/migrations.md`).

```
admin_users ──────► auth.users (user_id, ON DELETE CASCADE)

forms 1───* form_sections 1───* form_questions
  │ 1───1 form_themes
  │ 1───1 form_submission_sequences        (per-form reference counters)
  │ 1───* submissions 1───* submission_answers ──► form_questions (RESTRICT)
  │             │ 1───* submission_files  ──► form_questions (RESTRICT)
  │             │ 1───* submission_notes
  │             └ 1───* submission_status_history
audit_logs      (standalone, action CHECK-constrained)
```

## Enums

- `form_status`: `draft · published · closed · archived · deleted`
- `submission_status`: `new · under_review · approved · rejected ·
  more_info_required · archived`

## Tables

### admin_users
Who may use the admin panel. `user_id` (unique) → `auth.users`, `email`,
`display_name`, `is_active`. `is_admin()` = "active row exists for
`auth.uid()`". Rows are added manually (see migration 014 / ADMIN_SETUP.md).

### forms
`slug` (unique), `title`, `description`, `category`, `status` (form_status),
`opens_at` / `closes_at`, `max_responses` (CHECK > 0) with trigger-maintained
`response_count`, `allow_anonymous`, `consent_text`, `confirmation_title` /
`confirmation_message`, `published_at`, `deleted_at` (soft delete),
timestamps. Soft-deleted forms are excluded from every admin aggregate and
from anon reads.

### form_sections
`form_id` (CASCADE), `title`, `description`, `position` (0-based). The
builder renumbers positions after every structural change and auto-renames
default "Section N" titles.

### form_questions
`form_id` + `section_id` (both CASCADE), `type` (see
`src/lib/question-types.ts`), `label`, `description`, `placeholder`,
`required`, `default_value`, `options` jsonb (`[{label, value}]` — the
*value* is stored in answers, stable once created), `position`, and:

- `config` jsonb (migration 017_question_config) — the ACTIVE per-question
  config: `accept[]`, `maxSizeMB`, `ratingMax`, `minLength`/`maxLength`,
  `minSelections`/`maxSelections`, `rows[]`/`cols[]` (grid),
  `media {path, kind}`.
- `file_config` jsonb, `scale_min`/`scale_max` int (migrations
  015_file_upload_configuration / 016_linear_scale_configuration) — LEGACY
  columns from a parallel work track. `scale_min/max` are still read by
  `submit_response`'s scale validation (defaults 1/5 when NULL);
  `file_config` is superseded by `config` and no longer read by the app or
  the current `register_submission_file`.

A BEFORE INSERT trigger enforces the **25-question limit per form**.

### form_themes
One row per form (`form_id` unique): `preset`, `primary_color`,
`background_color`, `card_color`, `font_family`, `border_radius`,
`form_width`, `bg_image_path` (object in the public `form-assets` bucket),
`bg_overlay_opacity` numeric(3,2). Tokens are applied client-side by
`themeContainerStyle()` overriding CSS variables.

### submissions
`form_id` (RESTRICT — forms with submissions can only be soft-deleted),
`reference_id` (unique, trigger-assigned, per-form format
`{ABBR}-{form-id-prefix}-{00001}`), `status` (submission_status),
`respondent_name` / `respondent_email` (extracted from name/email typed
questions), `submitted_at`, `metadata` jsonb, `idempotency_key` uuid
(unique index — powers idempotent submits), `updated_at`.

### submission_answers
`submission_id` (CASCADE), `form_id`, `question_id` (RESTRICT), `value` text
(≤ 20 000 chars; checkbox multi-values joined with `||`; grid answers are a
JSON object string `{row: column}`).

### submission_files
File metadata (objects live in the private `submission-files` bucket under
`<submission_id>/<question_id>/<ts>-<name>`). `submission_id` and
`question_id` are NULLABLE — admin-generated exports are tracked here with
both NULL (path `exports/<form_id>/…`).

### submission_notes / submission_status_history
Admin-only notes and the status audit trail (`from_status`, `to_status`,
`changed_at`).

### audit_logs
`action` (CHECK-constrained list: `admin.login/logout`, `form.created/
published/unpublished/deleted/restored/updated`, `theme.updated`,
`submission.status_changed/exported`), `entity`, `entity_id`, `actor_email`
(auto-filled from `auth.uid()` by trigger when NULL), `metadata` jsonb.
Admin-only read/insert; anon inserts were removed in migration 005.

### form_submission_sequences
Per-form counter for reference IDs (`current_value`), advanced by
`next_form_reference_id()` under row lock; realigned by
018_reset_reference_sequences.

## Triggers

| Trigger | Table | Purpose |
|---|---|---|
| `before_submission_insert` | submissions | assign per-form `reference_id` |
| `on_submission_inserted` | submissions | increment `forms.response_count` (exactly one such trigger — fixed in 016_fix_double_increment) |
| `enforce_question_limit` | form_questions | max 25 questions per form |
| `*_updated_at` | forms, submissions, form_themes | maintain `updated_at` |
| `audit_log_actor_trigger` | audit_logs | fill `actor_email` from session |

## Indexes

Unique: `forms.slug`, `submissions.reference_id`,
`submissions.idempotency_key`, `form_themes.form_id`,
`admin_users.user_id`. Non-unique (migration 005): all FK columns on
submissions/answers/files/notes/history/questions/sections plus
`submissions.submitted_at DESC` and `audit_logs.created_at DESC`.

## Storage buckets

- `submission-files` — PRIVATE. Anon may INSERT (upload); only admins read,
  via short-lived signed URLs. Also holds tracked export files.
- `form-assets` — PUBLIC READ. Theme backgrounds and question media;
  admin-only writes.

## Row-Level Security summary

| Role | Access |
|---|---|
| anon | SELECT published+non-deleted forms/sections/questions/themes; INSERT objects into `submission-files`; everything else via SECURITY DEFINER RPCs only |
| authenticated admin (`is_admin()`) | full CRUD on all app tables; storage read/write |
| authenticated non-admin | nothing (fails `is_admin()`, kicked back to login by the frontend guard) |
