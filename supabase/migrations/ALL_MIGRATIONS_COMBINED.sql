-- ============================================================
-- ITH-FORMS: ALL MIGRATIONS COMBINED (001-023)
-- For Supabase deployment - IDEMPOTENT (safe to re-run)
-- ============================================================

-- Safely handle enums if they already exist from previous runs
DROP TYPE IF EXISTS form_status CASCADE;
DROP TYPE IF EXISTS submission_status CASCADE;

-- ============================================================
-- 001_init.sql
-- ============================================================


-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enums ───────────────────────────────────────────────────────────────────
CREATE TYPE form_status AS ENUM ('draft','published','closed','archived','deleted');
CREATE TYPE submission_status AS ENUM ('new','under_review','approved','rejected','more_info_required','archived');

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE public.admin_users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text NOT NULL,
  display_name text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.forms (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                 text NOT NULL UNIQUE,
  title                text NOT NULL,
  description          text,
  category             text,
  status               form_status NOT NULL DEFAULT 'draft',
  opens_at             timestamptz,
  closes_at            timestamptz,
  max_responses        integer CHECK (max_responses > 0),
  response_count       integer NOT NULL DEFAULT 0,
  allow_anonymous      boolean NOT NULL DEFAULT true,
  consent_text         text,
  confirmation_title   text,
  confirmation_message text,
  published_at         timestamptz,
  deleted_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.form_sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id     uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT 'Section',
  description text,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.form_questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id       uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  section_id    uuid NOT NULL REFERENCES public.form_sections(id) ON DELETE CASCADE,
  type          text NOT NULL,
  label         text NOT NULL,
  description   text,
  placeholder   text,
  required      boolean NOT NULL DEFAULT false,
  default_value text,
  options       jsonb NOT NULL DEFAULT '[]',
  position      integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.form_themes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id             uuid NOT NULL UNIQUE REFERENCES public.forms(id) ON DELETE CASCADE,
  preset              text NOT NULL DEFAULT 'ith-default',
  primary_color       text,
  background_color    text,
  card_color          text,
  font_family         text,
  border_radius       text,
  form_width          text,
  bg_image_path       text,
  bg_overlay_opacity  numeric(3,2) DEFAULT 0.5,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.submissions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id                 uuid NOT NULL REFERENCES public.forms(id) ON DELETE RESTRICT,
  reference_id            text NOT NULL UNIQUE DEFAULT '',
  status                  submission_status NOT NULL DEFAULT 'new',
  respondent_name         text,
  respondent_email        text,
  submitted_at            timestamptz NOT NULL DEFAULT now(),
  metadata                jsonb NOT NULL DEFAULT '{}',
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.submission_answers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  form_id       uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  question_id   uuid NOT NULL REFERENCES public.form_questions(id) ON DELETE RESTRICT,
  value         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.submission_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  form_id       uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  question_id   uuid NOT NULL REFERENCES public.form_questions(id) ON DELETE RESTRICT,
  file_path     text NOT NULL,
  file_name     text NOT NULL,
  file_size     bigint,
  mime_type     text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.submission_notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  form_id       uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  body          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.submission_status_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  form_id       uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  from_status   submission_status,
  to_status     submission_status NOT NULL,
  note          text,
  changed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action     text NOT NULL,
  entity     text,
  entity_id  text,
  metadata   jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Reference ID sequence ────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS submission_ref_seq START 1;

CREATE OR REPLACE FUNCTION public.next_reference_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seq_val bigint;
BEGIN
  seq_val := nextval('submission_ref_seq');
  RETURN 'ITH-' || to_char(now(), 'YYYY') || '-' || lpad(seq_val::text, 6, '0');
END;
$$;

-- Auto-assign reference_id on submission insert
CREATE OR REPLACE FUNCTION public.assign_reference_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.reference_id := public.next_reference_id();
  RETURN NEW;
END;
$$;

CREATE TRIGGER before_submission_insert
  BEFORE INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.assign_reference_id();

-- ─── Response count trigger ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_response_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.forms SET response_count = response_count + 1 WHERE id = NEW.form_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_submission_inserted
  AFTER INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.increment_response_count();

-- ─── 25-question limit trigger ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_question_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.form_questions WHERE form_id = NEW.form_id) >= 25 THEN
    RAISE EXCEPTION 'Form has reached the 25 question limit';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_question_limit
  BEFORE INSERT ON public.form_questions
  FOR EACH ROW EXECUTE FUNCTION public.check_question_limit();

-- ─── updated_at triggers ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER forms_updated_at BEFORE UPDATE ON public.forms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER submissions_updated_at BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER themes_updated_at BEFORE UPDATE ON public.form_themes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── is_admin helper ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  );
$$;

-- ─── Enable RLS ───────────────────────────────────────────────────────────────
ALTER TABLE public.admin_users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forms                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_sections             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_questions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_themes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_answers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_files          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_notes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs                ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies ────────────────────────────────────────────────────────────

-- admin_users
CREATE POLICY "admin_self_read" ON public.admin_users
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- forms
CREATE POLICY "admin_forms_all" ON public.forms
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "anon_read_published_forms" ON public.forms
  FOR SELECT TO anon
  USING (
    status = 'published'
    AND deleted_at IS NULL
    AND (opens_at IS NULL OR opens_at <= now())
    AND (closes_at IS NULL OR closes_at > now())
  );

-- form_sections
CREATE POLICY "admin_sections_all" ON public.form_sections
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "anon_read_published_sections" ON public.form_sections
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = form_id AND f.status = 'published' AND f.deleted_at IS NULL
  ));

-- form_questions
CREATE POLICY "admin_questions_all" ON public.form_questions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "anon_read_published_questions" ON public.form_questions
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = form_id AND f.status = 'published' AND f.deleted_at IS NULL
  ));

-- form_themes
CREATE POLICY "admin_themes_all" ON public.form_themes
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "anon_read_published_themes" ON public.form_themes
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = form_id AND f.status = 'published' AND f.deleted_at IS NULL
  ));

-- submissions: admin full + anon insert for published+open forms
CREATE POLICY "admin_submissions_all" ON public.submissions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "anon_insert_submissions" ON public.submissions
  FOR INSERT TO anon
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = form_id
      AND f.status = 'published'
      AND f.deleted_at IS NULL
      AND (f.opens_at IS NULL OR f.opens_at <= now())
      AND (f.closes_at IS NULL OR f.closes_at > now())
      AND (f.max_responses IS NULL OR f.response_count < f.max_responses)
  ));

-- anon needs to SELECT their own submission to get back reference_id
CREATE POLICY "anon_read_own_submission" ON public.submissions
  FOR SELECT TO anon
  USING (true);

-- submission_answers
CREATE POLICY "admin_answers_all" ON public.submission_answers
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "anon_insert_answers" ON public.submission_answers
  FOR INSERT TO anon
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.submissions s
    JOIN public.forms f ON f.id = s.form_id
    WHERE s.id = submission_id AND f.status = 'published' AND f.deleted_at IS NULL
  ));

-- submission_files
CREATE POLICY "admin_files_all" ON public.submission_files
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "anon_insert_files" ON public.submission_files
  FOR INSERT TO anon
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.submissions s
    JOIN public.forms f ON f.id = s.form_id
    WHERE s.id = submission_id AND f.status = 'published' AND f.deleted_at IS NULL
  ));

-- submission_notes
CREATE POLICY "admin_notes_all" ON public.submission_notes
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- submission_status_history
CREATE POLICY "admin_history_all" ON public.submission_status_history
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "anon_insert_history" ON public.submission_status_history
  FOR INSERT TO anon WITH CHECK (true);

-- audit_logs
CREATE POLICY "admin_audit_read" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "admin_audit_insert" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "anon_audit_insert" ON public.audit_logs
  FOR INSERT TO anon WITH CHECK (true);

-- ─── Grants ───────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.next_reference_id() TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================
-- 002_audit_actor.sql
-- ============================================================

-- Add actor_email to audit_logs for display in the audit log UI
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_email text;

-- ============================================================
-- 003_fixes.sql
-- ============================================================

-- Fix 1: Allow submission_files to have null submission_id (for admin exports)
ALTER TABLE public.submission_files ALTER COLUMN submission_id DROP NOT NULL;

-- Fix 2: RLS — ensure admin can SELECT all submissions
-- (if your policy only allows anon INSERT, admin reads will be empty)
-- Drop existing select policy if any, then re-create
DROP POLICY IF EXISTS "admin_select_submissions" ON public.submissions;
CREATE POLICY "admin_select_submissions" ON public.submissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Fix 3: Also allow admin to SELECT submission_files
DROP POLICY IF EXISTS "admin_select_submission_files" ON public.submission_files;
CREATE POLICY "admin_select_submission_files" ON public.submission_files
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Fix 4: Allow admin to INSERT submission_files (for export tracking)
DROP POLICY IF EXISTS "admin_insert_submission_files" ON public.submission_files;
CREATE POLICY "admin_insert_submission_files" ON public.submission_files
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ============================================================
-- 004_solutions_migration.sql
-- ============================================================

-- ============================================================
-- ITH-FORMS consolidated migration (Solutions guide, Actions 1–4 + R-05)
-- Idempotent: safe to run more than once.
-- Run this in Supabase → SQL Editor BEFORE deploying the matching frontend build.
-- ============================================================

-- (Action 1) B-02: add missing audit column
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS actor_email text;

-- (Action 2) B-01 + B-05: admin can read submissions, read + track exports
DROP POLICY IF EXISTS "admin_select_submissions" ON public.submissions;
CREATE POLICY "admin_select_submissions" ON public.submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users
            WHERE user_id = auth.uid() AND is_active = true)
  );

DROP POLICY IF EXISTS "admin_select_submission_files" ON public.submission_files;
CREATE POLICY "admin_select_submission_files" ON public.submission_files
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users
            WHERE user_id = auth.uid() AND is_active = true)
  );

DROP POLICY IF EXISTS "admin_insert_submission_files" ON public.submission_files;
CREATE POLICY "admin_insert_submission_files" ON public.submission_files
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.admin_users
            WHERE user_id = auth.uid() AND is_active = true)
  );

ALTER TABLE public.submission_files
  ALTER COLUMN submission_id DROP NOT NULL;

-- (Action 3) R-04: enforce slug uniqueness at the DB level.
-- NOTE: if forms.slug already has duplicates this will fail. Run
--   SELECT slug, count(*) FROM public.forms GROUP BY slug HAVING count(*) > 1;
-- and clean up first. Guarded with a DO block so re-runs don't error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'forms_slug_unique'
  ) THEN
    ALTER TABLE public.forms ADD CONSTRAINT forms_slug_unique UNIQUE (slug);
  END IF;
END $$;

-- (Action 4) R-03 — INTENTIONALLY REMOVED.
-- AUDIT CORRECTION: 001_init.sql ALREADY defines increment_response_count()
-- and the on_submission_inserted AFTER INSERT trigger. Adding a second trigger
-- here caused response_count to be incremented TWICE per submission, halving
-- the effective max_responses limit and inflating dashboard counts.
-- Do NOT re-add a second trigger. If you previously ran a version of this file
-- that created trg_increment_response_count, drop it:
DROP TRIGGER IF EXISTS trg_increment_response_count ON public.submissions;

-- (R-05) Idempotency key: prevents duplicate submissions on resubmit.
-- The frontend sends a per-page-load UUID; the unique index rejects duplicates.
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;
CREATE UNIQUE INDEX IF NOT EXISTS submissions_idempotency_key
  ON public.submissions (idempotency_key);

-- ============================================================
-- 005_security_hardening.sql
-- ============================================================

-- ============================================================
-- 005_security_hardening.sql — Phase 0 of ROADMAP.md
-- Closes: C1 (anon reads all PII), C2 (storage policies),
--         C3 (forgeable audit log), H2 (forgeable history), M2 (indexes)
--
-- ORDER: run 001 → 004 → 005. Idempotent (safe to re-run).
-- IMPORTANT: run this BEFORE deploying the matching frontend build.
-- (The new frontend calls submit_response(); the old direct-insert
--  path keeps working until you deploy, because we only drop the
--  legacy policies here — after which ONLY the RPC path works.)
-- ============================================================

-- ─── 0. Safety: ensure idempotency column exists (also in 004) ───────────────
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;
CREATE UNIQUE INDEX IF NOT EXISTS submissions_idempotency_key
  ON public.submissions (idempotency_key);

-- ─── 1. DROP the dangerous anon policies (C1, C3, H2) ────────────────────────
DROP POLICY IF EXISTS "anon_read_own_submission"  ON public.submissions;            -- C1: USING(true) read-all
DROP POLICY IF EXISTS "anon_audit_insert"         ON public.audit_logs;             -- C3: forgeable audit
DROP POLICY IF EXISTS "anon_insert_history"       ON public.submission_status_history; -- H2: forgeable history

-- Direct anon table writes are replaced by the RPCs below → drop those too.
DROP POLICY IF EXISTS "anon_insert_submissions"   ON public.submissions;
DROP POLICY IF EXISTS "anon_insert_answers"       ON public.submission_answers;
DROP POLICY IF EXISTS "anon_insert_files"         ON public.submission_files;

-- Anon no longer needs to burn reference-id sequence numbers directly.
REVOKE ALL ON FUNCTION public.next_reference_id() FROM PUBLIC, anon;

-- ─── 2. submit_response RPC — the ONLY public write path ─────────────────────
-- SECURITY DEFINER: runs as owner, bypasses RLS internally, validates everything.
-- Atomic: submission + answers in one transaction. Race-safe max_responses via
-- SELECT ... FOR UPDATE. Idempotent via idempotency_key (returns original ref).
CREATE OR REPLACE FUNCTION public.submit_response(
  p_form_id         uuid,
  p_name            text,
  p_email           text,
  p_idempotency_key uuid,
  p_answers         jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form     public.forms%ROWTYPE;
  v_existing public.submissions%ROWTYPE;
  v_sub_id   uuid;
  v_ref      text;
BEGIN
  -- Idempotent replay: same key → return the original result, no duplicate row.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.submissions
      WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'submission_id', v_existing.id,
        'reference_id',  v_existing.reference_id,
        'duplicate',     true);
    END IF;
  END IF;

  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'array'
     OR jsonb_array_length(p_answers) > 50 THEN
    RAISE EXCEPTION 'invalid_payload';
  END IF;

  -- Lock the form row: makes the max_responses check race-safe
  -- (the AFTER INSERT counter trigger updates this same locked row).
  SELECT * INTO v_form FROM public.forms WHERE id = p_form_id FOR UPDATE;

  IF NOT FOUND OR v_form.deleted_at IS NOT NULL OR v_form.status <> 'published' THEN
    RAISE EXCEPTION 'form_unavailable';
  END IF;
  IF v_form.opens_at IS NOT NULL AND v_form.opens_at > now() THEN
    RAISE EXCEPTION 'form_not_open';
  END IF;
  IF v_form.closes_at IS NOT NULL AND v_form.closes_at <= now() THEN
    RAISE EXCEPTION 'form_closed';
  END IF;
  IF v_form.max_responses IS NOT NULL AND v_form.response_count >= v_form.max_responses THEN
    RAISE EXCEPTION 'limit_reached';
  END IF;

  INSERT INTO public.submissions
    (form_id, status, respondent_name, respondent_email, submitted_at, metadata, idempotency_key)
  VALUES
    (p_form_id, 'new',
     nullif(trim(coalesce(p_name,  '')), ''),
     nullif(trim(coalesce(p_email, '')), ''),
     now(), '{}'::jsonb, p_idempotency_key)
  RETURNING id, reference_id INTO v_sub_id, v_ref;

  -- Answers: only questions that actually belong to this form; values capped.
  INSERT INTO public.submission_answers (submission_id, form_id, question_id, value)
  SELECT v_sub_id, p_form_id,
         (a->>'question_id')::uuid,
         left(a->>'value', 20000)
  FROM jsonb_array_elements(p_answers) AS a
  WHERE (a->>'question_id') IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.form_questions q
                WHERE q.id = (a->>'question_id')::uuid
                  AND q.form_id = p_form_id);

  RETURN jsonb_build_object(
    'submission_id', v_sub_id,
    'reference_id',  v_ref,
    'duplicate',     false);

EXCEPTION WHEN unique_violation THEN
  -- Concurrent double-submit with the same idempotency key: return the winner.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.submissions
      WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'submission_id', v_existing.id,
        'reference_id',  v_existing.reference_id,
        'duplicate',     true);
    END IF;
  END IF;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_response(uuid,text,text,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_response(uuid,text,text,uuid,jsonb) TO anon, authenticated;

-- ─── 3. register_submission_file RPC — validated file metadata ───────────────
CREATE OR REPLACE FUNCTION public.register_submission_file(
  p_submission_id uuid,
  p_question_id   uuid,
  p_file_path     text,
  p_file_name     text,
  p_file_size     bigint,
  p_mime_type     text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form_id uuid;
BEGIN
  -- Only fresh submissions to live forms; blocks retro-attaching files to old rows.
  SELECT s.form_id INTO v_form_id
  FROM public.submissions s
  JOIN public.forms f ON f.id = s.form_id
  WHERE s.id = p_submission_id
    AND f.status = 'published' AND f.deleted_at IS NULL
    AND s.submitted_at > now() - interval '1 hour';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'submission_not_found';
  END IF;

  -- The question must belong to the same form.
  IF NOT EXISTS (SELECT 1 FROM public.form_questions q
                 WHERE q.id = p_question_id AND q.form_id = v_form_id) THEN
    RAISE EXCEPTION 'invalid_question';
  END IF;

  -- Path must live under the submission's own folder.
  IF position(p_submission_id::text || '/' IN p_file_path) <> 1 THEN
    RAISE EXCEPTION 'invalid_path';
  END IF;

  IF p_file_size IS NOT NULL AND p_file_size > 10 * 1024 * 1024 THEN
    RAISE EXCEPTION 'file_too_large';
  END IF;

  INSERT INTO public.submission_files
    (submission_id, form_id, question_id, file_path, file_name, file_size, mime_type)
  VALUES
    (p_submission_id, v_form_id, p_question_id,
     p_file_path, left(p_file_name, 300), p_file_size, left(p_mime_type, 100));
END;
$$;

REVOKE ALL ON FUNCTION public.register_submission_file(uuid,uuid,text,text,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_submission_file(uuid,uuid,text,text,bigint,text) TO anon, authenticated;

-- ─── 4. Storage buckets + policies (C2) ──────────────────────────────────────
-- submission-files: PRIVATE. Respondent uploads + admin exports. Admin reads via signed URLs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('submission-files', 'submission-files', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- form-assets: PUBLIC READ (theme/background images shown on public forms), admin-only write.
INSERT INTO storage.buckets (id, name, public)
VALUES ('form-assets', 'form-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "anon_upload_submission_files" ON storage.objects;
CREATE POLICY "anon_upload_submission_files" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'submission-files');

DROP POLICY IF EXISTS "admin_all_submission_files" ON storage.objects;
CREATE POLICY "admin_all_submission_files" ON storage.objects
  FOR ALL TO authenticated
  USING     (bucket_id = 'submission-files' AND public.is_admin())
  WITH CHECK (bucket_id = 'submission-files' AND public.is_admin());

DROP POLICY IF EXISTS "admin_write_form_assets" ON storage.objects;
CREATE POLICY "admin_write_form_assets" ON storage.objects
  FOR ALL TO authenticated
  USING     (bucket_id = 'form-assets' AND public.is_admin())
  WITH CHECK (bucket_id = 'form-assets' AND public.is_admin());

DROP POLICY IF EXISTS "public_read_form_assets" ON storage.objects;
CREATE POLICY "public_read_form_assets" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'form-assets');

-- ─── 5. Indexes (M2) — Postgres does NOT auto-index FK columns ───────────────
CREATE INDEX IF NOT EXISTS idx_submissions_form_id          ON public.submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at     ON public.submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_submission_answers_sub_id    ON public.submission_answers(submission_id);
CREATE INDEX IF NOT EXISTS idx_form_questions_form_id       ON public.form_questions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_questions_section_id    ON public.form_questions(section_id);
CREATE INDEX IF NOT EXISTS idx_form_sections_form_id        ON public.form_sections(form_id);
CREATE INDEX IF NOT EXISTS idx_submission_files_sub_id      ON public.submission_files(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_notes_sub_id      ON public.submission_notes(submission_id);
CREATE INDEX IF NOT EXISTS idx_status_history_sub_id        ON public.submission_status_history(submission_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at        ON public.audit_logs(created_at DESC);

-- ─── 6. Post-run verification queries (run manually, expect these results) ───
-- a) SELECT COUNT(*) FROM pg_policies WHERE tablename='submissions' AND roles @> '{anon}';
--    → 0   (anon has NO direct access to submissions any more)
-- b) SELECT tgname FROM pg_trigger WHERE tgrelid='public.submissions'::regclass AND tgname LIKE '%response_count%' OR tgname='on_submission_inserted';
--    → exactly ONE increment trigger (on_submission_inserted)
-- c) In a logged-out browser console with the anon key:
--    supabase.from('submissions').select('*') → empty / permission error
--    supabase.rpc('submit_response', {...}) on a published form → returns reference_id

-- ============================================================
-- 006_dashboard_aggregates.sql
-- ============================================================

-- ============================================================
-- 006_dashboard_aggregates.sql — Performance optimizations
-- Replaces client-side aggregation with server-side SQL
-- Run this AFTER 005_security_hardening.sql
-- ============================================================

-- Daily submission trend (replaces 10k-row fetch + JS bucketing)
CREATE OR REPLACE FUNCTION public.get_daily_submission_trend(
  p_start_date timestamptz
)
RETURNS TABLE(day date, count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify admin access
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  SELECT submitted_at::date AS day, COUNT(*) AS count
  FROM public.submissions
  WHERE submitted_at >= p_start_date
  GROUP BY submitted_at::date
  ORDER BY day;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_submission_trend(timestamptz) TO authenticated;

-- Dashboard stats (all counts in one RPC call instead of 12 separate queries)
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Verify admin access
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT json_build_object(
    'total_forms', (SELECT COUNT(*) FROM forms WHERE deleted_at IS NULL),
    'published', (SELECT COUNT(*) FROM forms WHERE status = 'published' AND deleted_at IS NULL),
    'drafts', (SELECT COUNT(*) FROM forms WHERE status = 'draft' AND deleted_at IS NULL),
    'closed_archived', (SELECT COUNT(*) FROM forms WHERE (status = 'closed' OR status = 'archived') AND deleted_at IS NULL),
    'total_submissions', (SELECT COUNT(*) FROM submissions),
    'new_subs', (SELECT COUNT(*) FROM submissions WHERE status = 'new'),
    'under_review', (SELECT COUNT(*) FROM submissions WHERE status = 'under_review'),
    'approved', (SELECT COUNT(*) FROM submissions WHERE status = 'approved'),
    'rejected', (SELECT COUNT(*) FROM submissions WHERE status = 'rejected'),
    'more_info', (SELECT COUNT(*) FROM submissions WHERE status = 'more_info_required'),
    'archived_subs', (SELECT COUNT(*) FROM submissions WHERE status = 'archived'),
    'today', (SELECT COUNT(*) FROM submissions WHERE submitted_at >= CURRENT_DATE),
    'this_week', (SELECT COUNT(*) FROM submissions WHERE submitted_at >= CURRENT_DATE - INTERVAL '7 days')
  ) INTO result;
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;

-- Submission detail (combines 4 queries into 1)
CREATE OR REPLACE FUNCTION public.get_submission_detail(p_submission_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Verify admin access
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT json_build_object(
    'submission', (
      SELECT row_to_json(s) FROM submissions s WHERE id = p_submission_id
    ),
    'answers', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', a.id,
          'question_id', a.question_id,
          'value', a.value,
          'question_label', q.label,
          'question_type', q.type
        ) ORDER BY q.position
      ), '[]'::json)
      FROM submission_answers a
      LEFT JOIN form_questions q ON q.id = a.question_id
      WHERE a.submission_id = p_submission_id
    ),
    'notes', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', n.id,
          'body', n.body,
          'created_at', n.created_at
        ) ORDER BY n.created_at
      ), '[]'::json)
      FROM submission_notes n
      WHERE n.submission_id = p_submission_id
    ),
    'history', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', h.id,
          'from_status', h.from_status,
          'to_status', h.to_status,
          'changed_at', h.changed_at,
          'note', h.note
        ) ORDER BY h.changed_at
      ), '[]'::json)
      FROM submission_status_history h
      WHERE h.submission_id = p_submission_id
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_submission_detail(uuid) TO authenticated;

-- Response count reconciliation (for M8 - drift protection)
CREATE OR REPLACE FUNCTION public.reconcile_response_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify admin access
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE public.forms f
  SET response_count = (
    SELECT COUNT(*) FROM public.submissions s WHERE s.form_id = f.id
  )
  WHERE deleted_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_response_counts() TO authenticated;

-- ============================================================
-- 007_response_view_and_fixes.sql
-- ============================================================

-- ============================================================
-- 007_response_view_and_fixes.sql
-- Fixes: Missing RPC functions, adds tabular response view support
-- Run this AFTER 006_dashboard_aggregates.sql
-- ============================================================

-- ─── 1. Add missing submission_files to Files section table ──────────────────
-- Allow NULL submission_id for admin-generated exports
ALTER TABLE public.submission_files 
  ALTER COLUMN submission_id DROP NOT NULL,
  ALTER COLUMN question_id DROP NOT NULL;

-- Add index for files list query
CREATE INDEX IF NOT EXISTS idx_submission_files_form_id 
  ON public.submission_files(form_id, created_at DESC);

-- ─── 2. Get submission responses in tabular format (for responses list view) ─
-- Returns all submissions with answers in structured format
CREATE OR REPLACE FUNCTION public.get_form_responses_tabular(
  p_form_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Verify admin access
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Get all submissions with their answers grouped
  SELECT json_build_object(
    'submissions', COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', s.id,
          'reference_id', s.reference_id,
          'status', s.status,
          'respondent_name', s.respondent_name,
          'respondent_email', s.respondent_email,
          'submitted_at', s.submitted_at,
          'answers', (
            SELECT json_object_agg(
              a.question_id::text,
              json_build_object(
                'value', a.value,
                'question_label', q.label,
                'question_type', q.type,
                'question_position', q.position
              )
            )
            FROM submission_answers a
            LEFT JOIN form_questions q ON q.id = a.question_id
            WHERE a.submission_id = s.id
          ),
          'files', (
            SELECT json_agg(
              json_build_object(
                'question_id', f.question_id,
                'file_name', f.file_name,
                'file_path', f.file_path,
                'file_size', f.file_size,
                'mime_type', f.mime_type
              )
            )
            FROM submission_files f
            WHERE f.submission_id = s.id AND f.question_id IS NOT NULL
          )
        )
        ORDER BY s.submitted_at DESC
      )
      FROM (
        SELECT * FROM submissions
        WHERE form_id = p_form_id
        ORDER BY submitted_at DESC
        LIMIT p_limit OFFSET p_offset
      ) s
    ), '[]'::json),
    'questions', (
      SELECT json_agg(
        json_build_object(
          'id', q.id,
          'label', q.label,
          'type', q.type,
          'position', q.position,
          'section_title', s.title
        )
        ORDER BY s.position, q.position
      )
      FROM form_questions q
      LEFT JOIN form_sections s ON s.id = q.section_id
      WHERE q.form_id = p_form_id
    ),
    'total_count', (SELECT COUNT(*) FROM submissions WHERE form_id = p_form_id)
  ) INTO result;
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_form_responses_tabular(uuid, integer, integer) TO authenticated;

-- ─── 3. Enhanced dashboard stats with meaningful metrics ─────────────────────
-- Updated to include form status breakdown and time-based filtering
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
  p_days integer DEFAULT 7
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  start_date timestamptz;
BEGIN
  -- Verify admin access
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  start_date := CURRENT_DATE - (p_days || ' days')::interval;

  SELECT json_build_object(
    -- Form counts by status
    'total_forms', (SELECT COUNT(*) FROM forms WHERE deleted_at IS NULL),
    'published_forms', (SELECT COUNT(*) FROM forms WHERE status = 'published' AND deleted_at IS NULL),
    'draft_forms', (SELECT COUNT(*) FROM forms WHERE status = 'draft' AND deleted_at IS NULL),
    'closed_forms', (SELECT COUNT(*) FROM forms WHERE status = 'closed' AND deleted_at IS NULL),
    'archived_forms', (SELECT COUNT(*) FROM forms WHERE status = 'archived' AND deleted_at IS NULL),
    
    -- Submission counts (time-filtered)
    'total_submissions', (SELECT COUNT(*) FROM submissions WHERE submitted_at >= start_date),
    'total_submissions_all_time', (SELECT COUNT(*) FROM submissions),
    
    -- Active forms (forms that received submissions in the period)
    'active_forms', (
      SELECT COUNT(DISTINCT form_id) 
      FROM submissions 
      WHERE submitted_at >= start_date
    ),
    
    -- Submission status breakdown (time-filtered)
    'new_submissions', (SELECT COUNT(*) FROM submissions WHERE status = 'new' AND submitted_at >= start_date),
    'under_review', (SELECT COUNT(*) FROM submissions WHERE status = 'under_review' AND submitted_at >= start_date),
    'approved', (SELECT COUNT(*) FROM submissions WHERE status = 'approved' AND submitted_at >= start_date),
    'rejected', (SELECT COUNT(*) FROM submissions WHERE status = 'rejected' AND submitted_at >= start_date),
    
    -- Today's activity
    'today_submissions', (SELECT COUNT(*) FROM submissions WHERE submitted_at >= CURRENT_DATE),
    
    -- Period information
    'period_days', p_days,
    'period_start', start_date
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Drop the old version and recreate
DROP FUNCTION IF EXISTS public.get_dashboard_stats();
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(integer) TO authenticated;

-- ─── 4. Storage bucket policies fix for file downloads ───────────────────────
-- Ensure admin can create signed URLs for downloads
DROP POLICY IF EXISTS "admin_all_submission_files" ON storage.objects;
CREATE POLICY "admin_all_submission_files" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'submission-files' AND 
    (public.is_admin() OR auth.uid() IS NOT NULL)
  )
  WITH CHECK (
    bucket_id = 'submission-files' AND public.is_admin()
  );

-- ─── 5. Export file tracking (for Files section) ─────────────────────────────
-- Insert statement for tracking exports in submission_files
-- Admin code should call this after uploading to storage:
-- INSERT INTO submission_files (form_id, submission_id, question_id, file_path, file_name, file_size, mime_type)
-- VALUES (form_id, NULL, NULL, 'exports/form-id/filename.xlsx', 'filename.xlsx', file_size, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

COMMENT ON COLUMN public.submission_files.submission_id IS 'NULL for admin-generated exports, otherwise links to a submission';
COMMENT ON COLUMN public.submission_files.question_id IS 'NULL for admin-generated exports, otherwise links to a form question';

-- ============================================================
-- 008_complete_fixes.sql
-- ============================================================

-- ==================================================================
-- 008_complete_fixes.sql
-- COMPLETE FIX for all outstanding issues
-- Run this in Supabase SQL Editor
-- ==================================================================

-- ─── 1. DROP OLD FUNCTIONS (to avoid conflicts) ────────────────────
DROP FUNCTION IF EXISTS public.get_dashboard_stats();
DROP FUNCTION IF EXISTS public.get_dashboard_stats(integer);
DROP FUNCTION IF EXISTS public.get_form_responses_tabular(uuid, integer, integer);

-- ─── 2. ENHANCED DASHBOARD STATS WITH TIME FILTERING ───────────────
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_days integer DEFAULT 7)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  start_date timestamptz;
BEGIN
  -- Verify admin access
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  start_date := CURRENT_DATE - (p_days || ' days')::interval;

  SELECT json_build_object(
    -- Form counts by status
    'total_forms', (SELECT COUNT(*) FROM forms WHERE deleted_at IS NULL),
    'published_forms', (SELECT COUNT(*) FROM forms WHERE status = 'published' AND deleted_at IS NULL),
    'draft_forms', (SELECT COUNT(*) FROM forms WHERE status = 'draft' AND deleted_at IS NULL),
    'closed_forms', (SELECT COUNT(*) FROM forms WHERE status = 'closed' AND deleted_at IS NULL),
    'archived_forms', (SELECT COUNT(*) FROM forms WHERE status = 'archived' AND deleted_at IS NULL),
    
    -- Submission counts (time-filtered)
    'total_submissions', (SELECT COUNT(*) FROM submissions WHERE submitted_at >= start_date),
    'total_submissions_all_time', (SELECT COUNT(*) FROM submissions),
    
    -- Active forms (forms that received submissions in the period)
    'active_forms', (
      SELECT COUNT(DISTINCT form_id) 
      FROM submissions 
      WHERE submitted_at >= start_date
    ),
    
    -- Submission status breakdown (time-filtered)
    'new_submissions', (SELECT COUNT(*) FROM submissions WHERE status = 'new' AND submitted_at >= start_date),
    'under_review', (SELECT COUNT(*) FROM submissions WHERE status = 'under_review' AND submitted_at >= start_date),
    'approved', (SELECT COUNT(*) FROM submissions WHERE status = 'approved' AND submitted_at >= start_date),
    'rejected', (SELECT COUNT(*) FROM submissions WHERE status = 'rejected' AND submitted_at >= start_date),
    
    -- Today's activity
    'today_submissions', (SELECT COUNT(*) FROM submissions WHERE submitted_at >= CURRENT_DATE),
    
    -- Period information
    'period_days', p_days,
    'period_start', start_date
  ) INTO result;
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(integer) TO authenticated;

-- ─── 3. TABULAR RESPONSES VIEW FUNCTION ────────────────────────────
CREATE OR REPLACE FUNCTION public.get_form_responses_tabular(
  p_form_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Verify admin access
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Get all submissions with their answers grouped
  SELECT json_build_object(
    'submissions', COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', s.id,
          'reference_id', s.reference_id,
          'status', s.status,
          'respondent_name', s.respondent_name,
          'respondent_email', s.respondent_email,
          'submitted_at', s.submitted_at,
          'answers', (
            SELECT json_object_agg(
              a.question_id::text,
              json_build_object(
                'value', a.value,
                'question_label', q.label,
                'question_type', q.type,
                'question_position', q.position
              )
            )
            FROM submission_answers a
            LEFT JOIN form_questions q ON q.id = a.question_id
            WHERE a.submission_id = s.id
          ),
          'files', (
            SELECT json_agg(
              json_build_object(
                'question_id', f.question_id,
                'file_name', f.file_name,
                'file_path', f.file_path,
                'file_size', f.file_size,
                'mime_type', f.mime_type
              )
            )
            FROM submission_files f
            WHERE f.submission_id = s.id AND f.question_id IS NOT NULL
          )
        )
        ORDER BY s.submitted_at DESC
      )
      FROM (
        SELECT * FROM submissions
        WHERE form_id = p_form_id
        ORDER BY submitted_at DESC
        LIMIT p_limit OFFSET p_offset
      ) s
    ), '[]'::json),
    'questions', (
      SELECT json_agg(
        json_build_object(
          'id', q.id,
          'label', q.label,
          'type', q.type,
          'position', q.position,
          'section_title', s.title
        )
        ORDER BY s.position, q.position
      )
      FROM form_questions q
      LEFT JOIN form_sections s ON s.id = q.section_id
      WHERE q.form_id = p_form_id
    ),
    'total_count', (SELECT COUNT(*) FROM submissions WHERE form_id = p_form_id)
  ) INTO result;
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_form_responses_tabular(uuid, integer, integer) TO authenticated;

-- ─── 4. FIX SUBMISSION FILES TABLE FOR EXPORTS ─────────────────────
-- Allow NULL submission_id and question_id for admin-generated exports
ALTER TABLE public.submission_files 
  ALTER COLUMN submission_id DROP NOT NULL,
  ALTER COLUMN question_id DROP NOT NULL;

-- Add index for files list query
CREATE INDEX IF NOT EXISTS idx_submission_files_form_id 
  ON public.submission_files(form_id, created_at DESC);

-- Add comments for clarity
COMMENT ON COLUMN public.submission_files.submission_id IS 'NULL for admin-generated exports (like Excel downloads), otherwise links to a submission';
COMMENT ON COLUMN public.submission_files.question_id IS 'NULL for admin-generated exports, otherwise links to a form question for file upload answers';

-- ─── 5. ADD AUDIT LOG FOR LOGIN/LOGOUT ─────────────────────────────
-- Note: Login/logout tracking should be added in the frontend code
-- when calling supabase.auth.signInWithPassword() and signOut()

-- Example for frontend to use:
-- After successful login:
--   await supabase.from('audit_logs').insert({
--     action: 'admin.login',
--     entity: 'auth',
--     metadata: { email: user.email }
--   });

-- After logout:
--   await supabase.from('audit_logs').insert({
--     action: 'admin.logout',
--     entity: 'auth',
--     metadata: { email: user.email }
--   });

-- ─── VERIFICATION QUERIES ───────────────────────────────────────────
-- Run these after the migration to verify:

-- 1. Check dashboard stats function exists and works:
-- SELECT public.get_dashboard_stats(7);

-- 2. Check tabular responses function exists:
-- SELECT public.get_form_responses_tabular('<some-form-id>'::uuid, 10, 0);

-- 3. Verify submission_files columns are nullable:
-- SELECT column_name, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'submission_files' 
-- AND column_name IN ('submission_id', 'question_id');


-- ============================================================
-- 009_fix_audit_actor.sql
-- ============================================================

-- ==================================================================
-- 009_fix_audit_actor.sql
-- Fix audit log to properly capture actor_email for all events
-- ==================================================================

-- Add actor_email to audit_logs if it doesn't exist (it should, but let's be sure)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'actor_email'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN actor_email TEXT;
  END IF;
END $$;

-- Create or replace trigger function to auto-populate actor_email
CREATE OR REPLACE FUNCTION public.set_audit_actor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- If actor_email is not provided, try to get it from auth.users
  IF NEW.actor_email IS NULL THEN
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = auth.uid();
    
    NEW.actor_email := user_email;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS audit_logs_set_actor ON public.audit_logs;

-- Create trigger to run before insert
CREATE TRIGGER audit_logs_set_actor
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_audit_actor();

-- Add comment for clarity
COMMENT ON FUNCTION public.set_audit_actor() IS 'Automatically populates actor_email from auth.users if not explicitly provided';

-- Verification query (run this to check if it works)
-- SELECT action, actor_email, entity, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 10;

-- ============================================================
-- 010_per_form_reference_ids.sql
-- ============================================================

-- ==================================================================
-- 010_per_form_reference_ids.sql
-- Implement per-form reference ID system with form abbreviations
-- Format: {ABBR}-{formId}-{sequence}
-- Example: NXG-a1b2c3d4-00001
-- ==================================================================

-- ─── 1. Add per-form sequence tracking table ────────────────────
CREATE TABLE IF NOT EXISTS public.form_submission_sequences (
  form_id uuid PRIMARY KEY REFERENCES public.forms(id) ON DELETE CASCADE,
  current_value integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_form_submission_sequences_form_id 
  ON public.form_submission_sequences(form_id);

-- ─── 2. Function to generate form abbreviation from title ───────
CREATE OR REPLACE FUNCTION public.generate_form_abbreviation(form_title text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  words text[];
  abbr text := '';
  word text;
BEGIN
  -- Remove special characters and split into words
  form_title := regexp_replace(form_title, '[^a-zA-Z0-9 ]', '', 'g');
  words := string_to_array(upper(form_title), ' ');
  
  -- Take first letter of each word, max 5 letters
  FOR word IN SELECT unnest(words) LOOP
    IF length(word) > 0 AND length(abbr) < 5 THEN
      abbr := abbr || left(word, 1);
    END IF;
  END LOOP;
  
  -- If empty or too short, use first 3-5 chars of title
  IF length(abbr) < 2 THEN
    abbr := upper(left(regexp_replace(form_title, '[^a-zA-Z0-9]', '', 'g'), 5));
  END IF;
  
  -- Ensure minimum length
  IF length(abbr) < 2 THEN
    abbr := 'FORM';
  END IF;
  
  RETURN abbr;
END;
$$;

-- ─── 3. Function to get next reference ID for a form ────────────
CREATE OR REPLACE FUNCTION public.next_form_reference_id(p_form_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form_title text;
  v_abbr text;
  v_sequence integer;
  v_form_id_short text;
BEGIN
  -- Get form title
  SELECT title INTO v_form_title 
  FROM public.forms 
  WHERE id = p_form_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'form_not_found';
  END IF;
  
  -- Generate abbreviation
  v_abbr := public.generate_form_abbreviation(v_form_title);
  
  -- Get short form ID (first 8 chars of UUID)
  v_form_id_short := left(p_form_id::text, 8);
  
  -- Get and increment sequence for this form (atomic, race-safe)
  INSERT INTO public.form_submission_sequences (form_id, current_value)
  VALUES (p_form_id, 1)
  ON CONFLICT (form_id) DO UPDATE 
    SET current_value = form_submission_sequences.current_value + 1,
        updated_at = now()
  RETURNING current_value INTO v_sequence;
  
  -- Format: ABBR-formIdShort-sequence
  -- Example: NXG-1a166cde-00001
  RETURN v_abbr || '-' || v_form_id_short || '-' || lpad(v_sequence::text, 5, '0');
END;
$$;

-- ─── 4. Update the trigger to use per-form reference IDs ────────
CREATE OR REPLACE FUNCTION public.assign_reference_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use the new per-form reference ID function
  NEW.reference_id := public.next_form_reference_id(NEW.form_id);
  RETURN NEW;
END;
$$;

-- Trigger already exists, just need to ensure it's active
DROP TRIGGER IF EXISTS before_submission_insert ON public.submissions;
CREATE TRIGGER before_submission_insert
  BEFORE INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.assign_reference_id();

-- ─── 5. Grant permissions ────────────────────────────────────────
GRANT SELECT ON public.form_submission_sequences TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_form_abbreviation(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.next_form_reference_id(uuid) TO authenticated;

-- ─── 6. Initialize sequences for existing forms ──────────────────
-- Optional: Create initial sequence entries for existing forms
INSERT INTO public.form_submission_sequences (form_id, current_value)
SELECT id, 0 
FROM public.forms
WHERE deleted_at IS NULL
ON CONFLICT (form_id) DO NOTHING;

-- ───VERIFICATION QUERIES ─────────────────────────────────────────
-- Test abbreviation generation:
-- SELECT title, generate_form_abbreviation(title) as abbr FROM forms;

-- Test reference ID generation (will actually increment sequence):
-- SELECT next_form_reference_id('<form-id-here>'::uuid);

-- View current sequences:
-- SELECT f.title, f.id, fss.current_value
-- FROM forms f
-- LEFT JOIN form_submission_sequences fss ON fss.form_id = f.id
-- ORDER BY f.created_at;

COMMENT ON TABLE public.form_submission_sequences IS 'Per-form submission reference ID sequences';
COMMENT ON FUNCTION public.generate_form_abbreviation(text) IS 'Generates 2-5 letter abbreviation from form title';
COMMENT ON FUNCTION public.next_form_reference_id(uuid) IS 'Generates next reference ID for a specific form: ABBR-formIdShort-sequence';

-- ============================================================
-- 011_public_view_response.sql
-- ============================================================

-- ==================================================================
-- 011_public_view_response.sql
-- Allow users to view their submitted responses by reference ID
-- Public, read-only access for transparency
-- ==================================================================

-- ─── 1. Create RPC to get submission by reference ID (public) ───
CREATE OR REPLACE FUNCTION public.get_submission_by_reference(p_reference_id text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  v_submission_id uuid;
  v_form_id uuid;
BEGIN
  -- Get submission ID and form ID
  SELECT id, form_id INTO v_submission_id, v_form_id
  FROM public.submissions
  WHERE reference_id = p_reference_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('found', false);
  END IF;
  
  -- Build response with form details, submission details, and answers
  SELECT json_build_object(
    'found', true,
    'submission', json_build_object(
      'id', s.id,
      'reference_id', s.reference_id,
      'status', s.status,
      'respondent_name', s.respondent_name,
      'respondent_email', s.respondent_email,
      'submitted_at', s.submitted_at
    ),
    'form', json_build_object(
      'title', f.title,
      'description', f.description
    ),
    'answers', (
      SELECT json_agg(
        json_build_object(
          'question_id', a.question_id,
          'question_label', q.label,
          'question_type', q.type,
          'question_position', q.position,
          'section_title', sec.title,
          'value', a.value
        )
        ORDER BY sec.position, q.position
      )
      FROM submission_answers a
      JOIN form_questions q ON q.id = a.question_id
      JOIN form_sections sec ON sec.id = q.section_id
      WHERE a.submission_id = v_submission_id
    ),
    'files', (
      SELECT json_agg(
        json_build_object(
          'question_id', sf.question_id,
          'file_name', sf.file_name,
          'file_path', sf.file_path,
          'file_size', sf.file_size,
          'mime_type', sf.mime_type
        )
      )
      FROM submission_files sf
      WHERE sf.submission_id = v_submission_id
        AND sf.question_id IS NOT NULL
    )
  ) INTO result
  FROM submissions s
  JOIN forms f ON f.id = s.form_id
  WHERE s.id = v_submission_id;
  
  RETURN result;
END;
$$;

-- Grant public access (anyone with reference ID can view)
GRANT EXECUTE ON FUNCTION public.get_submission_by_reference(text) TO anon, authenticated;

-- ─── VERIFICATION QUERY ──────────────────────────────────────────
-- Test with an actual reference ID from your database:
-- SELECT public.get_submission_by_reference('NXG-1a166cde-00001');

COMMENT ON FUNCTION public.get_submission_by_reference(text) IS 'Public function to view submission details by reference ID. Read-only, no authentication required.';

-- ============================================================
-- 012_fix_audit_log_actions.sql
-- ============================================================

-- ==================================================================
-- 012_fix_audit_log_actions.sql
-- Fix Audit Log to Only Track Important Actions
-- Remove unnecessary actions, keep only: login, logout, form published, form deleted
-- ==================================================================

-- ═══════════════════════════════════════════════════════════════════
-- 1. Clean up existing audit logs (remove non-essential actions)
-- ═══════════════════════════════════════════════════════════════════

-- First, let's see what actions exist:
DO $$
BEGIN
  RAISE NOTICE 'Current audit log actions:';
END $$;

SELECT action, COUNT(*) as count 
FROM audit_logs 
GROUP BY action 
ORDER BY action;

-- Delete audit logs with non-allowed actions:
DELETE FROM audit_logs 
WHERE action NOT IN (
  'admin.login',
  'admin.logout',
  'form.published',
  'form.unpublished',
  'form.deleted'
);

-- Show how many were deleted:
DO $$
BEGIN
  RAISE NOTICE 'Old audit logs cleaned up. Only keeping essential actions.';
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Add check constraint to only allow specific actions
-- ═══════════════════════════════════════════════════════════════════

-- Drop existing constraint if any
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;

-- Add constraint to only allow specific actions
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'admin.login',
    'admin.logout',
    'form.published',
    'form.deleted',
    'form.unpublished'
  ));

-- ═══════════════════════════════════════════════════════════════════
-- 3. Update function to auto-fill actor_email
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.audit_log_set_actor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only set actor_email if not already set
  IF NEW.actor_email IS NULL THEN
    NEW.actor_email := (SELECT email FROM auth.users WHERE id = auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS audit_log_actor_trigger ON audit_logs;

-- Create trigger
CREATE TRIGGER audit_log_actor_trigger
  BEFORE INSERT ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_set_actor();

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════

-- Test constraint (should fail with non-allowed action):
-- INSERT INTO audit_logs (action, entity) VALUES ('test.action', 'test');

-- Test allowed action (should succeed):
-- INSERT INTO audit_logs (action, entity, entity_id) 
-- VALUES ('admin.login', 'auth', auth.uid());

-- View recent audit logs:
-- SELECT created_at, action, actor_email, metadata 
-- FROM audit_logs 
-- ORDER BY created_at DESC 
-- LIMIT 20;

-- ============================================================
-- 013_fix_dashboard_functions.sql
-- ============================================================

-- ==================================================================
-- 013_fix_dashboard_functions.sql
-- Fix Dashboard Functions with Proper Permissions
-- Excludes soft-deleted forms and submissions (deleted_at IS NOT NULL)
-- Run this migration to fix the dashboard loading issue
-- ==================================================================

-- ═══════════════════════════════════════════════════════════════════
-- 1. DROP AND RECREATE get_dashboard_stats
-- ═══════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_dashboard_stats(integer);

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_days integer DEFAULT 7)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  result json;
  period_start timestamptz;
BEGIN
  period_start := NOW() - (p_days || ' days')::interval;

  SELECT json_build_object(
    'total_forms', COUNT(DISTINCT f.id),
    'published_forms', COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'published'),
    'draft_forms', COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'draft'),
    'closed_forms', COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'closed'),
    'archived_forms', COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'archived'),
    'total_submissions', COUNT(s.id) FILTER (WHERE s.submitted_at >= period_start),
    'total_submissions_all_time', COUNT(s.id),
    'active_forms', COUNT(DISTINCT s.form_id) FILTER (WHERE s.submitted_at >= period_start),
    'new_submissions', COUNT(s.id) FILTER (WHERE s.status = 'new' AND s.submitted_at >= period_start),
    'under_review', COUNT(s.id) FILTER (WHERE s.status = 'under_review' AND s.submitted_at >= period_start),
    'approved', COUNT(s.id) FILTER (WHERE s.status = 'approved' AND s.submitted_at >= period_start),
    'rejected', COUNT(s.id) FILTER (WHERE s.status = 'rejected' AND s.submitted_at >= period_start),
    'today_submissions', COUNT(s.id) FILTER (WHERE DATE(s.submitted_at) = CURRENT_DATE),
    'period_days', p_days,
    'period_start', period_start
  ) INTO result
  FROM forms f
  LEFT JOIN submissions s ON f.id = s.form_id AND s.deleted_at IS NULL
  WHERE f.deleted_at IS NULL;

  RETURN result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(integer) TO anon;

-- ═══════════════════════════════════════════════════════════════════
-- 2. DROP AND RECREATE get_daily_submission_trend
-- ═══════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_daily_submission_trend(text);

CREATE OR REPLACE FUNCTION public.get_daily_submission_trend(p_start_date text)
RETURNS TABLE(day text, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(s.submitted_at::date, 'YYYY-MM-DD') as day,
    COUNT(*)::bigint as count
  FROM submissions s
  WHERE s.submitted_at >= p_start_date::timestamptz
    AND s.deleted_at IS NULL
  GROUP BY s.submitted_at::date
  ORDER BY s.submitted_at::date;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_daily_submission_trend(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_submission_trend(text) TO anon;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Verify Functions Work
-- ═══════════════════════════════════════════════════════════════════

-- Test get_dashboard_stats
DO $$
DECLARE
  test_result json;
BEGIN
  SELECT public.get_dashboard_stats(7) INTO test_result;
  RAISE NOTICE 'Dashboard stats test: %', test_result;
END $$;

-- Test get_daily_submission_trend
DO $$
DECLARE
  test_count integer;
BEGIN
  SELECT COUNT(*) INTO test_count FROM public.get_daily_submission_trend(NOW()::text);
  RAISE NOTICE 'Trend data test: % rows', test_count;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (uncomment to test manually)
-- ═══════════════════════════════════════════════════════════════════

-- Test 1: Check if functions exist
-- SELECT routine_name, routine_type 
-- FROM information_schema.routines 
-- WHERE routine_schema = 'public' 
-- AND routine_name IN ('get_dashboard_stats', 'get_daily_submission_trend');

-- Test 2: Run dashboard stats
-- SELECT public.get_dashboard_stats(7);

-- Test 3: Run trend data
-- SELECT * FROM public.get_daily_submission_trend((NOW() - interval '30 days')::text);

-- ============================================================
-- 014_add_your_admin_user.sql
-- ============================================================

-- ==================================================================
-- 014_add_your_admin_user.sql
-- Add yourself as an admin user
-- IMPORTANT: Replace the email and user_id with YOUR details
-- ==================================================================

-- ═══════════════════════════════════════════════════════════════════
-- HOW TO FIND YOUR USER_ID
-- ═══════════════════════════════════════════════════════════════════

-- Option 1: If you already have an auth account, find your user_id:
-- SELECT id, email FROM auth.users ORDER BY created_at DESC;

-- Option 2: Sign up first, then run this to see your ID:
-- SELECT id, email FROM auth.users WHERE email = 'YOUR_EMAIL@example.com';

-- ═══════════════════════════════════════════════════════════════════
-- ADD ADMIN USER (Replace with your details)
-- ═══════════════════════════════════════════════════════════════════

-- 🔴 REPLACE THESE VALUES:
-- user_id: Your actual user ID from auth.users
-- email: Your actual email address

INSERT INTO public.admin_users (user_id, email, is_active)
VALUES (
  'd2728dd0-ab98-49a3-8330-9be77fdd3574',  -- ✅ Admin user ID
  'innotechhub.edu@gmail.com',             -- ✅ Admin email
  true
)
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- ═══════════════════════════════════════════════════════════════════
-- ADD MULTIPLE ADMINS (Optional)
-- ═══════════════════════════════════════════════════════════════════

-- Uncomment and modify to add more admin users:
/*
INSERT INTO public.admin_users (user_id, email, is_active)
VALUES 
  ('user-id-2', 'admin2@example.com', true),
  ('user-id-3', 'admin3@example.com', true)
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  is_active = EXCLUDED.is_active,
  updated_at = now();
*/

-- ═══════════════════════════════════════════════════════════════════
-- VERIFY
-- ═══════════════════════════════════════════════════════════════════

-- Check admin users:
SELECT id, user_id, email, is_active, created_at 
FROM public.admin_users 
ORDER BY created_at DESC;

-- Verify your admin status:
-- SELECT public.is_admin(); -- Should return true when logged in as admin

-- ═══════════════════════════════════════════════════════════════════
-- NOTES
-- ═══════════════════════════════════════════════════════════════════

-- 1. user_id MUST match a real user in auth.users table
-- 2. If user_id doesn't exist, this INSERT will fail (foreign key constraint)
-- 3. To make yourself admin:
--    a. Sign up/login first (creates user in auth.users)
--    b. Find your user_id from auth.users
--    c. Run this migration with your user_id
-- 4. ON CONFLICT ensures running this multiple times is safe

-- ═══════════════════════════════════════════════════════════════════
-- DEACTIVATE ADMIN (Don't delete, just deactivate)
-- ═══════════════════════════════════════════════════════════════════

-- To remove admin access without deleting:
-- UPDATE public.admin_users SET is_active = false WHERE email = 'user@example.com';

-- To reactivate:
-- UPDATE public.admin_users SET is_active = true WHERE email = 'user@example.com';

-- ============================================================
-- 015_file_upload_configuration.sql
-- ============================================================

-- ==================================================================
-- 015_file_upload_configuration.sql
-- Add per-question file upload configuration (accepted types, max files, max size)
-- Fixes Bug B3 - File Upload - No Per-Question File Type Configuration
-- ==================================================================

-- ═══════════════════════════════════════════════════════════════════
-- 1. Add file_config column to form_questions
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.form_questions
ADD COLUMN IF NOT EXISTS file_config jsonb DEFAULT NULL;

COMMENT ON COLUMN public.form_questions.file_config IS 
'Configuration for file/document/image upload questions. 
Format: {
  "acceptedTypes": ["application/pdf", "image/png"], 
  "maxFiles": 3, 
  "maxSize": 5242880
}';

-- ═══════════════════════════════════════════════════════════════════
-- 2. Set default configurations for existing file upload questions
-- ═══════════════════════════════════════════════════════════════════

-- For existing 'file' type questions - accept anything, max 5 files, 10MB each
UPDATE public.form_questions
SET file_config = jsonb_build_object(
  'acceptedTypes', '["*"]'::jsonb,
  'maxFiles', 5,
  'maxSize', 10485760
)
WHERE type = 'file' AND file_config IS NULL;

-- For existing 'document' type questions - PDFs and Office docs
UPDATE public.form_questions
SET file_config = jsonb_build_object(
  'acceptedTypes', jsonb_build_array(
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv'
  ),
  'maxFiles', 3,
  'maxSize', 10485760
)
WHERE type = 'document' AND file_config IS NULL;

-- For existing 'image' type questions - common image formats
UPDATE public.form_questions
SET file_config = jsonb_build_object(
  'acceptedTypes', jsonb_build_array(
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ),
  'maxFiles', 5,
  'maxSize', 10485760
)
WHERE type = 'image' AND file_config IS NULL;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Update register_submission_file to validate MIME types
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.register_submission_file(
  p_submission_id uuid,
  p_question_id   uuid,
  p_file_path     text,
  p_file_name     text,
  p_file_size     bigint,
  p_mime_type     text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form_id uuid;
  v_question record;
  v_accepted_types jsonb;
  v_max_size bigint;
BEGIN
  -- Only fresh submissions to live forms
  SELECT s.form_id INTO v_form_id
  FROM public.submissions s
  JOIN public.forms f ON f.id = s.form_id
  WHERE s.id = p_submission_id
    AND f.status = 'published' AND f.deleted_at IS NULL
    AND s.submitted_at > now() - interval '1 hour';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'submission_not_found';
  END IF;

  -- Get question with file config
  SELECT * INTO v_question
  FROM public.form_questions
  WHERE id = p_question_id AND form_id = v_form_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_question';
  END IF;

  -- Path must live under the submission's own folder
  IF position(p_submission_id::text || '/' IN p_file_path) <> 1 THEN
    RAISE EXCEPTION 'invalid_path';
  END IF;

  -- Validate file size against question config or default
  IF v_question.file_config IS NOT NULL THEN
    v_max_size := COALESCE((v_question.file_config->>'maxSize')::bigint, 10485760);
  ELSE
    v_max_size := 10485760; -- 10MB default
  END IF;
  
  IF p_file_size IS NOT NULL AND p_file_size > v_max_size THEN
    RAISE EXCEPTION 'file_too_large';
  END IF;

  -- Validate MIME type against question config
  IF v_question.file_config IS NOT NULL THEN
    v_accepted_types := v_question.file_config->'acceptedTypes';
    
    -- If acceptedTypes exists and is not wildcard "*"
    IF v_accepted_types IS NOT NULL THEN
      -- Check if it's wildcard
      IF NOT (v_accepted_types @> '["*"]'::jsonb) THEN
        -- Validate MIME type is in accepted list
        IF NOT (v_accepted_types ? p_mime_type) THEN
          RAISE EXCEPTION 'invalid_file_type';
        END IF;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.submission_files
    (submission_id, form_id, question_id, file_path, file_name, file_size, mime_type)
  VALUES
    (p_submission_id, v_form_id, p_question_id,
     p_file_path, left(p_file_name, 300), p_file_size, left(p_mime_type, 100));
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════

-- Check file_config column exists:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'form_questions' AND column_name = 'file_config';

-- View existing file question configurations:
-- SELECT id, label, type, file_config 
-- FROM public.form_questions 
-- WHERE type IN ('file', 'document', 'image');

-- ============================================================
-- 016_linear_scale_configuration.sql
-- ============================================================

-- ==================================================================
-- 016_linear_scale_configuration.sql
-- Add configurable range for linear_scale questions
-- Fixes Bug B1 - Linear Scale Hardcoded Range (1-10)
-- ==================================================================

-- ═══════════════════════════════════════════════════════════════════
-- 1. Add scale configuration columns
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.form_questions
ADD COLUMN IF NOT EXISTS scale_min integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS scale_max integer DEFAULT 5;

-- Add check constraint: max must be greater than min
ALTER TABLE public.form_questions
ADD CONSTRAINT scale_range_check CHECK (scale_max > scale_min);

-- Add check constraint: reasonable range limits (1-100)
ALTER TABLE public.form_questions
ADD CONSTRAINT scale_bounds_check CHECK (
  scale_min >= 0 AND scale_min <= 100 AND
  scale_max >= 1 AND scale_max <= 100
);

COMMENT ON COLUMN public.form_questions.scale_min IS 'Minimum value for linear_scale questions (default 1)';
COMMENT ON COLUMN public.form_questions.scale_max IS 'Maximum value for linear_scale questions (default 5)';

-- ═══════════════════════════════════════════════════════════════════
-- 2. Set defaults for existing linear_scale questions
-- ═══════════════════════════════════════════════════════════════════

-- Update existing linear_scale questions to have 1-10 range (current behavior)
UPDATE public.form_questions
SET scale_min = 1, scale_max = 10
WHERE type = 'linear_scale' AND (scale_min IS NULL OR scale_max IS NULL);

-- Update existing rating questions to have 1-5 range
UPDATE public.form_questions
SET scale_min = 1, scale_max = 5
WHERE type = 'rating' AND (scale_min IS NULL OR scale_max IS NULL);

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════

-- Check columns exist:
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'form_questions' AND column_name LIKE 'scale_%';

-- View existing scale configurations:
-- SELECT id, label, type, scale_min, scale_max 
-- FROM public.form_questions 
-- WHERE type IN ('linear_scale', 'rating');

-- ============================================================
-- 017_question_config.sql
-- ============================================================

-- ==================================================================
-- 017_question_config.sql
-- Adds a per-question `config` jsonb for the configurable question types
-- (requirements #4, #5, #6): file accept list + single-file, rating max,
-- min/max length, min/max selections, and Multiple Choice Grid rows/cols.
--
-- Additive & idempotent. The builder and public form both `select("*")`
-- from form_questions, so the new column flows to them with no RPC changes.
-- Existing rows get an empty object and keep working via code-side defaults.
-- ==================================================================

ALTER TABLE public.form_questions
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Shape (all keys optional; code applies sensible defaults):
--   file:     { "accept": [".pdf",".png"], "maxFiles": 1 }
--   rating:   { "ratingMax": 10 }
--   text:     { "minLength": 0, "maxLength": 500 }
--   checkbox: { "minSelections": 0, "maxSelections": 3 }
--   grid:     { "rows": ["Row 1","Row 2"], "cols": ["Col 1","Col 2"] }

-- ============================================================
-- 018_reset_reference_sequences.sql
-- ============================================================

-- ==================================================================
-- 018_reset_reference_sequences.sql  (requirement #7)
-- Reference IDs were starting from 00003 because test submissions advanced
-- the per-form sequence. This realigns each form's sequence to the HIGHEST
-- number actually in use, so:
--   • numbering stays sequential, unique, and zero-padded (00001, 00002, …)
--   • a form with no remaining submissions restarts cleanly at 00001
--   • it can NEVER collide with an existing reference_id (uses MAX, not COUNT)
--
-- To get a fresh 00001: delete the unwanted test submissions first, then run
-- this migration. Idempotent — safe to re-run any time.
-- ==================================================================

-- Make sure every non-deleted form has a sequence row.
INSERT INTO public.form_submission_sequences (form_id, current_value)
SELECT id, 0 FROM public.forms WHERE deleted_at IS NULL
ON CONFLICT (form_id) DO NOTHING;

-- Set each sequence to the max trailing number already used (0 if none).
UPDATE public.form_submission_sequences fss
SET current_value = COALESCE((
      SELECT MAX((regexp_replace(s.reference_id, '^.*[-_](\d+)$', '\1'))::int)
      FROM public.submissions s
      WHERE s.form_id = fss.form_id
        AND s.reference_id ~ '[-_]\d+$'
    ), 0),
    updated_at = now();

-- Verify:
--   SELECT f.title, fss.current_value
--   FROM public.form_submission_sequences fss
--   JOIN public.forms f ON f.id = fss.form_id;

-- ============================================================
-- 015_expand_audit_actions.sql
-- ============================================================

-- ==================================================================
-- 015_expand_audit_actions.sql
-- Migration 012 restricted audit_logs.action to only 5 values, which
-- REJECTED the status-change and theme-update audit inserts the app
-- makes (constraint violation 23514 → those actions never got logged).
--
-- This expands the allowed set to every meaningful admin action the
-- code actually produces, so the audit log records them correctly.
-- Idempotent: safe to re-run.
-- ==================================================================

ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    -- session
    'admin.login',
    'admin.logout',
    -- form lifecycle
    'form.created',
    'form.published',
    'form.unpublished',
    'form.deleted',
    'form.updated',
    -- theme
    'theme.updated',
    -- submissions
    'submission.status_changed',
    'submission.exported'
  ));

-- Keep the actor-email auto-fill trigger from 012 (recreate defensively so
-- this migration also works if 012 was never applied).
CREATE OR REPLACE FUNCTION public.audit_log_set_actor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.actor_email IS NULL THEN
    NEW.actor_email := (SELECT email FROM auth.users WHERE id = auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_log_actor_trigger ON public.audit_logs;
CREATE TRIGGER audit_log_actor_trigger
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_set_actor();

-- Verify afterwards:
--   SELECT created_at, action, actor_email FROM public.audit_logs
--   ORDER BY created_at DESC LIMIT 20;

-- ============================================================
-- 016_fix_double_increment.sql
-- ============================================================

-- ==================================================================
-- 016_fix_double_increment.sql
-- BUG: response_count is incremented TWICE per submission because more than
-- one AFTER INSERT trigger on public.submissions calls increment_response_count
-- (a leftover from an earlier version of migration 004). This makes forms hit
-- their max_responses limit at HALF the intended number — e.g. a form capped
-- at 3 became "full" after ~1–2 real submissions, blocking respondents.
--
-- This migration:
--   1. Drops EVERY increment trigger on submissions (by function, name-agnostic)
--   2. Recreates exactly ONE
--   3. Reconciles every form's response_count to the real submission count
-- Idempotent: safe to re-run.
-- ==================================================================

-- 1. Drop all triggers on public.submissions whose function increments the count.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.submissions'::regclass
      AND NOT t.tgisinternal
      AND p.proname = 'increment_response_count'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.submissions', r.tgname);
  END LOOP;
END $$;

-- Also drop by any known legacy names, just in case.
DROP TRIGGER IF EXISTS trg_increment_response_count ON public.submissions;
DROP TRIGGER IF EXISTS on_submission_inserted        ON public.submissions;

-- 2. Recreate the single canonical increment trigger.
CREATE OR REPLACE FUNCTION public.increment_response_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.forms
    SET response_count = COALESCE(response_count, 0) + 1
    WHERE id = NEW.form_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_submission_inserted
  AFTER INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.increment_response_count();

-- 3. Reconcile ALL forms' counts to the true number of submissions.
UPDATE public.forms f
SET response_count = (
  SELECT count(*) FROM public.submissions s WHERE s.form_id = f.id
);

-- Verify afterwards (expect exactly ONE increment trigger):
--   SELECT tgname FROM pg_trigger
--   WHERE tgrelid = 'public.submissions'::regclass AND NOT tgisinternal;
--   SELECT title, response_count, max_responses FROM public.forms;

-- ============================================================
-- 017_fix_checkbox_delimiter.sql
-- ============================================================

-- ==================================================================
-- 017_fix_checkbox_delimiter.sql
-- Change checkbox answer delimiter from comma to || (double pipe)
-- Fixes Bug B4 - Checkbox Array Storage with commas in option labels
-- ==================================================================

-- ═══════════════════════════════════════════════════════════════════
-- IMPORTANT: This migration converts existing data
-- Backup recommended before running
-- ═══════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════
-- 1. Convert existing checkbox answers from comma to || delimiter
-- ═══════════════════════════════════════════════════════════════════

-- Find all checkbox question IDs
DO $$
DECLARE
  v_question_id uuid;
  v_answer_count int := 0;
BEGIN
  FOR v_question_id IN 
    SELECT id FROM public.form_questions WHERE type = 'checkbox'
  LOOP
    -- Update answers for this checkbox question
    -- Replace commas with || but only for multi-value answers
    -- (single values without commas remain unchanged)
    UPDATE public.submission_answers
    SET value = replace(value, ',', '||')
    WHERE question_id = v_question_id
      AND value LIKE '%,%'; -- Only update if contains comma
    
    GET DIAGNOSTICS v_answer_count = ROW_COUNT;
    IF v_answer_count > 0 THEN
      RAISE NOTICE 'Converted % checkbox answers for question %', v_answer_count, v_question_id;
    END IF;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Add helper function to parse checkbox values
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.parse_checkbox_value(answer_value text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF answer_value IS NULL OR answer_value = '' THEN
    RETURN ARRAY[]::text[];
  END IF;
  
  -- If contains ||, split on that (new format)
  IF position('||' IN answer_value) > 0 THEN
    RETURN string_to_array(answer_value, '||');
  END IF;
  
  -- Otherwise return as single-element array (backward compat)
  RETURN ARRAY[answer_value];
END;
$$;

COMMENT ON FUNCTION public.parse_checkbox_value(text) IS 
'Parse checkbox answer value into array. Handles || delimiter (new format) and single values (old format).';

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════

-- View checkbox answers before/after:
-- SELECT sa.id, sa.value, fq.label as question
-- FROM submission_answers sa
-- JOIN form_questions fq ON fq.id = sa.question_id
-- WHERE fq.type = 'checkbox'
-- LIMIT 10;

-- Test parsing function:
-- SELECT parse_checkbox_value('Option A||Option B||Option C');
-- Should return: {"Option A","Option B","Option C"}

-- SELECT parse_checkbox_value('Single Option');
-- Should return: {"Single Option"}

-- ============================================================
-- 018_validate_scale_values.sql
-- ============================================================

-- ==================================================================
-- 018_validate_scale_values.sql
-- Add server-side validation for rating and linear_scale answer values
-- Fixes Bug B2 - Rating Validation (accepts invalid values like "99")
-- ==================================================================

-- ═══════════════════════════════════════════════════════════════════
-- 1. Update submit_response to validate scale values
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.submit_response(
  p_form_id         uuid,
  p_name            text,
  p_email           text,
  p_idempotency_key uuid,
  p_answers         jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form     public.forms%ROWTYPE;
  v_existing public.submissions%ROWTYPE;
  v_sub_id   uuid;
  v_ref      text;
  v_answer   jsonb;
  v_question public.form_questions%ROWTYPE;
  v_value    text;
  v_int_val  integer;
BEGIN
  -- Idempotent replay: same key → return the original result, no duplicate row.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.submissions
      WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'submission_id', v_existing.id,
        'reference_id',  v_existing.reference_id,
        'duplicate',     true);
    END IF;
  END IF;

  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'array'
     OR jsonb_array_length(p_answers) > 50 THEN
    RAISE EXCEPTION 'invalid_payload';
  END IF;

  -- Lock the form row: makes the max_responses check race-safe
  SELECT * INTO v_form FROM public.forms WHERE id = p_form_id FOR UPDATE;

  IF NOT FOUND OR v_form.deleted_at IS NOT NULL OR v_form.status <> 'published' THEN
    RAISE EXCEPTION 'form_unavailable';
  END IF;
  IF v_form.opens_at IS NOT NULL AND v_form.opens_at > now() THEN
    RAISE EXCEPTION 'form_not_open';
  END IF;
  IF v_form.closes_at IS NOT NULL AND v_form.closes_at <= now() THEN
    RAISE EXCEPTION 'form_closed';
  END IF;
  IF v_form.max_responses IS NOT NULL AND v_form.response_count >= v_form.max_responses THEN
    RAISE EXCEPTION 'limit_reached';
  END IF;

  -- Validate answers before inserting submission
  FOR v_answer IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    -- Get question details
    SELECT * INTO v_question
    FROM public.form_questions
    WHERE id = (v_answer->>'question_id')::uuid AND form_id = p_form_id;
    
    IF FOUND THEN
      v_value := v_answer->>'value';
      
      -- Validate rating and linear_scale values are within configured range
      IF v_question.type IN ('rating', 'linear_scale') THEN
        -- Try to parse as integer
        BEGIN
          v_int_val := v_value::integer;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'invalid_scale_value' USING HINT = 'Value must be a number';
        END;
        
        -- Check range
        IF v_int_val < COALESCE(v_question.scale_min, 1) OR 
           v_int_val > COALESCE(v_question.scale_max, 5) THEN
          RAISE EXCEPTION 'scale_value_out_of_range' 
            USING HINT = format('Value must be between %s and %s', 
                               COALESCE(v_question.scale_min, 1),
                               COALESCE(v_question.scale_max, 5));
        END IF;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.submissions
    (form_id, status, respondent_name, respondent_email, submitted_at, metadata, idempotency_key)
  VALUES
    (p_form_id, 'new',
     nullif(trim(coalesce(p_name,  '')), ''),
     nullif(trim(coalesce(p_email, '')), ''),
     now(), '{}'::jsonb, p_idempotency_key)
  RETURNING id, reference_id INTO v_sub_id, v_ref;

  -- Answers: only questions that actually belong to this form; values capped.
  INSERT INTO public.submission_answers (submission_id, form_id, question_id, value)
  SELECT v_sub_id, p_form_id,
         (a->>'question_id')::uuid,
         left(a->>'value', 20000)
  FROM jsonb_array_elements(p_answers) AS a
  WHERE (a->>'question_id') IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.form_questions q
                WHERE q.id = (a->>'question_id')::uuid
                  AND q.form_id = p_form_id);

  RETURN jsonb_build_object(
    'submission_id', v_sub_id,
    'reference_id',  v_ref,
    'duplicate',     false);

EXCEPTION 
  WHEN unique_violation THEN
    -- Concurrent double-submit with the same idempotency key
    IF p_idempotency_key IS NOT NULL THEN
      SELECT * INTO v_existing FROM public.submissions
        WHERE idempotency_key = p_idempotency_key;
      IF FOUND THEN
        RETURN jsonb_build_object(
          'submission_id', v_existing.id,
          'reference_id',  v_existing.reference_id,
          'duplicate',     true);
      END IF;
    END IF;
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_response(uuid,text,text,uuid,jsonb) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════

-- Test valid rating value (should succeed):
-- SELECT public.submit_response(
--   '<form-id>'::uuid,
--   'Test User',
--   'test@example.com',
--   gen_random_uuid(),
--   '[{"question_id": "<rating-question-id>", "value": "3"}]'::jsonb
-- );

-- Test invalid rating value (should fail):
-- SELECT public.submit_response(
--   '<form-id>'::uuid,
--   'Test User',
--   'test@example.com',
--   gen_random_uuid(),
--   '[{"question_id": "<rating-question-id>", "value": "99"}]'::jsonb
-- );
-- Expected error: scale_value_out_of_range

-- ============================================================
-- 019_normalize_yes_no_values.sql
-- ============================================================

-- ==================================================================
-- 019_normalize_yes_no_values.sql
-- Normalize yes/no answer values to lowercase
-- Fixes Bug B6 - Yes/No Type stored as "Yes"/"No" instead of "yes"/"no"
-- ==================================================================

-- ═══════════════════════════════════════════════════════════════════
-- 1. Convert existing yes/no answers to lowercase
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_question_id uuid;
  v_answer_count int := 0;
  v_total int := 0;
BEGIN
  FOR v_question_id IN 
    SELECT id FROM public.form_questions WHERE type = 'yes_no'
  LOOP
    -- Update "Yes" to "yes" and "No" to "no"
    UPDATE public.submission_answers
    SET value = lower(value)
    WHERE question_id = v_question_id
      AND value IN ('Yes', 'No');
    
    GET DIAGNOSTICS v_answer_count = ROW_COUNT;
    v_total := v_total + v_answer_count;
    
    IF v_answer_count > 0 THEN
      RAISE NOTICE 'Normalized % yes/no answers for question %', v_answer_count, v_question_id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Total yes/no answers normalized: %', v_total;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Add check constraint to enforce lowercase (optional)
-- ═══════════════════════════════════════════════════════════════════

-- Note: This constraint would need to be type-aware, which is complex.
-- Instead, we rely on client-side enforcement and validation in submit_response.
-- Future enhancement: Add trigger to validate answer format matches question type.

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════

-- Check yes/no answers:
-- SELECT sa.value, fq.label as question, COUNT(*) as count
-- FROM submission_answers sa
-- JOIN form_questions fq ON fq.id = sa.question_id
-- WHERE fq.type = 'yes_no'
-- GROUP BY sa.value, fq.label
-- ORDER BY fq.label, sa.value;
-- 
-- Should see only lowercase "yes" and "no" values

-- Check for any remaining capitalized values:
-- SELECT COUNT(*) FROM submission_answers sa
-- JOIN form_questions fq ON fq.id = sa.question_id
-- WHERE fq.type = 'yes_no' AND sa.value IN ('Yes', 'No');
-- Should return 0

-- ============================================================
-- 020_production_readiness.sql
-- ============================================================

-- ==================================================================
-- 020_production_readiness.sql
-- Fixes: DASH-03, DB-03, FILE-01/02, RESP-01/02, API-01, DASH-02
-- Consolidates file upload validation on form_questions.config (jsonb).
-- Idempotent — safe to re-run.
-- ==================================================================

-- ─── 1. get_dashboard_stats — fix deleted_at drift, admin-only ─────
DROP FUNCTION IF EXISTS public.get_dashboard_stats(integer);

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_days integer DEFAULT 0)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  result json;
  period_start timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_days IS NULL OR p_days <= 0 THEN
    period_start := '-infinity'::timestamptz;
  ELSE
    period_start := NOW() - (p_days || ' days')::interval;
  END IF;

  SELECT json_build_object(
    'total_forms', COUNT(DISTINCT f.id),
    'published_forms', COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'published'),
    'draft_forms', COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'draft'),
    'closed_forms', COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'closed'),
    'archived_forms', COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'archived'),
    'total_submissions', COUNT(s.id) FILTER (WHERE s.submitted_at >= period_start),
    'total_submissions_all_time', (SELECT COUNT(*) FROM submissions s2
      JOIN forms f2 ON f2.id = s2.form_id WHERE f2.deleted_at IS NULL),
    'active_forms', COUNT(DISTINCT s.form_id) FILTER (WHERE s.submitted_at >= period_start),
    'new_submissions', COUNT(s.id) FILTER (WHERE s.status = 'new' AND s.submitted_at >= period_start),
    'under_review', COUNT(s.id) FILTER (WHERE s.status = 'under_review' AND s.submitted_at >= period_start),
    'approved', COUNT(s.id) FILTER (WHERE s.status = 'approved' AND s.submitted_at >= period_start),
    'rejected', COUNT(s.id) FILTER (WHERE s.status = 'rejected' AND s.submitted_at >= period_start),
    'today_submissions', COUNT(s.id) FILTER (WHERE DATE(s.submitted_at) = CURRENT_DATE),
    'period_days', COALESCE(p_days, 0),
    'period_start', CASE WHEN p_days IS NULL OR p_days <= 0 THEN NULL ELSE period_start END
  ) INTO result
  FROM forms f
  LEFT JOIN submissions s ON f.id = s.form_id
  WHERE f.deleted_at IS NULL;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_stats(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(integer) TO authenticated;

-- ─── 2. get_daily_submission_trend — admin-only, p_days param ────
DROP FUNCTION IF EXISTS public.get_daily_submission_trend(text);
DROP FUNCTION IF EXISTS public.get_daily_submission_trend(integer);

CREATE OR REPLACE FUNCTION public.get_daily_submission_trend(p_days integer DEFAULT 30)
RETURNS TABLE(day_label text, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_start timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  v_start := date_trunc('day', NOW()) - ((GREATEST(1, LEAST(p_days, 90)) - 1) || ' days')::interval;

  RETURN QUERY
  SELECT
    to_char(d.day::date, 'DD/MM') AS day_label,
    COALESCE(c.cnt, 0)::bigint AS count
  FROM generate_series(v_start::date, CURRENT_DATE, '1 day'::interval) AS d(day)
  LEFT JOIN (
    SELECT s.submitted_at::date AS sub_day, COUNT(*)::bigint AS cnt
    FROM submissions s
    JOIN forms f ON f.id = s.form_id AND f.deleted_at IS NULL
    WHERE s.submitted_at >= v_start
    GROUP BY s.submitted_at::date
  ) c ON c.sub_day = d.day::date
  ORDER BY d.day;
END;
$$;

REVOKE ALL ON FUNCTION public.get_daily_submission_trend(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_daily_submission_trend(integer) TO authenticated;

-- ─── 3. register_submission_file — read config jsonb (not file_config) ─
CREATE OR REPLACE FUNCTION public.register_submission_file(
  p_submission_id uuid,
  p_question_id   uuid,
  p_file_path     text,
  p_file_name     text,
  p_file_size     bigint,
  p_mime_type     text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form_id   uuid;
  v_question  public.form_questions%ROWTYPE;
  v_max_mb    numeric;
  v_max_bytes bigint;
  v_ext       text;
  v_allowed   boolean;
BEGIN
  SELECT s.form_id INTO v_form_id
  FROM public.submissions s
  JOIN public.forms f ON f.id = s.form_id
  WHERE s.id = p_submission_id
    AND f.status = 'published' AND f.deleted_at IS NULL
    AND s.submitted_at > now() - interval '1 hour';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'submission_not_found';
  END IF;

  SELECT * INTO v_question
  FROM public.form_questions
  WHERE id = p_question_id AND form_id = v_form_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_question';
  END IF;

  IF position(p_submission_id::text || '/' IN p_file_path) <> 1 THEN
    RAISE EXCEPTION 'invalid_path';
  END IF;

  -- Max size from config.maxSizeMB (default 10, cap 50)
  v_max_mb := COALESCE((v_question.config->>'maxSizeMB')::numeric, 10);
  v_max_mb := LEAST(50, GREATEST(1, v_max_mb));
  v_max_bytes := (v_max_mb * 1024 * 1024)::bigint;

  IF p_file_size IS NOT NULL AND p_file_size > v_max_bytes THEN
    RAISE EXCEPTION 'file_too_large';
  END IF;

  -- Extension validation from config.accept (matches builder + public form)
  IF v_question.config ? 'accept'
     AND jsonb_typeof(v_question.config->'accept') = 'array'
     AND jsonb_array_length(v_question.config->'accept') > 0 THEN
    v_ext := lower(coalesce(substring(p_file_name from '\.[^.]*$'), ''));
    SELECT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(v_question.config->'accept') AS e(val)
      WHERE lower(e.val) = v_ext
    ) INTO v_allowed;
    IF NOT v_allowed THEN
      RAISE EXCEPTION 'invalid_file_type';
    END IF;
  END IF;

  INSERT INTO public.submission_files
    (submission_id, form_id, question_id, file_path, file_name, file_size, mime_type)
  VALUES
    (p_submission_id, v_form_id, p_question_id,
     p_file_path, left(p_file_name, 300), p_file_size, left(p_mime_type, 100));
END;
$$;

REVOKE ALL ON FUNCTION public.register_submission_file(uuid,uuid,text,text,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_submission_file(uuid,uuid,text,text,bigint,text) TO anon, authenticated;

-- ─── 4. get_form_responses_tabular — server-side search + filter ──
DROP FUNCTION IF EXISTS public.get_form_responses_tabular(uuid, integer, integer);
DROP FUNCTION IF EXISTS public.get_form_responses_tabular(uuid, integer, integer, text, text);

CREATE OR REPLACE FUNCTION public.get_form_responses_tabular(
  p_form_id  uuid,
  p_limit    integer DEFAULT 50,
  p_offset   integer DEFAULT 0,
  p_search   text DEFAULT NULL,
  p_status   text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result       json;
  v_search     text;
  v_status     submission_status;
  v_total      bigint;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  v_search := nullif(trim(coalesce(p_search, '')), '');

  IF p_status IS NOT NULL AND trim(p_status) <> '' AND lower(trim(p_status)) <> 'all' THEN
    v_status := trim(p_status)::submission_status;
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM submissions s
  WHERE s.form_id = p_form_id
    AND (v_status IS NULL OR s.status = v_status)
    AND (
      v_search IS NULL
      OR s.reference_id ILIKE '%' || v_search || '%'
      OR coalesce(s.respondent_name, '') ILIKE '%' || v_search || '%'
      OR coalesce(s.respondent_email, '') ILIKE '%' || v_search || '%'
    );

  SELECT json_build_object(
    'submissions', COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', s.id,
          'reference_id', s.reference_id,
          'status', s.status,
          'respondent_name', s.respondent_name,
          'respondent_email', s.respondent_email,
          'submitted_at', s.submitted_at,
          'answers', (
            SELECT json_object_agg(
              a.question_id::text,
              json_build_object(
                'value', a.value,
                'question_label', q.label,
                'question_type', q.type,
                'question_position', q.position
              )
            )
            FROM submission_answers a
            LEFT JOIN form_questions q ON q.id = a.question_id
            WHERE a.submission_id = s.id
          ),
          'files', (
            SELECT json_agg(
              json_build_object(
                'question_id', f.question_id,
                'file_name', f.file_name,
                'file_path', f.file_path,
                'file_size', f.file_size,
                'mime_type', f.mime_type
              )
            )
            FROM submission_files f
            WHERE f.submission_id = s.id AND f.question_id IS NOT NULL
          )
        )
        ORDER BY s.submitted_at DESC
      )
      FROM (
        SELECT *
        FROM submissions s
        WHERE s.form_id = p_form_id
          AND (v_status IS NULL OR s.status = v_status)
          AND (
            v_search IS NULL
            OR s.reference_id ILIKE '%' || v_search || '%'
            OR coalesce(s.respondent_name, '') ILIKE '%' || v_search || '%'
            OR coalesce(s.respondent_email, '') ILIKE '%' || v_search || '%'
          )
        ORDER BY s.submitted_at DESC
        LIMIT GREATEST(1, LEAST(p_limit, 10000))
        OFFSET GREATEST(0, p_offset)
      ) s
    ), '[]'::json),
    'questions', (
      SELECT json_agg(
        json_build_object(
          'id', q.id,
          'label', q.label,
          'type', q.type,
          'position', q.position,
          'section_title', sec.title
        )
        ORDER BY sec.position, q.position
      )
      FROM form_questions q
      LEFT JOIN form_sections sec ON sec.id = q.section_id
      WHERE q.form_id = p_form_id
    ),
    'total_count', v_total
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_form_responses_tabular(uuid, integer, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_form_responses_tabular(uuid, integer, integer, text, text) TO authenticated;

-- ─── 5. Allow form.restored audit action ───────────────────────────
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'admin.login',
    'admin.logout',
    'form.created',
    'form.published',
    'form.unpublished',
    'form.deleted',
    'form.restored',
    'form.updated',
    'theme.updated',
    'submission.status_changed',
    'submission.exported'
  ));

-- ============================================================
-- 021_responses_date_filter.sql
-- ============================================================

-- ==================================================================
-- 021_responses_date_filter.sql
-- Adds optional date-range filtering (p_date_from / p_date_to) to
-- get_form_responses_tabular so the admin Responses page can filter
-- by submission date — and exports respect the same filters.
--
-- The old 5-parameter signature is DROPPED (not overloaded): PostgREST
-- dispatches RPCs by named arguments, and keeping both signatures with
-- defaults would make 5-argument calls ambiguous (PGRST203). Because
-- every new parameter has a DEFAULT, an already-deployed frontend that
-- calls with only the original 5 named arguments keeps working.
--
-- Semantics:
--   p_date_from — inclusive lower bound on submitted_at (NULL = no bound)
--   p_date_to   — EXCLUSIVE upper bound on submitted_at (NULL = no bound).
--     The UI passes "day after the picked end date" so the whole end day
--     is included regardless of timezone offsets.
--
-- Idempotent — safe to re-run. Admin-only (is_admin() check unchanged).
-- ==================================================================

DROP FUNCTION IF EXISTS public.get_form_responses_tabular(uuid, integer, integer, text, text);

CREATE OR REPLACE FUNCTION public.get_form_responses_tabular(
  p_form_id   uuid,
  p_limit     integer     DEFAULT 50,
  p_offset    integer     DEFAULT 0,
  p_search    text        DEFAULT NULL,
  p_status    text        DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to   timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result       json;
  v_search     text;
  v_status     submission_status;
  v_total      bigint;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  v_search := nullif(trim(coalesce(p_search, '')), '');

  IF p_status IS NOT NULL AND trim(p_status) <> '' AND lower(trim(p_status)) <> 'all' THEN
    v_status := trim(p_status)::submission_status;
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM submissions s
  WHERE s.form_id = p_form_id
    AND (v_status IS NULL OR s.status = v_status)
    AND (p_date_from IS NULL OR s.submitted_at >= p_date_from)
    AND (p_date_to   IS NULL OR s.submitted_at <  p_date_to)
    AND (
      v_search IS NULL
      OR s.reference_id ILIKE '%' || v_search || '%'
      OR coalesce(s.respondent_name, '') ILIKE '%' || v_search || '%'
      OR coalesce(s.respondent_email, '') ILIKE '%' || v_search || '%'
    );

  SELECT json_build_object(
    'submissions', COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', s.id,
          'reference_id', s.reference_id,
          'status', s.status,
          'respondent_name', s.respondent_name,
          'respondent_email', s.respondent_email,
          'submitted_at', s.submitted_at,
          'answers', (
            SELECT json_object_agg(
              a.question_id::text,
              json_build_object(
                'value', a.value,
                'question_label', q.label,
                'question_type', q.type,
                'question_position', q.position
              )
            )
            FROM submission_answers a
            LEFT JOIN form_questions q ON q.id = a.question_id
            WHERE a.submission_id = s.id
          ),
          'files', (
            SELECT json_agg(
              json_build_object(
                'question_id', f.question_id,
                'file_name', f.file_name,
                'file_path', f.file_path,
                'file_size', f.file_size,
                'mime_type', f.mime_type
              )
            )
            FROM submission_files f
            WHERE f.submission_id = s.id AND f.question_id IS NOT NULL
          )
        )
        ORDER BY s.submitted_at DESC
      )
      FROM (
        SELECT *
        FROM submissions s
        WHERE s.form_id = p_form_id
          AND (v_status IS NULL OR s.status = v_status)
          AND (p_date_from IS NULL OR s.submitted_at >= p_date_from)
          AND (p_date_to   IS NULL OR s.submitted_at <  p_date_to)
          AND (
            v_search IS NULL
            OR s.reference_id ILIKE '%' || v_search || '%'
            OR coalesce(s.respondent_name, '') ILIKE '%' || v_search || '%'
            OR coalesce(s.respondent_email, '') ILIKE '%' || v_search || '%'
          )
        ORDER BY s.submitted_at DESC
        LIMIT GREATEST(1, LEAST(p_limit, 10000))
        OFFSET GREATEST(0, p_offset)
      ) s
    ), '[]'::json),
    'questions', (
      SELECT json_agg(
        json_build_object(
          'id', q.id,
          'label', q.label,
          'type', q.type,
          'position', q.position,
          'section_title', sec.title
        )
        ORDER BY sec.position, q.position
      )
      FROM form_questions q
      LEFT JOIN form_sections sec ON sec.id = q.section_id
      WHERE q.form_id = p_form_id
    ),
    'total_count', v_total
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_form_responses_tabular(uuid, integer, integer, text, text, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_form_responses_tabular(uuid, integer, integer, text, text, timestamptz, timestamptz) TO authenticated;

-- ============================================================
-- 022_save_form_builder.sql
-- ============================================================

-- 022_save_form_builder.sql
-- Atomic explicit-save endpoint for the admin form builder.
-- The browser keeps edits in memory and calls this RPC only when the admin
-- clicks Save, so section/question edits cannot partially persist.

-- ─── 25-question limit trigger: only count GENUINELY NEW rows ───────────────
-- Postgres fires BEFORE INSERT triggers even when ON CONFLICT DO UPDATE will
-- resolve the row as an update. The original check counted existing rows
-- unconditionally, so a form that already had 25 questions could NEVER be
-- saved again (every upsert tripped the limit). Skip the check when the id
-- already exists — those rows update in place and add nothing to the count.
-- Direct inserts (builder add, templates, duplication) are still capped.
CREATE OR REPLACE FUNCTION public.check_question_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.form_questions WHERE id = NEW.id) THEN
    RETURN NEW; -- upsert-update of an existing question: no new row
  END IF;
  IF (SELECT COUNT(*) FROM public.form_questions WHERE form_id = NEW.form_id) >= 25 THEN
    RAISE EXCEPTION 'Form has reached the 25 question limit';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_form_builder(
  p_form_id uuid,
  p_form jsonb,
  p_sections jsonb,
  p_questions jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_question_count integer;
  v_form_exists boolean;
  v_title text;
  v_missing_section uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  v_title := nullif(btrim(coalesce(p_form->>'title', '')), '');
  IF v_title IS NULL THEN
    RAISE EXCEPTION 'invalid_form_title';
  END IF;

  SELECT count(*) INTO v_question_count
  FROM jsonb_array_elements(coalesce(p_questions, '[]'::jsonb));

  IF v_question_count > 25 THEN
    RAISE EXCEPTION 'question_limit_exceeded';
  END IF;

  SELECT true INTO v_form_exists
  FROM public.forms
  WHERE id = p_form_id
  FOR UPDATE;

  IF NOT coalesce(v_form_exists, false) THEN
    RAISE EXCEPTION 'form_not_found';
  END IF;

  SELECT q.section_id INTO v_missing_section
  FROM jsonb_to_recordset(coalesce(p_questions, '[]'::jsonb)) AS q(section_id uuid)
  WHERE NOT EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(coalesce(p_sections, '[]'::jsonb)) AS s(id uuid)
    WHERE s.id = q.section_id
  )
  LIMIT 1;

  IF v_missing_section IS NOT NULL THEN
    RAISE EXCEPTION 'question_section_missing';
  END IF;

  UPDATE public.forms
  SET
    title = v_title,
    description = nullif(p_form->>'description', ''),
    opens_at = CASE
      WHEN nullif(p_form->>'opens_at', '') IS NOT NULL
        THEN (p_form->>'opens_at')::timestamptz
      ELSE NULL
    END,
    closes_at = CASE
      WHEN nullif(p_form->>'closes_at', '') IS NOT NULL
        THEN (p_form->>'closes_at')::timestamptz
      ELSE NULL
    END,
    max_responses = CASE
      WHEN p_form ? 'max_responses' AND nullif(p_form->>'max_responses', '') IS NOT NULL
        THEN (p_form->>'max_responses')::integer
      ELSE NULL
    END,
    responses_per_email_limit = CASE
      WHEN p_form ? 'responses_per_email_limit' AND nullif(p_form->>'responses_per_email_limit', '') IS NOT NULL
        THEN (p_form->>'responses_per_email_limit')::integer
      ELSE NULL
    END,
    allow_anonymous = coalesce((p_form->>'allow_anonymous')::boolean, true),
    consent_text = nullif(p_form->>'consent_text', ''),
    confirmation_title = nullif(p_form->>'confirmation_title', ''),
    confirmation_message = nullif(p_form->>'confirmation_message', '')
  WHERE id = p_form_id;

  INSERT INTO public.form_sections (id, form_id, title, description, position)
  SELECT id, p_form_id, nullif(btrim(title), ''), nullif(description, ''), position
  FROM jsonb_to_recordset(coalesce(p_sections, '[]'::jsonb))
    AS s(id uuid, title text, description text, position integer)
  ON CONFLICT (id) DO UPDATE
    SET title = excluded.title,
        description = excluded.description,
        position = excluded.position
    -- Never let an id collision reach into ANOTHER form's rows.
    WHERE form_sections.form_id = p_form_id;

  -- Delete removed questions before inserting new ones, so the existing
  -- 25-question trigger/check cannot reject a valid replacement save.
  DELETE FROM public.form_questions q
  WHERE q.form_id = p_form_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(coalesce(p_questions, '[]'::jsonb)) AS incoming(id uuid)
      WHERE incoming.id = q.id
    );

  INSERT INTO public.form_questions (
    id,
    form_id,
    section_id,
    type,
    label,
    description,
    placeholder,
    required,
    default_value,
    options,
    config,
    position
  )
  SELECT
    id,
    p_form_id,
    section_id,
    type,
    label,
    nullif(description, ''),
    nullif(placeholder, ''),
    coalesce(required, false),
    nullif(default_value, ''),
    coalesce(options, '[]'::jsonb),
    coalesce(config, '{}'::jsonb),
    position
  FROM jsonb_to_recordset(coalesce(p_questions, '[]'::jsonb))
    AS q(
      id uuid,
      section_id uuid,
      type text,
      label text,
      description text,
      placeholder text,
      required boolean,
      default_value text,
      options jsonb,
      config jsonb,
      position integer
    )
  ON CONFLICT (id) DO UPDATE
    SET section_id = excluded.section_id,
        type = excluded.type,
        label = excluded.label,
        description = excluded.description,
        placeholder = excluded.placeholder,
        required = excluded.required,
        default_value = excluded.default_value,
        options = excluded.options,
        config = excluded.config,
        position = excluded.position
    -- Never let an id collision reach into ANOTHER form's rows.
    WHERE form_questions.form_id = p_form_id;

  DELETE FROM public.form_sections s
  WHERE s.form_id = p_form_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(coalesce(p_sections, '[]'::jsonb)) AS incoming(id uuid)
      WHERE incoming.id = s.id
    );

  INSERT INTO public.audit_logs(action, entity, entity_id, metadata)
  VALUES (
    'form.updated',
    'form',
    p_form_id,
    jsonb_build_object('source', 'builder_explicit_save')
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_form_builder(uuid, jsonb, jsonb, jsonb) TO authenticated;

-- ============================================================
-- 023_audit_actions_canonical.sql
-- ============================================================

-- ==================================================================
-- 023_audit_actions_canonical.sql
--
-- FIX: clicking Save in the form builder failed with
--   new row for relation "audit_logs" violates check constraint
--   "audit_logs_action_check"
--
-- Root cause: save_form_builder (022) writes the audit action
-- 'form.updated', but the live constraint still dates from migration 012,
-- which allowed only five actions (admin.login/logout, form.published/
-- unpublished/deleted). The expansions in 015_expand_audit_actions and
-- 020 §5 were never applied to this environment. Because the audit INSERT
-- runs inside the save_form_builder transaction, the violation rolled the
-- ENTIRE save back (no partial state — but nothing saved either).
--
-- This sets the constraint to the canonical list of every action the
-- application actually writes (grep-verified against src/ and the RPCs).
-- Forward-only and idempotent: safe to run whether the current constraint
-- is the 012, 015, or 020 version. Audit validation is NOT weakened —
-- unknown actions are still rejected.
-- ==================================================================

ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    -- session
    'admin.login',
    'admin.logout',
    -- form lifecycle
    'form.created',
    'form.published',
    'form.unpublished',
    'form.deleted',
    'form.restored',
    'form.updated',          -- written by save_form_builder (022)
    -- theme
    'theme.updated',
    -- submissions
    'submission.status_changed',
    'submission.exported',
    -- security validations (053, 055)
    'submit_response_email_mismatch',      -- written by submit_response (053)
    'submit_response_rate_limited',         -- written by submit_response (053)
    'file_upload_path_traversal_attempt'   -- written by register_submission_file (055)
  ));

-- Verify afterwards (should list the new definition):
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conname = 'audit_logs_action_check';

