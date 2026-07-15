-- ==================================================================
-- 008_complete_fixes.sql
-- COMPLETE FIX for all outstanding issues
-- Run this in Supabase SQL Editor
-- ==================================================================

-- ─── 1. DROP OLD FUNCTIONS (to avoid conflicts) ────────────────────
DROP FUNCTION IF EXISTS public.get_dashboard_stats();
DROP FUNCTION IF EXISTS public.get_dashboard_stats(integer);
DROP FUNCTION IF EXISTS public.get_form_responses_tabular(uuid, integer, integer);

-- ─── 2. ENHANCED DASHBOARD STATS WITH TIME FILTERING ───────────────
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_days integer DEFAULT 7)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  start_date timestamptz;
BEGIN
  -- Verify admin access
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  start_date := CURRENT_DATE - (p_days || ' days')::interval;

  SELECT json_build_object(
    -- Form counts by status
    'total_forms', (SELECT COUNT(*) FROM forms WHERE deleted_at IS NULL),
    'published_forms', (SELECT COUNT(*) FROM forms WHERE status = 'published' AND deleted_at IS NULL),
    'draft_forms', (SELECT COUNT(*) FROM forms WHERE status = 'draft' AND deleted_at IS NULL),
    'closed_forms', (SELECT COUNT(*) FROM forms WHERE status = 'closed' AND deleted_at IS NULL),
    'archived_forms', (SELECT COUNT(*) FROM forms WHERE status = 'archived' AND deleted_at IS NULL),
    
    -- Submission counts (time-filtered)
    'total_submissions', (SELECT COUNT(*) FROM submissions WHERE submitted_at >= start_date),
    'total_submissions_all_time', (SELECT COUNT(*) FROM submissions),
    
    -- Active forms (forms that received submissions in the period)
    'active_forms', (
      SELECT COUNT(DISTINCT form_id) 
      FROM submissions 
      WHERE submitted_at >= start_date
    ),
    
    -- Submission status breakdown (time-filtered)
    'new_submissions', (SELECT COUNT(*) FROM submissions WHERE status = 'new' AND submitted_at >= start_date),
    'under_review', (SELECT COUNT(*) FROM submissions WHERE status = 'under_review' AND submitted_at >= start_date),
    'approved', (SELECT COUNT(*) FROM submissions WHERE status = 'approved' AND submitted_at >= start_date),
    'rejected', (SELECT COUNT(*) FROM submissions WHERE status = 'rejected' AND submitted_at >= start_date),
    
    -- Today's activity
    'today_submissions', (SELECT COUNT(*) FROM submissions WHERE submitted_at >= CURRENT_DATE),
    
    -- Period information
    'period_days', p_days,
    'period_start', start_date
  ) INTO result;
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(integer) TO authenticated;

-- ─── 3. TABULAR RESPONSES VIEW FUNCTION ────────────────────────────
CREATE OR REPLACE FUNCTION public.get_form_responses_tabular(
  p_form_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Verify admin access
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Get all submissions with their answers grouped
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
        SELECT * FROM submissions
        WHERE form_id = p_form_id
        ORDER BY submitted_at DESC
        LIMIT p_limit OFFSET p_offset
      ) s
    ), '[]'::json),
    'questions', (
      SELECT json_agg(
        json_build_object(
          'id', q.id,
          'label', q.label,
          'type', q.type,
          'position', q.position,
          'section_title', s.title
        )
        ORDER BY s.position, q.position
      )
      FROM form_questions q
      LEFT JOIN form_sections s ON s.id = q.section_id
      WHERE q.form_id = p_form_id
    ),
    'total_count', (SELECT COUNT(*) FROM submissions WHERE form_id = p_form_id)
  ) INTO result;
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_form_responses_tabular(uuid, integer, integer) TO authenticated;

-- ─── 4. FIX SUBMISSION FILES TABLE FOR EXPORTS ─────────────────────
-- Allow NULL submission_id and question_id for admin-generated exports
ALTER TABLE public.submission_files 
  ALTER COLUMN submission_id DROP NOT NULL,
  ALTER COLUMN question_id DROP NOT NULL;

-- Add index for files list query
CREATE INDEX IF NOT EXISTS idx_submission_files_form_id 
  ON public.submission_files(form_id, created_at DESC);

-- Add comments for clarity
COMMENT ON COLUMN public.submission_files.submission_id IS 'NULL for admin-generated exports (like Excel downloads), otherwise links to a submission';
COMMENT ON COLUMN public.submission_files.question_id IS 'NULL for admin-generated exports, otherwise links to a form question for file upload answers';

-- ─── 5. ADD AUDIT LOG FOR LOGIN/LOGOUT ─────────────────────────────
-- Note: Login/logout tracking should be added in the frontend code
-- when calling supabase.auth.signInWithPassword() and signOut()

-- Example for frontend to use:
-- After successful login:
--   await supabase.from('audit_logs').insert({
--     action: 'admin.login',
--     entity: 'auth',
--     metadata: { email: user.email }
--   });

-- After logout:
--   await supabase.from('audit_logs').insert({
--     action: 'admin.logout',
--     entity: 'auth',
--     metadata: { email: user.email }
--   });

-- ─── VERIFICATION QUERIES ───────────────────────────────────────────
-- Run these after the migration to verify:

-- 1. Check dashboard stats function exists and works:
-- SELECT public.get_dashboard_stats(7);

-- 2. Check tabular responses function exists:
-- SELECT public.get_form_responses_tabular('<some-form-id>'::uuid, 10, 0);

-- 3. Verify submission_files columns are nullable:
-- SELECT column_name, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'submission_files' 
-- AND column_name IN ('submission_id', 'question_id');

