-- ============================================================
-- PHASE 4+: Dashboard Functions (from migrations 006-020)
-- ============================================================
-- Creates dashboard aggregation functions needed by the admin dashboard
-- Run this AFTER Phases 1-3

-- ─── 1. get_dashboard_stats — admin-only dashboard metrics ─────
DROP FUNCTION IF EXISTS public.get_dashboard_stats(integer);

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_days integer DEFAULT 0)
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
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_days IS NULL OR p_days <= 0 THEN
    period_start := '-infinity'::timestamptz;
  ELSE
    period_start := NOW() - (p_days || ' days')::interval;
  END IF;

  SELECT json_build_object(
    'total_forms', COUNT(DISTINCT f.id),
    'published_forms', COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'published'),
    'draft_forms', COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'draft'),
    'closed_forms', COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'closed'),
    'archived_forms', COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'archived'),
    'total_submissions', COUNT(s.id) FILTER (WHERE s.submitted_at >= period_start),
    'total_submissions_all_time', (SELECT COUNT(*) FROM submissions s2
      JOIN forms f2 ON f2.id = s2.form_id WHERE f2.deleted_at IS NULL),
    'active_forms', COUNT(DISTINCT s.form_id) FILTER (WHERE s.submitted_at >= period_start),
    'new_submissions', COUNT(s.id) FILTER (WHERE s.status = 'new' AND s.submitted_at >= period_start),
    'under_review', COUNT(s.id) FILTER (WHERE s.status = 'under_review' AND s.submitted_at >= period_start),
    'approved', COUNT(s.id) FILTER (WHERE s.status = 'approved' AND s.submitted_at >= period_start),
    'rejected', COUNT(s.id) FILTER (WHERE s.status = 'rejected' AND s.submitted_at >= period_start),
    'today_submissions', COUNT(s.id) FILTER (WHERE DATE(s.submitted_at) = CURRENT_DATE),
    'period_days', COALESCE(p_days, 0),
    'period_start', CASE WHEN p_days IS NULL OR p_days <= 0 THEN NULL ELSE period_start END
  ) INTO result
  FROM forms f
  LEFT JOIN submissions s ON f.id = s.form_id
  WHERE f.deleted_at IS NULL;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_stats(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(integer) TO authenticated;

-- ─── 2. get_daily_submission_trend — daily submission counts ────
DROP FUNCTION IF EXISTS public.get_daily_submission_trend(text);
DROP FUNCTION IF EXISTS public.get_daily_submission_trend(integer);

CREATE OR REPLACE FUNCTION public.get_daily_submission_trend(p_days integer DEFAULT 30)
RETURNS TABLE(day_label text, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_start timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  v_start := date_trunc('day', NOW()) - ((GREATEST(1, LEAST(p_days, 90)) - 1) || ' days')::interval;

  RETURN QUERY
  SELECT s.submitted_at::date::text AS day_label, COUNT(*)::bigint AS cnt
  FROM submissions s
  JOIN forms f ON f.id = s.form_id AND f.deleted_at IS NULL
  WHERE s.submitted_at >= v_start
  GROUP BY s.submitted_at::date
  ORDER BY s.submitted_at::date DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_daily_submission_trend(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_daily_submission_trend(integer) TO authenticated;

-- ============================================================
-- All dashboard functions created successfully!
-- ============================================================
