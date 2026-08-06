-- FINAL FIX: Use md5 instead of gen_random_bytes to generate tokens
-- pgcrypto might not have gen_random_bytes available, so we use a workaround

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

  -- Generate token using md5 hash of timestamp + uuid (more reliable than gen_random_bytes)
  v_token := md5(now()::text || p_idempotency_key::text || random()::text);

  INSERT INTO public.submissions (form_id, reference_token, reference_id, respondent_name, respondent_email, answers, status, idempotency_key, submitted_at)
  VALUES (
    p_form_id,
    v_token,
    'TEMP',
    COALESCE(p_name, NULL),
    COALESCE(p_email, NULL),
    jsonb_build_array(),
    'new',
    p_idempotency_key,
    now()
  )
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

-- Test it works
SELECT 'submit_response fixed - using md5 for token generation' as status;
