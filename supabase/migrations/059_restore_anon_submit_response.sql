-- Migration 059: Restore anon role access to submit_response() for public form submissions
-- Issue: Migration 056 restricted submit_response() to authenticated only
--        But public forms need anon role to call it
--        This broke public form submissions (error: "The submission service is being upgraded")

-- ─── Ensure helper function exists (created in migration 056) ───────────────
-- If to_base64url doesn't exist, create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'to_base64url' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    CREATE FUNCTION public.to_base64url(data bytea)
    RETURNS text
    LANGUAGE sql
    IMMUTABLE
    AS $$
      SELECT replace(replace(replace(encode(data, 'base64'), '+', '-'), '/', '_'), '=', '');
    $$;
  END IF;
END
$$;

-- ─── Fix 1: Grant execute permission to anon role ─────────────────────────
REVOKE ALL ON FUNCTION public.submit_response(uuid, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_response(uuid, text, text, uuid, jsonb) TO authenticated, anon;

-- ─── Fix 2: Update submit_response() to accept anon submissions ──────────────
-- Public form submissions will have auth.uid() = NULL (not authenticated)
-- The RPC should accept both authenticated AND anonymous submissions

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
  v_authenticated_email text;
  v_current_user_id uuid;
  v_can_submit boolean;
BEGIN
  -- ─── 0. EMAIL VALIDATION ────────────────────────────────────────────────────
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NOT NULL THEN
    -- User is authenticated: validate email matches session
    SELECT email INTO v_authenticated_email FROM auth.users 
    WHERE id = v_current_user_id;
    
    IF v_authenticated_email IS NULL THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'Session email not found',
        'submission_id', NULL
      );
    END IF;
    
    -- Email MUST match authenticated session email
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
  ELSE
    -- Anonymous user: allow submission (for public forms)
    -- p_email is provided by the user, no validation needed for anon
    NULL;
  END IF;

  -- ─── 0.5. RATE LIMITING ─────────────────────────────────────────────────────
  -- Limit: 10 submissions per hour per email
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

  -- ─── 1. Check per-email submission limit ───────────────────────────────────
  SELECT max_responses INTO v_limit FROM public.forms WHERE id = p_form_id;
  
  IF v_limit IS NOT NULL AND v_limit > 0 THEN
    SELECT COUNT(*) INTO v_submission_count
    FROM public.submissions
    WHERE form_id = p_form_id 
      AND respondent_email = LOWER(p_email);
    
    v_can_submit := v_limit IS NULL OR v_submission_count < v_limit;

    IF NOT v_can_submit THEN
      RETURN jsonb_build_object(
        'ok', false,
        'email', LOWER(p_email),
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

  -- ─── 3. Generate cryptographically secure token using base64url encoding ──
  v_token := public.to_base64url(gen_random_bytes(24));

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
    LOWER(nullif(trim(coalesce(p_email, '')), '')),
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
    VALUES (p_form_id, LOWER(p_email), 1)
    ON CONFLICT (form_id, email) DO UPDATE
    SET submission_count = submission_count + 1;

  -- ─── 6.5. Record submission for rate limiting ──────────────────────────────
  INSERT INTO public.submission_rate_limit (form_id, email, submission_time)
    VALUES (p_form_id, LOWER(p_email), now())
    ON CONFLICT DO NOTHING;

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

REVOKE ALL ON FUNCTION public.submit_response(uuid, text, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_response(uuid, text, text, uuid, jsonb) TO authenticated, anon;

COMMENT ON FUNCTION public.submit_response(uuid, text, text, uuid, jsonb) IS 'Form submission RPC. Accepts both authenticated and anonymous submissions. Returns reference_id and reference_token (URL-safe base64url token for public viewing).';

SELECT 'Migration 059: Restored anon role access to submit_response() for public submissions' as status;
