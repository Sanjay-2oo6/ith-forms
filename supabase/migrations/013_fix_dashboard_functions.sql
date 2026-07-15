-- ==================================================================
-- 013_fix_dashboard_functions.sql
-- Fix Dashboard Functions with Proper Permissions
-- Excludes soft-deleted forms and submissions (deleted_at IS NOT NULL)
-- Run this migration to fix the dashboard loading issue
-- ==================================================================

-- ═══════════════════════════════════════════════════════════════════
-- 1. DROP AND RECREATE get_dashboard_stats
-- ═══════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_dashboard_stats(integer);

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_days integer DEFAULT 7)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  result json;
  period_start timestamptz;
BEGIN
  period_start := NOW() - (p_days || ' days')::interval;

  SELECT json_build_object(
    'total_forms', COUNT(DISTINCT f.id),
    'published_forms', COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'published'),
    'draft_forms', COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'draft'),
    'closed_forms', COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'closed'),
    'archived_forms', COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'archived'),
    'total_submissions', COUNT(s.id) FILTER (WHERE s.submitted_at >= period_start),
    'total_submissions_all_time', COUNT(s.id),
    'active_forms', COUNT(DISTINCT s.form_id) FILTER (WHERE s.submitted_at >= period_start),
    'new_submissions', COUNT(s.id) FILTER (WHERE s.status = 'new' AND s.submitted_at >= period_start),
    'under_review', COUNT(s.id) FILTER (WHERE s.status = 'under_review' AND s.submitted_at >= period_start),
    'approved', COUNT(s.id) FILTER (WHERE s.status = 'approved' AND s.submitted_at >= period_start),
    'rejected', COUNT(s.id) FILTER (WHERE s.status = 'rejected' AND s.submitted_at >= period_start),
    'today_submissions', COUNT(s.id) FILTER (WHERE DATE(s.submitted_at) = CURRENT_DATE),
    'period_days', p_days,
    'period_start', period_start
  ) INTO result
  FROM forms f
  LEFT JOIN submissions s ON f.id = s.form_id AND s.deleted_at IS NULL
  WHERE f.deleted_at IS NULL;

  RETURN result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(integer) TO anon;

-- ═══════════════════════════════════════════════════════════════════
-- 2. DROP AND RECREATE get_daily_submission_trend
-- ═══════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_daily_submission_trend(text);

CREATE OR REPLACE FUNCTION public.get_daily_submission_trend(p_start_date text)
RETURNS TABLE(day text, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(s.submitted_at::date, 'YYYY-MM-DD') as day,
    COUNT(*)::bigint as count
  FROM submissions s
  WHERE s.submitted_at >= p_start_date::timestamptz
    AND s.deleted_at IS NULL
  GROUP BY s.submitted_at::date
  ORDER BY s.submitted_at::date;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_daily_submission_trend(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_submission_trend(text) TO anon;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Verify Functions Work
-- ═══════════════════════════════════════════════════════════════════

-- Test get_dashboard_stats
DO $$
DECLARE
  test_result json;
BEGIN
  SELECT public.get_dashboard_stats(7) INTO test_result;
  RAISE NOTICE 'Dashboard stats test: %', test_result;
END $$;

-- Test get_daily_submission_trend
DO $$
DECLARE
  test_count integer;
BEGIN
  SELECT COUNT(*) INTO test_count FROM public.get_daily_submission_trend(NOW()::text);
  RAISE NOTICE 'Trend data test: % rows', test_count;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (uncomment to test manually)
-- ═══════════════════════════════════════════════════════════════════

-- Test 1: Check if functions exist
-- SELECT routine_name, routine_type 
-- FROM information_schema.routines 
-- WHERE routine_schema = 'public' 
-- AND routine_name IN ('get_dashboard_stats', 'get_daily_submission_trend');

-- Test 2: Run dashboard stats
-- SELECT public.get_dashboard_stats(7);

-- Test 3: Run trend data
-- SELECT * FROM public.get_daily_submission_trend((NOW() - interval '30 days')::text);
