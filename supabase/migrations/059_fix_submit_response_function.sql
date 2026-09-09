-- Migration 059: Fix submit_response() function
-- Issue: submit_response() is failing with "The submission service is being upgraded"
-- Root cause: Function may have syntax errors or missing dependencies
-- Solution: Recreate the function cleanly, keeping authentication required

-- ─── Ensure helper function exists (created in migration 056) ───────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'to_base64url' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    EXECUTE 'CREATE FUNCTION public.to_base64url(data bytea) RETURNS text LANGUAGE sql IMMUTABLE AS $func$ SELECT replace(replace(replace(encode(data, ''base64''), ''+'' , ''-''), ''/'', ''_''), ''='', ''''); $func$';
    GRANT EXECUTE ON FUNCTION public.to_base64url(bytea) TO authenticated, anon;
  END IF;
END
$$;

-- ─── Clean recreate of submit_response() ──────────────────────────────────
-- Authentication is REQUIRED - user must sign in with Google first
-- This function handles the submission after authentication

DROP FUNCTION IF EXISTS public.submit_response(uuid, text, text, uuid, jsonb) CASCADE;

CREATE OR REPLACE FUNCTION public.submit_response(
  p_form_id         uuid,
  p_name            text,
  p_email           text,
  p_idempotency_key uuid,
  p_answers         jsonb DEFAULT '{}'::jsonb
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
  v_authenticated_email text;
  v_current_user_id uuid;
BEGIN
  -- Authentication is REQUIRED - user must be signed in
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Authentication required. Please sign in first.',
      'submission_id', NULL
    );
  END IF;
  
  -- Get authenticated user's email
  SELECT email INTO v_authenticated_email FROM auth.users 
  WHERE id = v_current_user_id;
  
  IF v_authenticated_email IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Session email not found',
      'submission_id', NULL
    );
  END IF;
  
  -- Email MUST match authenticated session email (security check)
  IF LOWER(p_email) != LOWER(v_authenticated_email) THEN
    INSERT INTO public.audit_logs (action, entity, entity_id, metadata)
    VALUES (
      'submit_response_email_mismatch',
      'submission',
      p_form_id::text,
      jsonb_build_object(
        'submitted_email', p_email,
        'session_email', v_authenticated_email,
        'user_id', v_current_user_id,
        'timestamp', now()
      )
    );
    
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Email mismatch: submitted email does not match authenticated session',
      'submission_id', NULL
    );
  END IF;

  -- Rate limiting: 10 submissions per hour per email
  SELECT COUNT(*) INTO v_submission_count
  FROM public.submission_rate_limit
  WHERE form_id = p_form_id
    AND email = LOWER(p_email)
    AND submission_time > now() - interval '1 hour';
  
  IF v_submission_count >= 10 THEN
    INSERT INTO public.audit_logs (action, entity, entity_id, metadata)
    VALUES (
      'submit_response_rate_limited',
      'submission',
      p_form_id::text,
      jsonb_build_object(
        'email', LOWER(p_email),
        'user_id', v_current_user_id,
        'attempts_last_hour', v_submission_count
      )
    );
    
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Rate limit exceeded. Maximum 10 submissions per hour per email.',
      'submission_id', NULL
    );
  END IF;

  -- Check per-email submission limit
  SELECT max_responses INTO v_limit FROM public.forms WHERE id = p_form_id;
  
  IF v_limit IS NOT NULL AND v_limit > 0 THEN
    SELECT COUNT(*) INTO v_submission_count
    FROM public.submissions
    WHERE form_id = p_form_id 
      AND respondent_email = LOWER(p_email);
    
    IF v_submission_count >= v_limit THEN
      RETURN jsonb_build_object(
        'ok', false,
        'email', LOWER(p_email),
        'submission_count', v_submission_count,
        'error', 'Maximum responses reached');
    END IF;
  END IF;

  -- Check for duplicate idempotency key
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

  -- Generate secure token
  v_token := public.to_base64url(gen_random_bytes(24));

  -- Create submission record
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
    LOWER(nullif(trim(coalesce(p_email, '')), '')),
    'new',
    p_idempotency_key,
    now()
  )
  RETURNING id, reference_id INTO v_sub_id, v_ref;

  -- Insert all answers
  INSERT INTO public.submission_answers (submission_id, form_id, question_id, value)
    SELECT v_sub_id, p_form_id, (j->>'question_id')::uuid, j->>'value'
    FROM jsonb_array_elements(p_answers) AS j
    WHERE (j->>'question_id')::uuid IN (
      SELECT id FROM public.form_questions
      WHERE form_id = p_form_id);

  -- Increment submission count for this email
  INSERT INTO public.verified_emails (form_id, email, submission_count)
    VALUES (p_form_id, LOWER(p_email), 1)
    ON CONFLICT (form_id, email) DO UPDATE
    SET submission_count = submission_count + 1;

  -- Record submission for rate limiting
  INSERT INTO public.submission_rate_limit (form_id, email, submission_time)
    VALUES (p_form_id, LOWER(p_email), now())
    ON CONFLICT DO NOTHING;

  -- Return success
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

REVOKE ALL ON FUNCTION public.submit_response(uuid, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_response(uuid, text, text, uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.submit_response(uuid, text, text, uuid, jsonb) IS 'Form submission RPC. Requires authentication. Validates submitted email matches authenticated session. Returns reference_id and reference_token.';

SELECT 'Migration 059: Fixed submit_response() function error while keeping authentication required' as status;
