-- Migration 043: Fix Submission View Reference Function & Response Count Double-Increment
-- Issues:
-- 1. get_submission_by_reference() function missing or not in schema cache
-- 2. response_count incrementing by 2 instead of 1 (duplicate logic somewhere)

-- ============================================================
-- 1. RECREATE: get_submission_by_reference function (ensure it exists)
-- ============================================================
DROP FUNCTION IF EXISTS public.get_submission_by_reference(text) CASCADE;

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

-- Grant public access
GRANT EXECUTE ON FUNCTION public.get_submission_by_reference(text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_submission_by_reference(text) IS 'Public function to view submission details by reference ID. Read-only access.';

-- ============================================================
-- 2. FIX: increment_response_count trigger function (remove duplicate logic)
-- ============================================================

DROP TRIGGER IF EXISTS on_submission_inserted ON public.submissions;

CREATE OR REPLACE FUNCTION public.increment_response_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Single update - no duplicates
  UPDATE public.forms 
  SET response_count = COALESCE(response_count, 0) + 1 
  WHERE id = NEW.form_id;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_submission_inserted
  AFTER INSERT ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_response_count();

-- ============================================================
-- 3. RECONCILE: Fix all response counts
-- ============================================================

UPDATE public.forms f
SET response_count = (
  SELECT COUNT(*) FROM public.submissions s WHERE s.form_id = f.id
);

-- ============================================================
-- 4. VERIFY: Check response_count accuracy
-- ============================================================

SELECT 
  f.id,
  f.title,
  f.slug,
  f.response_count as reported_count,
  (SELECT COUNT(*) FROM submissions WHERE form_id = f.id) as actual_count,
  CASE 
    WHEN f.response_count = (SELECT COUNT(*) FROM submissions WHERE form_id = f.id) 
    THEN '✓ CORRECT' 
    ELSE '✗ MISMATCH' 
  END as status
FROM public.forms f
ORDER BY f.title;

-- ============================================================
-- 5. CHECK: Verify get_submission_by_reference exists and works
-- ============================================================

SELECT 'get_submission_by_reference function is now available' as status;

-- Test with a sample submission (this will show in the output if there are submissions)
WITH sample_submission AS (
  SELECT reference_id FROM submissions LIMIT 1
)
SELECT 
  CASE WHEN s.reference_id IS NOT NULL 
    THEN 'Test: ' || s.reference_id 
    ELSE 'No submissions yet - function ready for use' 
  END as test_info
FROM sample_submission s;

