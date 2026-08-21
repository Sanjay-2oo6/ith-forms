-- Migration 032: Fix get_form_responses_tabular function
-- This migration ensures the function exists with the correct signature
-- and proper RLS grants for authenticated users

DROP FUNCTION IF EXISTS public.get_form_responses_tabular(uuid, integer, integer, text, text);
DROP FUNCTION IF EXISTS public.get_form_responses_tabular(uuid, integer, integer, text, text, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.get_form_responses_tabular(
  p_form_id   uuid,
  p_limit     integer     DEFAULT 50,
  p_offset    integer     DEFAULT 0,
  p_search    text        DEFAULT NULL,
  p_status    text        DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to   timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result       json;
  v_search     text;
  v_status     submission_status;
  v_total      bigint;
BEGIN
  -- Verify admin access
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Normalize search term
  v_search := nullif(trim(coalesce(p_search, '')), '');

  -- Parse status filter
  IF p_status IS NOT NULL AND trim(p_status) <> '' AND lower(trim(p_status)) <> 'all' THEN
    BEGIN
      v_status := trim(p_status)::submission_status;
    EXCEPTION WHEN OTHERS THEN
      v_status := NULL;
    END;
  END IF;

  -- Count total matching submissions
  SELECT COUNT(*) INTO v_total
  FROM submissions s
  WHERE s.form_id = p_form_id
    AND (v_status IS NULL OR s.status = v_status)
    AND (p_date_from IS NULL OR s.submitted_at >= p_date_from)
    AND (p_date_to   IS NULL OR s.submitted_at <  p_date_to)
    AND (
      v_search IS NULL
      OR s.reference_id ILIKE '%' || v_search || '%'
      OR coalesce(s.respondent_name, '') ILIKE '%' || v_search || '%'
      OR coalesce(s.respondent_email, '') ILIKE '%' || v_search || '%'
    );

  -- Build the result JSON with submissions, questions, and total count
  SELECT json_build_object(
    'submissions', COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', s.id,
          'reference_id', s.reference_id,
          'status', s.status,
          'respondent_name', s.respondent_name,
          'respondent_email', s.respondent_email,
          'submitted_at', s.submitted_at,
          'answers', (
            SELECT json_object_agg(
              a.question_id::text,
              json_build_object(
                'value', a.value,
                'question_label', q.label,
                'question_type', q.type,
                'question_position', q.position
              )
            )
            FROM submission_answers a
            LEFT JOIN form_questions q ON q.id = a.question_id
            WHERE a.submission_id = s.id
          ),
          'files', (
            SELECT json_agg(
              json_build_object(
                'question_id', f.question_id,
                'file_name', f.file_name,
                'file_path', f.file_path,
                'file_size', f.file_size,
                'mime_type', f.mime_type
              )
            )
            FROM submission_files f
            WHERE f.submission_id = s.id AND f.question_id IS NOT NULL
          )
        )
        ORDER BY s.submitted_at DESC
      )
      FROM (
        SELECT *
        FROM submissions s
        WHERE s.form_id = p_form_id
          AND (v_status IS NULL OR s.status = v_status)
          AND (p_date_from IS NULL OR s.submitted_at >= p_date_from)
          AND (p_date_to   IS NULL OR s.submitted_at <  p_date_to)
          AND (
            v_search IS NULL
            OR s.reference_id ILIKE '%' || v_search || '%'
            OR coalesce(s.respondent_name, '') ILIKE '%' || v_search || '%'
            OR coalesce(s.respondent_email, '') ILIKE '%' || v_search || '%'
          )
        ORDER BY s.submitted_at DESC
        LIMIT GREATEST(1, LEAST(p_limit, 10000))
        OFFSET GREATEST(0, p_offset)
      ) s
    ), '[]'::json),
    'questions', (
      SELECT json_agg(
        json_build_object(
          'id', q.id,
          'label', q.label,
          'type', q.type,
          'position', q.position,
          'section_title', sec.title
        )
        ORDER BY sec.position, q.position
      )
      FROM form_questions q
      LEFT JOIN form_sections sec ON sec.id = q.section_id
      WHERE q.form_id = p_form_id
    ),
    'total_count', v_total
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execution permissions
REVOKE ALL ON FUNCTION public.get_form_responses_tabular(uuid, integer, integer, text, text, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_form_responses_tabular(uuid, integer, integer, text, text, timestamptz, timestamptz) TO authenticated;

-- Verify the function exists
SELECT 'get_form_responses_tabular function fixed and ready' as status;
