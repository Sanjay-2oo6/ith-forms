-- ============================================================
-- 045_google_oauth_rpcs.sql
-- Google OAuth RPC Functions
--
-- New RPCs:
-- 1. get_submission_count_for_email() — Check if user can submit
-- 2. verify_google_email() — Mark email as verified for session
--
-- Modified RPCs:
-- 1. submit_response() — Add per-email limit checking
--
-- Idempotent: safe to re-run
-- ============================================================

-- ─── 1. New RPC: get_submission_count_for_email ──────────────────────────────
-- Returns submission count for an email + form, and whether they can submit more.
-- Called on form load to display submission status.

CREATE OR REPLACE FUNCTION public.get_submission_count_for_email(
  p_form_id uuid,
  p_email   text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form         public.forms%ROWTYPE;
  v_email_record public.verified_emails%ROWTYPE;
  v_submission_count integer;
  v_limit        integer;
  v_can_submit   boolean;
BEGIN
  -- Fetch form to get limit
  SELECT * INTO v_form FROM public.forms WHERE id = p_form_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'form_unavailable';
  END IF;

  -- Fetch email record (count = 0 if not found)
  SELECT * INTO v_email_record FROM public.verified_emails
    WHERE form_id = p_form_id AND email = p_email;

  v_submission_count := COALESCE(v_email_record.submission_count, 0);
  v_limit := v_form.responses_per_email_limit;

  -- Determine if they can submit
  -- If limit IS NULL → unlimited → can_submit=true
  -- If limit IS NOT NULL AND count >= limit → can_submit=false
  -- Otherwise → can_submit=true
  v_can_submit := v_limit IS NULL OR v_submission_count < v_limit;

  RETURN jsonb_build_object(
    'email', p_email,
    'submission_count', v_submission_count,
    'limit', v_limit,
    'can_submit', v_can_submit,
    'message', CASE
      WHEN v_submission_count = 0 THEN 'First time submitting'
      WHEN v_can_submit AND v_limit IS NOT NULL THEN 
        'You have submitted ' || v_submission_count || ' of ' || v_limit || ' times'
      WHEN v_can_submit THEN
        'You have submitted ' || v_submission_count || ' times'
      ELSE
        'You have reached the submission limit for this form'
    END
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error', SQLERRM,
    'submission_count', 0,
    'can_submit', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_submission_count_for_email(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_submission_count_for_email(uuid, text) TO anon, authenticated;

-- ─── 2. New RPC: verify_google_email ─────────────────────────────────────────
-- Called after Google OAuth callback to verify email for the current session.
-- Returns the email + any prior submission count.

CREATE OR REPLACE FUNCTION public.verify_google_email(
  p_form_id uuid,
  p_email   text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form         public.forms%ROWTYPE;
  v_email_record public.verified_emails%ROWTYPE;
BEGIN
  -- Ensure form exists and is published
  SELECT * INTO v_form FROM public.forms
    WHERE id = p_form_id AND status = 'published' AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'form_unavailable';
  END IF;

  -- Fetch existing email record
  SELECT * INTO v_email_record FROM public.verified_emails
    WHERE form_id = p_form_id AND email = p_email;

  -- If first time: create record
  IF NOT FOUND THEN
    INSERT INTO public.verified_emails (form_id, email, submission_count)
      VALUES (p_form_id, p_email, 0)
      ON CONFLICT (form_id, email) DO NOTHING;
    
    RETURN jsonb_build_object(
      'email', p_email,
      'verified', true,
      'submission_count', 0,
      'limit', v_form.responses_per_email_limit
    );
  END IF;

  -- Email already verified; return status
  RETURN jsonb_build_object(
    'email', p_email,
    'verified', true,
    'submission_count', v_email_record.submission_count,
    'limit', v_form.responses_per_email_limit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_google_email(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_google_email(uuid, text) TO anon, authenticated;

-- ─── 3. Modified RPC: submit_response with per-email limit checking ──────────
-- Updated to:
-- 1. Extract email from Supabase auth session (verified by Google OAuth)
-- 2. Check verified_emails table for prior submissions
-- 3. Enforce per-email limit (forms.responses_per_email_limit)
-- 4. Increment submission count after successful insert

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
  v_form              public.forms%ROWTYPE;
  v_existing          public.submissions%ROWTYPE;
  v_email_record      public.verified_emails%ROWTYPE;
  v_sub_id            uuid;
  v_ref               text;
  v_submission_count  integer;
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

  -- ─── NEW: Per-email limit checking ───────────────────────────────────────
  -- Check if email has already submitted to this form
  SELECT * INTO v_email_record FROM public.verified_emails
    WHERE form_id = p_form_id AND email = p_email FOR UPDATE;

  -- If email found, check against limit
  IF FOUND THEN
    v_submission_count := v_email_record.submission_count;
    -- If limit is set (NOT NULL) and count >= limit, reject
    IF v_form.responses_per_email_limit IS NOT NULL 
       AND v_submission_count >= v_form.responses_per_email_limit THEN
      RAISE EXCEPTION 'email_limit_reached';
    END IF;
  ELSE
    -- First submission from this email → create record
    INSERT INTO public.verified_emails (form_id, email, submission_count)
      VALUES (p_form_id, p_email, 0)
      ON CONFLICT (form_id, email) DO NOTHING;
    v_submission_count := 0;
  END IF;

  -- ─── Insert submission ──────────────────────────────────────────────────────
  INSERT INTO public.submissions
    (form_id, status, respondent_name, respondent_email, submitted_at, metadata, idempotency_key)
  VALUES
    (p_form_id, 'new',
     nullif(trim(coalesce(p_name,  '')), ''),
     nullif(trim(coalesce(p_email, '')), ''),
     now(), '{}'::jsonb, p_idempotency_key)
  RETURNING id, reference_id INTO v_sub_id, v_ref;

  -- ─── Increment submission count ─────────────────────────────────────────────
  UPDATE public.verified_emails
    SET submission_count = submission_count + 1,
        last_submitted_at = now()
    WHERE form_id = p_form_id AND email = p_email;

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

-- ─── 4. Verification queries (manual checks after migration) ──────────────────
-- RUN THESE MANUALLY to verify the RPCs were created:
--
-- a) Check functions exist:
--    SELECT proname FROM pg_proc WHERE proname IN ('get_submission_count_for_email', 'verify_google_email', 'submit_response');
--    → should return all three functions
--
-- b) Test get_submission_count_for_email:
--    SELECT public.get_submission_count_for_email('<form-id>'::uuid, 'test@example.com');
--    → should return {"email":"test@example.com","submission_count":0,"limit":null,"can_submit":true,"message":"First time submitting"}

SELECT 'Migration 045: Google OAuth RPCs - Complete' as status;
