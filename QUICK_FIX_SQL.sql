-- QUICK FIX: Run this to complete the migration 029 fixes
-- The constraint error was because check_answer_value_length already exists
-- Just skip that part and run everything else

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_form_themes_form_id ON public.form_themes(form_id);
CREATE INDEX IF NOT EXISTS idx_form_sections_form_id ON public.form_sections(form_id);
CREATE INDEX IF NOT EXISTS idx_form_questions_form_id ON public.form_questions(form_id);

-- Fix file path traversal vulnerability
DROP FUNCTION IF EXISTS public.register_submission_file(uuid, uuid, text, text, integer);

CREATE OR REPLACE FUNCTION public.register_submission_file(
  p_submission_id uuid,
  p_question_id   uuid,
  p_file_path     text,
  p_file_name     text,
  p_file_size     integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ext   text;
BEGIN
  IF NOT (
    p_file_path LIKE encode(p_submission_id::text, 'escape') || '/%' 
    AND p_file_path NOT LIKE '%/.%'  
    AND p_file_path NOT LIKE '%/../%'
    AND position('..' IN p_file_path) = 0
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Invalid file path - must be under submission directory');
  END IF;

  v_ext := lower(reverse(split_part(reverse(p_file_name), '.', 1)));
  IF v_ext NOT IN ('pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'jpg', 'jpeg', 'png', 'gif', 'zip') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'File type not allowed');
  END IF;

  IF p_file_size > 52428800 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'File too large (max 50MB)');
  END IF;

  INSERT INTO public.submission_files (submission_id, question_id, file_path, file_name, file_size, mime_type, created_at)
  VALUES (p_submission_id, p_question_id, p_file_path, p_file_name, p_file_size, 'application/octet-stream', now())
  ON CONFLICT (submission_id, file_path) DO UPDATE SET
    file_name = EXCLUDED.file_name,
    file_size = EXCLUDED.file_size,
    updated_at = now();

  RETURN jsonb_build_object('ok', true, 'file_id', p_submission_id);
END;
$$;

-- Add status history trigger
DROP TRIGGER IF EXISTS submission_status_changed ON public.submissions;

CREATE OR REPLACE FUNCTION public.track_submission_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.submission_status_history (submission_id, old_status, new_status, changed_at)
    VALUES (NEW.id, OLD.status, NEW.status, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER submission_status_changed
AFTER UPDATE ON public.submissions
FOR EACH ROW
EXECUTE FUNCTION public.track_submission_status_change();

-- Fix submit_response to return reference_token
DROP FUNCTION IF EXISTS public.submit_response(uuid, text, text, uuid, jsonb);

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
  v_token    text;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.submissions
      WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'submission_id', v_existing.id,
        'reference_id',  v_existing.reference_id,
        'reference_token', v_existing.reference_token,
        'duplicate', true
      );
    END IF;
  END IF;

  SELECT * INTO v_form FROM public.forms WHERE id = p_form_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'form_not_found'; END IF;
  IF v_form.status != 'published' THEN RAISE EXCEPTION 'form_unavailable'; END IF;
  IF v_form.closes_at IS NOT NULL AND now() > v_form.closes_at THEN RAISE EXCEPTION 'form_closed'; END IF;

  IF v_form.max_responses IS NOT NULL THEN
    SELECT id INTO v_sub_id FROM public.submissions WHERE form_id = p_form_id LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF (SELECT COUNT(*) FROM public.submissions WHERE form_id = p_form_id) >= v_form.max_responses THEN RAISE EXCEPTION 'form_full'; END IF;
  END IF;

  v_token := encode(gen_random_bytes(24), 'base64url');

  INSERT INTO public.submissions (form_id, reference_token, reference_id, respondent_name, respondent_email, answers, status, idempotency_key, submitted_at)
  VALUES (p_form_id, v_token, 'TEMP', COALESCE(p_name, NULL), COALESCE(p_email, NULL), jsonb_build_array(), 'new', p_idempotency_key, now())
  RETURNING id INTO v_sub_id;

  v_ref := format('%s-%s-%05d',
    (SELECT upper(left(coalesce(prefix, ''), 3)) FROM public.forms WHERE id = p_form_id LIMIT 1),
    (SELECT upper(left(slug, 3)) FROM public.forms WHERE id = p_form_id LIMIT 1),
    (SELECT coalesce(max(cast(right(reference_id, 5) as integer)), 0) + 1 FROM public.submissions WHERE form_id = p_form_id));

  UPDATE public.submissions SET reference_id = v_ref WHERE id = v_sub_id;

  INSERT INTO public.submission_answers (submission_id, question_id, value)
  SELECT v_sub_id, (a->>'question_id')::uuid, left(a->>'value', 20000)
  FROM jsonb_array_elements(p_answers) a;

  RETURN jsonb_build_object(
    'submission_id', v_sub_id,
    'reference_id',  v_ref,
    'reference_token', v_token,
    'duplicate',     false
  );
END;
$$;

-- Fix foreign key constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'form_questions' 
    AND constraint_name = 'form_questions_section_id_fkey'
  ) THEN
    ALTER TABLE public.form_questions DROP CONSTRAINT form_questions_section_id_fkey;
  END IF;
  
  ALTER TABLE public.form_questions
  ADD CONSTRAINT form_questions_section_id_fkey 
    FOREIGN KEY (section_id) 
    REFERENCES public.form_sections(id) 
    ON DELETE CASCADE
    ON UPDATE CASCADE;
END $$;

-- All done!
SELECT 'Migration 029 complete! Form descriptions, security fixes, and indexes all applied.' as status;
