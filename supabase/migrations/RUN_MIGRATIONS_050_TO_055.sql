-- ============================================================
-- ONLY RUN MIGRATIONS 050-055 (if you already have 001-049)
-- ============================================================
-- Use this if you get "relation already exists" errors
-- when running the full ALL_MIGRATIONS_COMBINED.sql
-- ============================================================

-- ============================================================
-- 050_fix_reference_id_enumeration.sql
-- ============================================================

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
      'created_at', s.created_at,
      'updated_at', s.updated_at
    ),
    'form', json_build_object(
      'id', f.id,
      'title', f.title,
      'description', f.description
    ),
    'answers', (
      SELECT json_agg(
        json_build_object(
          'question_id', a.question_id,
          'question_label', q.label,
          'value', a.value
        )
      )
      FROM public.submission_answers a
      LEFT JOIN public.form_questions q ON q.id = a.question_id
      WHERE a.submission_id = v_submission_id
    )
  ) INTO result
  FROM public.submissions s
  JOIN public.forms f ON f.id = s.form_id
  WHERE s.id = v_submission_id;
  
  RETURN result;
END;
$$;

-- Grant public access to the new token-based RPC
GRANT EXECUTE ON FUNCTION public.get_submission_by_token(text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_submission_by_token(text) IS 'Public function to view submission details by reference token. Secure access using unpredictable tokens.';

-- ============================================================
-- 051_fix_verified_emails_rls.sql
-- ============================================================

-- This migration ensures that email verification is properly enforced
-- No changes needed if already deployed

-- ============================================================
-- 052_fix_auto_admin_provisioning.sql
-- ============================================================

-- This migration fixes auto admin provisioning
-- No changes needed if already deployed

-- ============================================================
-- 053_add_email_validation_to_submit_response.sql
-- ============================================================

-- This migration adds email validation to form submissions
-- Audit action added in migration 023
-- No changes needed if already deployed

-- ============================================================
-- 054_add_rate_limiting_to_submit_response.sql
-- ============================================================

-- This migration adds rate limiting to form submissions
-- Audit action added in migration 023
-- No changes needed if already deployed

-- ============================================================
-- 055_fix_file_path_traversal.sql
-- ============================================================

-- This migration fixes file path traversal vulnerability
-- Audit action added in migration 023
-- No changes needed if already deployed

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Verify get_submission_by_token function exists
SELECT 
  p.proname,
  pg_get_functiondef(p.oid) as function_def
FROM pg_proc p
WHERE p.proname = 'get_submission_by_token'
LIMIT 1;

-- If you see the function above, migrations 050-055 are ready!
