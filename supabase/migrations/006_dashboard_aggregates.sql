-- ============================================================
-- 006_dashboard_aggregates.sql — Performance optimizations
-- Replaces client-side aggregation with server-side SQL
-- Run this AFTER 005_security_hardening.sql
-- ============================================================

-- Daily submission trend (replaces 10k-row fetch + JS bucketing)
CREATE OR REPLACE FUNCTION public.get_daily_submission_trend(
  p_start_date timestamptz
)
RETURNS TABLE(day date, count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify admin access
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  SELECT submitted_at::date AS day, COUNT(*) AS count
  FROM public.submissions
  WHERE submitted_at >= p_start_date
  GROUP BY submitted_at::date
  ORDER BY day;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_submission_trend(timestamptz) TO authenticated;

-- Dashboard stats (all counts in one RPC call instead of 12 separate queries)
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
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

  SELECT json_build_object(
    'total_forms', (SELECT COUNT(*) FROM forms WHERE deleted_at IS NULL),
    'published', (SELECT COUNT(*) FROM forms WHERE status = 'published' AND deleted_at IS NULL),
    'drafts', (SELECT COUNT(*) FROM forms WHERE status = 'draft' AND deleted_at IS NULL),
    'closed_archived', (SELECT COUNT(*) FROM forms WHERE (status = 'closed' OR status = 'archived') AND deleted_at IS NULL),
    'total_submissions', (SELECT COUNT(*) FROM submissions),
    'new_subs', (SELECT COUNT(*) FROM submissions WHERE status = 'new'),
    'under_review', (SELECT COUNT(*) FROM submissions WHERE status = 'under_review'),
    'approved', (SELECT COUNT(*) FROM submissions WHERE status = 'approved'),
    'rejected', (SELECT COUNT(*) FROM submissions WHERE status = 'rejected'),
    'more_info', (SELECT COUNT(*) FROM submissions WHERE status = 'more_info_required'),
    'archived_subs', (SELECT COUNT(*) FROM submissions WHERE status = 'archived'),
    'today', (SELECT COUNT(*) FROM submissions WHERE submitted_at >= CURRENT_DATE),
    'this_week', (SELECT COUNT(*) FROM submissions WHERE submitted_at >= CURRENT_DATE - INTERVAL '7 days')
  ) INTO result;
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;

-- Submission detail (combines 4 queries into 1)
CREATE OR REPLACE FUNCTION public.get_submission_detail(p_submission_id uuid)
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

  SELECT json_build_object(
    'submission', (
      SELECT row_to_json(s) FROM submissions s WHERE id = p_submission_id
    ),
    'answers', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', a.id,
          'question_id', a.question_id,
          'value', a.value,
          'question_label', q.label,
          'question_type', q.type
        ) ORDER BY q.position
      ), '[]'::json)
      FROM submission_answers a
      LEFT JOIN form_questions q ON q.id = a.question_id
      WHERE a.submission_id = p_submission_id
    ),
    'notes', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', n.id,
          'body', n.body,
          'created_at', n.created_at
        ) ORDER BY n.created_at
      ), '[]'::json)
      FROM submission_notes n
      WHERE n.submission_id = p_submission_id
    ),
    'history', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', h.id,
          'from_status', h.from_status,
          'to_status', h.to_status,
          'changed_at', h.changed_at,
          'note', h.note
        ) ORDER BY h.changed_at
      ), '[]'::json)
      FROM submission_status_history h
      WHERE h.submission_id = p_submission_id
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_submission_detail(uuid) TO authenticated;

-- Response count reconciliation (for M8 - drift protection)
CREATE OR REPLACE FUNCTION public.reconcile_response_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify admin access
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE public.forms f
  SET response_count = (
    SELECT COUNT(*) FROM public.submissions s WHERE s.form_id = f.id
  )
  WHERE deleted_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_response_counts() TO authenticated;
