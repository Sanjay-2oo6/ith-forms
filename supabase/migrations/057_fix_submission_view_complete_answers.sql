-- Migration 057: Fix submission view to show complete answers with sections
-- Issue: get_submission_by_token() missing section_title, question_type, question_position
--        Only returns first section/question
--
-- Solution: Update RPC to include all required fields for proper rendering

DROP FUNCTION IF EXISTS public.get_submission_by_token(text) CASCADE;

CREATE OR REPLACE FUNCTION public.get_submission_by_token(p_reference_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  v_submission_id uuid;
  v_form_id uuid;
BEGIN
  -- Validate token is provided and not empty
  IF p_reference_token IS NULL OR p_reference_token = '' THEN
    RETURN jsonb_build_object('found', false, 'error', 'Invalid reference token');
  END IF;

  -- Get submission ID and form ID by reference_token
  SELECT id, form_id INTO v_submission_id, v_form_id
  FROM public.submissions
  WHERE reference_token = p_reference_token;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  
  -- Build response with form details, submission details, answers, and files
  SELECT jsonb_build_object(
    'found', true,
    'submission', jsonb_build_object(
      'id', s.id,
      'reference_id', s.reference_id,
      'status', s.status,
      'respondent_name', s.respondent_name,
      'respondent_email', s.respondent_email,
      'submitted_at', s.submitted_at,
      'updated_at', s.updated_at
    ),
    'form', jsonb_build_object(
      'id', f.id,
      'title', f.title,
      'description', f.description
    ),
    'answers', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'question_id', a.question_id,
          'question_label', q.label,
          'question_type', q.type,
          'question_position', q.position,
          'section_title', COALESCE(sec.title, ''),
          'value', a.value
        ) ORDER BY q.position
      )
      FROM public.submission_answers a
      LEFT JOIN public.form_questions q ON q.id = a.question_id
      LEFT JOIN public.form_sections sec ON sec.id = q.section_id
      WHERE a.submission_id = v_submission_id
    ), jsonb_build_array()),
    'files', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'question_id', sf.question_id,
          'file_name', sf.file_name,
          'file_path', sf.file_path,
          'file_size', sf.file_size,
          'mime_type', sf.mime_type
        )
      )
      FROM public.submission_files sf
      WHERE sf.submission_id = v_submission_id
    ), jsonb_build_array())
  ) INTO result
  FROM public.submissions s
  JOIN public.forms f ON f.id = s.form_id
  WHERE s.id = v_submission_id;
  
  RETURN result;
END;
$$;

-- Grant public access to the token-based RPC
GRANT EXECUTE ON FUNCTION public.get_submission_by_token(text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_submission_by_token(text) IS 'Public function to view submission details by reference token. Secure access using unpredictable tokens. Returns all answers with section info, question types, and attached files.';

SELECT 'Migration 057: Fixed submission view to include all sections and answers' as status;
