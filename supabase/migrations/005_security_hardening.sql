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
