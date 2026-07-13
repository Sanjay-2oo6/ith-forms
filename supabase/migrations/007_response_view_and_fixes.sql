-- ============================================================
-- 007_response_view_and_fixes.sql
-- Fixes: Missing RPC functions, adds tabular response view support
-- Run this AFTER 006_dashboard_aggregates.sql
-- ============================================================

-- ─── 1. Add missing submission_files to Files section table ──────────────────
-- Allow NULL submission_id for admin-generated exports
ALTER TABLE public.submission_files 
  ALTER COLUMN submission_id DROP NOT NULL,
  ALTER COLUMN question_id DROP NOT NULL;

-- Add index for files list query
CREATE INDEX IF NOT EXISTS idx_submission_files_form_id 
  ON public.submission_files(form_id, created_at DESC);

-- ─── 2. Get submission responses in tabular format (for responses list view) ─
-- Returns all submissions with answers in structured format
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

-- ─── 3. Enhanced dashboard stats with meaningful metrics ─────────────────────
-- Updated to include form status breakdown and time-based filtering
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
  p_days integer DEFAULT 7
)
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

-- Drop the old version and recreate
DROP FUNCTION IF EXISTS public.get_dashboard_stats();
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(integer) TO authenticated;

-- ─── 4. Storage bucket policies fix for file downloads ───────────────────────
-- Ensure admin can create signed URLs for downloads
DROP POLICY IF EXISTS "admin_all_submission_files" ON storage.objects;
CREATE POLICY "admin_all_submission_files" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'submission-files' AND 
    (public.is_admin() OR auth.uid() IS NOT NULL)
  )
  WITH CHECK (
    bucket_id = 'submission-files' AND public.is_admin()
  );

-- ─── 5. Export file tracking (for Files section) ─────────────────────────────
-- Insert statement for tracking exports in submission_files
-- Admin code should call this after uploading to storage:
-- INSERT INTO submission_files (form_id, submission_id, question_id, file_path, file_name, file_size, mime_type)
-- VALUES (form_id, NULL, NULL, 'exports/form-id/filename.xlsx', 'filename.xlsx', file_size, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

COMMENT ON COLUMN public.submission_files.submission_id IS 'NULL for admin-generated exports, otherwise links to a submission';
COMMENT ON COLUMN public.submission_files.question_id IS 'NULL for admin-generated exports, otherwise links to a form question';
