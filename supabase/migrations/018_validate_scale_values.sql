-- ==================================================================
-- 018_validate_scale_values.sql
-- Add server-side validation for rating and linear_scale answer values
-- Fixes Bug B2 - Rating Validation (accepts invalid values like "99")
-- ==================================================================

-- ═══════════════════════════════════════════════════════════════════
-- 1. Update submit_response to validate scale values
-- ═══════════════════════════════════════════════════════════════════

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
  v_answer   jsonb;
  v_question public.form_questions%ROWTYPE;
  v_value    text;
  v_int_val  integer;
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

  -- Validate answers before inserting submission
  FOR v_answer IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    -- Get question details
    SELECT * INTO v_question
    FROM public.form_questions
    WHERE id = (v_answer->>'question_id')::uuid AND form_id = p_form_id;
    
    IF FOUND THEN
      v_value := v_answer->>'value';
      
      -- Validate rating and linear_scale values are within configured range
      IF v_question.type IN ('rating', 'linear_scale') THEN
        -- Try to parse as integer
        BEGIN
          v_int_val := v_value::integer;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'invalid_scale_value' USING HINT = 'Value must be a number';
        END;
        
        -- Check range
        IF v_int_val < COALESCE(v_question.scale_min, 1) OR 
           v_int_val > COALESCE(v_question.scale_max, 5) THEN
          RAISE EXCEPTION 'scale_value_out_of_range' 
            USING HINT = format('Value must be between %s and %s', 
                               COALESCE(v_question.scale_min, 1),
                               COALESCE(v_question.scale_max, 5));
        END IF;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.submissions
    (form_id, status, respondent_name, respondent_email, submitted_at, metadata, idempotency_key)
  VALUES
    (p_form_id, 'new',
     nullif(trim(coalesce(p_name,  '')), ''),
     nullif(trim(coalesce(p_email, '')), ''),
     now(), '{}'::jsonb, p_idempotency_key)
  RETURNING id, reference_id INTO v_sub_id, v_ref;

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

EXCEPTION 
  WHEN unique_violation THEN
    -- Concurrent double-submit with the same idempotency key
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

GRANT EXECUTE ON FUNCTION public.submit_response(uuid,text,text,uuid,jsonb) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════

-- Test valid rating value (should succeed):
-- SELECT public.submit_response(
--   '<form-id>'::uuid,
--   'Test User',
--   'test@example.com',
--   gen_random_uuid(),
--   '[{"question_id": "<rating-question-id>", "value": "3"}]'::jsonb
-- );

-- Test invalid rating value (should fail):
-- SELECT public.submit_response(
--   '<form-id>'::uuid,
--   'Test User',
--   'test@example.com',
--   gen_random_uuid(),
--   '[{"question_id": "<rating-question-id>", "value": "99"}]'::jsonb
-- );
-- Expected error: scale_value_out_of_range
