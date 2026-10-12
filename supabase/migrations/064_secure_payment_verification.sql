-- Migration 064: Secure Payment Verification in submit_response
-- Security: Prevent form submission bypass for payment questions via dev tools
-- Solution: Enforce payment verification server-side before allowing submission

-- ─── Drop and recreate submit_response with payment enforcement ─────────────
DROP FUNCTION IF EXISTS public.submit_response(uuid, text, text, uuid, jsonb) CASCADE;

CREATE OR REPLACE FUNCTION public.submit_response(
  p_form_id         uuid,
  p_name            text,
  p_email           text,
  p_idempotency_key uuid,
  p_answers         jsonb DEFAULT '{}'::jsonb,
  p_submission_id   uuid DEFAULT NULL  -- Optional: pre-generated submission ID for payment flow
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
  v_payment_question record;
  v_payment_count integer;
  v_payment_missing_questions text[];
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

  -- Generate secure token - use md5 which is always available
  -- Combines multiple UUIDs for 128-bit entropy
  v_token := md5(gen_random_uuid()::text || gen_random_uuid()::text || now()::text);

  -- Use provided submission_id or generate new one
  v_sub_id := COALESCE(p_submission_id, gen_random_uuid());

  -- Create submission record
  INSERT INTO public.submissions (
    id,  -- Use the provided/generated ID
    form_id,
    reference_token,
    reference_id,
    respondent_name,
    respondent_email,
    status,
    idempotency_key,
    submitted_at
  ) VALUES (
    v_sub_id,
    p_form_id,
    v_token,
    '', -- Will be auto-filled by trigger
    nullif(trim(coalesce(p_name, '')), ''),
    LOWER(nullif(trim(coalesce(p_email, '')), '')),
    'new',
    p_idempotency_key,
    now()
  )
  RETURNING reference_id INTO v_ref;

  -- Insert all answers
  INSERT INTO public.submission_answers (submission_id, form_id, question_id, value)
    SELECT v_sub_id, p_form_id, (j->>'question_id')::uuid, j->>'value'
    FROM jsonb_array_elements(p_answers) AS j
    WHERE (j->>'question_id')::uuid IN (
      SELECT id FROM public.form_questions
      WHERE form_id = p_form_id);

  -- ─── SECURITY ENFORCEMENT: Payment Verification ─────────────────────────────
  -- Check if this form has any payment questions with configured amounts.
  -- If so, verify that verified payment transactions exist for each one.
  -- This prevents dev-tools bypass of required payment questions.
  
  v_payment_missing_questions := ARRAY[]::text[];
  
  FOR v_payment_question IN
    SELECT id, label, config
    FROM public.form_questions
    WHERE form_id = p_form_id 
      AND type = 'payment'
      AND COALESCE((config->>'razorpayAmount')::integer, 0) >= 1
  LOOP
    -- Check if a verified payment transaction exists for this question
    SELECT COUNT(*) INTO v_payment_count
    FROM public.payment_transactions
    WHERE submission_id = v_sub_id
      AND question_id = v_payment_question.id
      AND verified = true
      AND status IN ('captured', 'authorized');
    
    -- If no verified payment found, this is a security violation
    IF v_payment_count = 0 THEN
      v_payment_missing_questions := array_append(
        v_payment_missing_questions, 
        v_payment_question.label
      );
    END IF;
  END LOOP;
  
  -- If any payment questions are missing verified transactions, 
  -- delete the submission and return error
  IF array_length(v_payment_missing_questions, 1) > 0 THEN
    -- Log the security violation
    INSERT INTO public.audit_logs (action, entity, entity_id, metadata)
    VALUES (
      'submit_response_payment_bypass_blocked',
      'submission',
      v_sub_id::text,
      jsonb_build_object(
        'form_id', p_form_id,
        'email', LOWER(p_email),
        'user_id', v_current_user_id,
        'missing_payments', v_payment_missing_questions,
        'blocked_at', now()
      )
    );
    
    -- Delete the just-created submission (rollback the write)
    DELETE FROM public.submissions WHERE id = v_sub_id;
    
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Payment verification required. Please complete payment for all required questions.',
      'submission_id', NULL,
      'payment_required', true
    );
  END IF;

  -- Increment submission count for this email
  INSERT INTO public.verified_emails (form_id, email, submission_count)
    VALUES (p_form_id, LOWER(p_email), 1)
    ON CONFLICT (form_id, email) DO UPDATE
    SET submission_count = verified_emails.submission_count + 1;

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

-- Grant permissions (same as before, but now includes the optional submission_id parameter)
REVOKE ALL ON FUNCTION public.submit_response(uuid, text, text, uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_response(uuid, text, text, uuid, jsonb, uuid) TO authenticated;

-- Also create overload for backward compatibility (without submission_id parameter)
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
BEGIN
  -- Delegate to the full function with NULL submission_id
  RETURN public.submit_response(p_form_id, p_name, p_email, p_idempotency_key, p_answers, NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_response(uuid, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_response(uuid, text, text, uuid, jsonb) TO authenticated;

-- ─── Comments and Documentation ───────────────────────────────────────────────
COMMENT ON FUNCTION public.submit_response(uuid, text, text, uuid, jsonb, uuid) IS 
'Form submission RPC with server-side payment verification. Prevents bypass of payment questions via dev tools. Optional submission_id parameter for payment-first workflow.';

COMMENT ON FUNCTION public.submit_response(uuid, text, text, uuid, jsonb) IS 
'Form submission RPC (backward compatible overload). Delegates to payment-secure version.';

-- ─── Migration Status ─────────────────────────────────────────────────────────
SELECT 'Migration 064: Secure payment verification added to submit_response' as status;

-- ─── Rollback Instructions ────────────────────────────────────────────────────
-- To rollback this migration, restore the previous submit_response function:
-- 1. Run the contents of migration 059_fix_submit_response_function.sql
-- 2. This will remove payment verification and restore the original behavior
-- 3. WARNING: This will re-enable the payment bypass vulnerability

-- ─── Security Notes ────────────────────────────────────────────────────────────
-- This migration closes the payment bypass vulnerability by:
-- 1. Checking for payment-type questions with razorpayAmount >= 1 paise
-- 2. Requiring verified payment transactions for each such question
-- 3. Using atomic DELETE + error return if payment verification fails
-- 4. Logging all bypass attempts in audit_logs for forensic analysis
-- 5. Maintaining backward compatibility for forms without payment questions