-- Migration 056: Fix reference_token encoding from hex to base64url
-- Issue: submit_response() uses encode(gen_random_bytes(24), 'base64url')
--        but PostgreSQL doesn't support 'base64url' encoding
--        Falls back to 'hex', producing hex strings instead of URL-safe tokens
--
-- Solution:
-- 1. Use 'base64' encoding (valid PostgreSQL encoding)
-- 2. Convert base64 to base64url (replace + with -, / with _, remove =)
-- 3. Update submit_response() RPC to use correct encoding

-- ─── Create helper function to convert base64 to base64url ─────────────────
DROP FUNCTION IF EXISTS public.to_base64url(bytea) CASCADE;

CREATE OR REPLACE FUNCTION public.to_base64url(data bytea)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT replace(replace(replace(encode(data, 'base64'), '+', '-'), '/', '_'), '=', '');
$$;

GRANT EXECUTE ON FUNCTION public.to_base64url(bytea) TO authenticated, anon;

-- ─── Update submit_response() to use correct token encoding ────────────────
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
  -- ─── 0. EMAIL VALIDATION: Verify submitted email matches authenticated session ─────
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
      -- Log potential tampering attempt
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
    -- Anonymous user: no direct submission allowed
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Authentication required. Please sign in first.',
      'submission_id', NULL
    );
  END IF;

  -- ─── 0.5. RATE LIMITING: Check if user has exceeded submission rate limit ───
  -- Limit: 10 submissions per hour per email
  SELECT COUNT(*) INTO v_submission_count
  FROM public.submission_rate_limit
  WHERE form_id = p_form_id
    AND email = LOWER(p_email)
    AND submission_time > now() - interval '1 hour';
  
  IF v_submission_count >= 10 THEN
    -- Log rate limit violation
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
  -- Fix 056: Use to_base64url() helper to properly encode token
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

REVOKE ALL ON FUNCTION public.submit_response(uuid,text,text,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_response(uuid,text,text,uuid,jsonb) TO authenticated;

COMMENT ON FUNCTION public.submit_response(uuid,text,text,uuid,jsonb) IS 'Form submission RPC. Requires authentication. Validates submitted email matches authenticated session. Returns reference_id and reference_token (URL-safe base64url token for public viewing).';

-- ─── Also update get_submission_by_token() to handle both formats ──────────
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
  -- Note: This will work with both old hex tokens and new base64url tokens
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
      'submitted_at', s.submitted_at,
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

-- Grant public access to the token-based RPC
GRANT EXECUTE ON FUNCTION public.get_submission_by_token(text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_submission_by_token(text) IS 'Public function to view submission details by reference token. Secure access using unpredictable tokens (works with both hex and base64url formats).';

-- ─── 5. Verification ──────────────────────────────────────────────────────────
SELECT 'Migration 056: Fixed reference_token encoding (hex → base64url)' as status;

-- Test the helper function
SELECT public.to_base64url(gen_random_bytes(24)) as sample_token;
