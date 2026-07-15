-- ==================================================================
-- 011_public_view_response.sql
-- Allow users to view their submitted responses by reference ID
-- Public, read-only access for transparency
-- ==================================================================

-- ─── 1. Create RPC to get submission by reference ID (public) ───
CREATE OR REPLACE FUNCTION public.get_submission_by_reference(p_reference_id text)
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
  -- Get submission ID and form ID
  SELECT id, form_id INTO v_submission_id, v_form_id
  FROM public.submissions
  WHERE reference_id = p_reference_id;
  
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
      'submitted_at', s.submitted_at
    ),
    'form', json_build_object(
      'title', f.title,
      'description', f.description
    ),
    'answers', (
      SELECT json_agg(
        json_build_object(
          'question_id', a.question_id,
          'question_label', q.label,
          'question_type', q.type,
          'question_position', q.position,
          'section_title', sec.title,
          'value', a.value
        )
        ORDER BY sec.position, q.position
      )
      FROM submission_answers a
      JOIN form_questions q ON q.id = a.question_id
      JOIN form_sections sec ON sec.id = q.section_id
      WHERE a.submission_id = v_submission_id
    ),
    'files', (
      SELECT json_agg(
        json_build_object(
          'question_id', sf.question_id,
          'file_name', sf.file_name,
          'file_path', sf.file_path,
          'file_size', sf.file_size,
          'mime_type', sf.mime_type
        )
      )
      FROM submission_files sf
      WHERE sf.submission_id = v_submission_id
        AND sf.question_id IS NOT NULL
    )
  ) INTO result
  FROM submissions s
  JOIN forms f ON f.id = s.form_id
  WHERE s.id = v_submission_id;
  
  RETURN result;
END;
$$;

-- Grant public access (anyone with reference ID can view)
GRANT EXECUTE ON FUNCTION public.get_submission_by_reference(text) TO anon, authenticated;

-- ─── VERIFICATION QUERY ──────────────────────────────────────────
-- Test with an actual reference ID from your database:
-- SELECT public.get_submission_by_reference('NXG-1a166cde-00001');

COMMENT ON FUNCTION public.get_submission_by_reference(text) IS 'Public function to view submission details by reference ID. Read-only, no authentication required.';
