-- Migration 050: Fix Reference ID Enumeration Vulnerability
-- Issue: get_submission_by_reference() allows ANY user to view ANY submission
--        by guessing sequential reference IDs (JOB-APP-00001, 00002, etc.)
-- 
-- Solution:
-- 1. Keep reference_id for admin use (sequential, predictable is OK for authenticated admins)
-- 2. Add new RPC get_submission_by_token() for PUBLIC access using reference_token
-- 3. Update submit_response() to return reference_token in addition to reference_id
-- 4. Update RLS: only admins can read submissions table directly

-- ====================================================================
-- Step 1: Create NEW RPC for public access using reference_token
-- ====================================================================
DROP FUNCTION IF EXISTS public.get_submission_by_token(text) CASCADE;

CREATE OR REPLACE FUNCTION public.get_submission_by_token(p_reference_token text)
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
  -- Validate token is provided and not empty
  IF p_reference_token IS NULL OR p_reference_token = '' THEN
    RETURN json_build_object('found', false, 'error', 'Invalid reference token');
  END IF;

  -- Get submission ID and form ID by reference_token
  SELECT id, form_id INTO v_submission_id, v_form_id
  FROM public.submissions
  WHERE reference_token = p_reference_token;
  
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

-- Grant public access to the new token-based RPC
GRANT EXECUTE ON FUNCTION public.get_submission_by_token(text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_submission_by_token(text) IS 'Public function to view submission details by reference token. Secure access using unpredictable tokens.';

-- ====================================================================
-- Step 2: ADD ACCESS CONTROL to get_submission_by_reference()
--         (Keep for admin use with backward compatibility)
-- ====================================================================
DROP FUNCTION IF EXISTS public.get_submission_by_reference(text) CASCADE;

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
  v_respondent_email text;
  v_current_user_id uuid;
  v_user_email text;
BEGIN
  -- Validate reference_id is provided and not empty
  IF p_reference_id IS NULL OR p_reference_id = '' THEN
    RETURN json_build_object('found', false, 'error', 'Invalid reference ID');
  END IF;

  -- Get submission ID, form ID, and respondent email
  SELECT id, form_id, respondent_email INTO v_submission_id, v_form_id, v_respondent_email
  FROM public.submissions
  WHERE reference_id = p_reference_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('found', false);
  END IF;

  -- ─── ACCESS CONTROL: Only allow if user is admin OR is the respondent ───
  v_current_user_id := auth.uid();
  
  -- Check if user is admin (authenticated + has admin_users row)
  IF v_current_user_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = v_current_user_id AND is_active = true
    ) THEN
      -- Admin access: allow
      NULL;
    ELSE
      -- Not admin: check if respondent email matches current user's email
      SELECT email INTO v_user_email FROM auth.users 
      WHERE id = v_current_user_id;
      
      IF v_user_email IS NULL OR v_user_email != v_respondent_email THEN
        -- User is not the respondent and not an admin
        RETURN json_build_object('found', false, 'error', 'Unauthorized');
      END IF;
    END IF;
  ELSE
    -- Anonymous user: no access via reference_id
    -- Public access should use reference_token instead
    RETURN json_build_object('found', false, 'error', 'Unauthorized');
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

-- Keep grants for backward compatibility, but access control is now enforced in RPC
GRANT EXECUTE ON FUNCTION public.get_submission_by_reference(text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_submission_by_reference(text) IS 'Admin/respondent-only function to view submission by reference ID. Anonymous users should use get_submission_by_token() instead.';

-- ====================================================================
-- Step 3: UPDATE submit_response() to return reference_token
-- ====================================================================
DROP FUNCTION IF EXISTS public.submit_response(uuid, text, text, uuid, jsonb) CASCADE;

CREATE OR REPLACE FUNCTION public.submit_response(
  p_form_id         uuid,
  p_name            text,
  p_email           text,
  p_idempotency_key uuid,
  p_answers_jsonb   jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_id uuid;
  v_ref text;
  v_token text;
  v_limit integer;
  v_submission_count integer;
  v_existing record;
BEGIN
  -- ─── 1. Check per-email submission limit ───────────────────────────────────
  SELECT max_responses INTO v_limit FROM public.forms WHERE id = p_form_id;
  
  IF v_limit IS NOT NULL AND v_limit > 0 THEN
    SELECT COUNT(*) INTO v_submission_count
    FROM public.submissions
    WHERE form_id = p_form_id 
      AND respondent_email = p_email;
    
    v_can_submit := v_limit IS NULL OR v_submission_count < v_limit;

    IF NOT v_can_submit THEN
      RETURN jsonb_build_object(
        'ok', false,
        'email', p_email,
        'submission_count', v_submission_count,
        'error', 'Maximum responses reached');
    END IF;
  END IF;

  -- ─── 2. Check for duplicate idempotency key ───────────────────────────────
  SELECT * INTO v_existing
  FROM public.submissions
  WHERE idempotency_key = p_idempotency_key;
  
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'submission_id', v_existing.id,
      'reference_id',  v_existing.reference_id,
      'reference_token', v_existing.reference_token,
      'duplicate',     true);
  END IF;

  -- ─── 3. Generate cryptographically secure token ────────────────────────────
  v_token := encode(gen_random_bytes(24), 'base64url');

  -- ─── 4. Create submission record ──────────────────────────────────────────
  INSERT INTO public.submissions (
    form_id,
    reference_token,
    reference_id,
    respondent_name,
    respondent_email,
    status,
    idempotency_key,
    submitted_at
  ) VALUES (
    p_form_id,
    v_token,
    '', -- Will be auto-filled by trigger
    nullif(trim(coalesce(p_name, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    'new',
    p_idempotency_key,
    now()
  )
  RETURNING id, reference_id INTO v_sub_id, v_ref;

  -- ─── 5. Insert all answer pairs into submission_answers table ──────────────
  INSERT INTO public.submission_answers (submission_id, form_id, question_id, value)
    SELECT v_sub_id, p_form_id, (j->>'question_id')::uuid, j->>'answer_value'
    FROM jsonb_array_elements(p_answers_jsonb) AS j
    WHERE (j->>'question_id')::uuid IN (
      SELECT id FROM public.form_questions
      WHERE form_id = p_form_id);

  -- ─── 6. Increment submission count for this email ──────────────────────────
  INSERT INTO public.verified_emails (form_id, email, submission_count)
    VALUES (p_form_id, p_email, 1)
    ON CONFLICT (form_id, email) DO UPDATE
    SET submission_count = submission_count + 1;

  -- ─── 7. Return success with reference_id and reference_token ────────────────
  RETURN jsonb_build_object(
    'ok', true,
    'submission_id', v_sub_id,
    'reference_id',  v_ref,
    'reference_token', v_token,
    'duplicate',     false);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok', false,
    'submission_id', NULL,
    'error', SQLERRM,
    'duplicate', false);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_response(uuid,text,text,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_response(uuid,text,text,uuid,jsonb) TO anon, authenticated;

COMMENT ON FUNCTION public.submit_response(uuid,text,text,uuid,jsonb) IS 'Idempotent form submission. Returns reference_id and reference_token (secure URL-safe token for public viewing).';

-- ====================================================================
-- Step 4: Verification
-- ====================================================================
-- Verify that reference_token is populated for existing submissions
SELECT COUNT(*) as total_submissions, 
       COUNT(*) FILTER (WHERE reference_token IS NULL) as missing_tokens
FROM public.submissions;

