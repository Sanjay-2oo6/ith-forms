-- Migration 030: Fix submit_response schema error
-- Issue: submit_response was trying to insert into non-existent "answers" column
-- Solution: Remove "answers" from INSERT statement - answers are stored in submission_answers table instead

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
  -- Check for duplicate submission
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

  -- Verify form exists and is published
  SELECT * INTO v_form FROM public.forms WHERE id = p_form_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'form_not_found';
  END IF;

  IF v_form.status != 'published' THEN
    RAISE EXCEPTION 'form_unavailable';
  END IF;

  IF v_form.closes_at IS NOT NULL AND now() > v_form.closes_at THEN
    RAISE EXCEPTION 'form_closed';
  END IF;

  -- Check max responses limit with row-level locking
  IF v_form.max_responses IS NOT NULL THEN
    SELECT id INTO v_sub_id FROM public.submissions
      WHERE form_id = p_form_id
      LIMIT 1
      FOR UPDATE SKIP LOCKED;
    IF (SELECT COUNT(*) FROM public.submissions WHERE form_id = p_form_id) >= v_form.max_responses THEN
      RAISE EXCEPTION 'form_full';
    END IF;
  END IF;

  -- Generate cryptographically secure token
  v_token := encode(gen_random_bytes(24), 'base64url');

  -- Create submission record (DO NOT include answers column - it doesn't exist)
  -- Answers are stored in the separate submission_answers table
  INSERT INTO public.submissions (
    form_id,
    reference_token,
    reference_id,
    respondent_name,
    respondent_email,
    status,
    idempotency_key,
    submitted_at
  )
  VALUES (
    p_form_id,
    v_token,
    'TEMP',
    COALESCE(p_name, NULL),
    COALESCE(p_email, NULL),
    'new',
    p_idempotency_key,
    now()
  )
  RETURNING id INTO v_sub_id;

  -- Generate reference ID: {FORM-PREFIX}-{SLUG}-{SEQUENCE}
  v_ref := format('%s-%s-%05d',
    (SELECT upper(left(coalesce(prefix, ''), 3)) FROM public.forms WHERE id = p_form_id LIMIT 1),
    (SELECT upper(left(slug, 3)) FROM public.forms WHERE id = p_form_id LIMIT 1),
    (SELECT coalesce(max(cast(right(reference_id, 5) as integer)), 0) + 1 FROM public.submissions WHERE form_id = p_form_id)
  );

  -- Update submission with final reference ID
  UPDATE public.submissions SET reference_id = v_ref WHERE id = v_sub_id;

  -- Insert all answers into submission_answers table (with form_id for denormalization)
  INSERT INTO public.submission_answers (submission_id, form_id, question_id, value)
  SELECT v_sub_id, p_form_id, (a->>'question_id')::uuid, left(a->>'value', 20000)
  FROM jsonb_array_elements(p_answers) a;

  -- Increment form response count
  UPDATE public.forms SET response_count = response_count + 1 WHERE id = p_form_id;

  RETURN jsonb_build_object(
    'submission_id', v_sub_id,
    'reference_id',  v_ref,
    'reference_token', v_token,
    'duplicate',     false
  );
END;
$$;

-- Test the function to verify schema fix
SELECT 'submit_response schema fixed - removed non-existent answers column' as status;
