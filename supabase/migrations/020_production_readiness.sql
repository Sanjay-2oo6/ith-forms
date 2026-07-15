-- ==================================================================
-- 020_production_readiness.sql
-- Fixes: DASH-03, DB-03, FILE-01/02, RESP-01/02, API-01, DASH-02
-- Consolidates file upload validation on form_questions.config (jsonb).
-- Idempotent — safe to re-run.
-- ==================================================================

-- ─── 1. get_dashboard_stats — fix deleted_at drift, admin-only ─────
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

-- ─── 2. get_daily_submission_trend — admin-only, p_days param ────
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
  SELECT
    to_char(d.day::date, 'DD/MM') AS day_label,
    COALESCE(c.cnt, 0)::bigint AS count
  FROM generate_series(v_start::date, CURRENT_DATE, '1 day'::interval) AS d(day)
  LEFT JOIN (
    SELECT s.submitted_at::date AS sub_day, COUNT(*)::bigint AS cnt
    FROM submissions s
    JOIN forms f ON f.id = s.form_id AND f.deleted_at IS NULL
    WHERE s.submitted_at >= v_start
    GROUP BY s.submitted_at::date
  ) c ON c.sub_day = d.day::date
  ORDER BY d.day;
END;
$$;

REVOKE ALL ON FUNCTION public.get_daily_submission_trend(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_daily_submission_trend(integer) TO authenticated;

-- ─── 3. register_submission_file — read config jsonb (not file_config) ─
CREATE OR REPLACE FUNCTION public.register_submission_file(
  p_submission_id uuid,
  p_question_id   uuid,
  p_file_path     text,
  p_file_name     text,
  p_file_size     bigint,
  p_mime_type     text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form_id   uuid;
  v_question  public.form_questions%ROWTYPE;
  v_max_mb    numeric;
  v_max_bytes bigint;
  v_ext       text;
  v_allowed   boolean;
BEGIN
  SELECT s.form_id INTO v_form_id
  FROM public.submissions s
  JOIN public.forms f ON f.id = s.form_id
  WHERE s.id = p_submission_id
    AND f.status = 'published' AND f.deleted_at IS NULL
    AND s.submitted_at > now() - interval '1 hour';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'submission_not_found';
  END IF;

  SELECT * INTO v_question
  FROM public.form_questions
  WHERE id = p_question_id AND form_id = v_form_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_question';
  END IF;

  IF position(p_submission_id::text || '/' IN p_file_path) <> 1 THEN
    RAISE EXCEPTION 'invalid_path';
  END IF;

  -- Max size from config.maxSizeMB (default 10, cap 50)
  v_max_mb := COALESCE((v_question.config->>'maxSizeMB')::numeric, 10);
  v_max_mb := LEAST(50, GREATEST(1, v_max_mb));
  v_max_bytes := (v_max_mb * 1024 * 1024)::bigint;

  IF p_file_size IS NOT NULL AND p_file_size > v_max_bytes THEN
    RAISE EXCEPTION 'file_too_large';
  END IF;

  -- Extension validation from config.accept (matches builder + public form)
  IF v_question.config ? 'accept'
     AND jsonb_typeof(v_question.config->'accept') = 'array'
     AND jsonb_array_length(v_question.config->'accept') > 0 THEN
    v_ext := lower(coalesce(substring(p_file_name from '\.[^.]*$'), ''));
    SELECT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(v_question.config->'accept') AS e(val)
      WHERE lower(e.val) = v_ext
    ) INTO v_allowed;
    IF NOT v_allowed THEN
      RAISE EXCEPTION 'invalid_file_type';
    END IF;
  END IF;

  INSERT INTO public.submission_files
    (submission_id, form_id, question_id, file_path, file_name, file_size, mime_type)
  VALUES
    (p_submission_id, v_form_id, p_question_id,
     p_file_path, left(p_file_name, 300), p_file_size, left(p_mime_type, 100));
END;
$$;

REVOKE ALL ON FUNCTION public.register_submission_file(uuid,uuid,text,text,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_submission_file(uuid,uuid,text,text,bigint,text) TO anon, authenticated;

-- ─── 4. get_form_responses_tabular — server-side search + filter ──
DROP FUNCTION IF EXISTS public.get_form_responses_tabular(uuid, integer, integer);
DROP FUNCTION IF EXISTS public.get_form_responses_tabular(uuid, integer, integer, text, text);

CREATE OR REPLACE FUNCTION public.get_form_responses_tabular(
  p_form_id  uuid,
  p_limit    integer DEFAULT 50,
  p_offset   integer DEFAULT 0,
  p_search   text DEFAULT NULL,
  p_status   text DEFAULT NULL
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
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  v_search := nullif(trim(coalesce(p_search, '')), '');

  IF p_status IS NOT NULL AND trim(p_status) <> '' AND lower(trim(p_status)) <> 'all' THEN
    v_status := trim(p_status)::submission_status;
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM submissions s
  WHERE s.form_id = p_form_id
    AND (v_status IS NULL OR s.status = v_status)
    AND (
      v_search IS NULL
      OR s.reference_id ILIKE '%' || v_search || '%'
      OR coalesce(s.respondent_name, '') ILIKE '%' || v_search || '%'
      OR coalesce(s.respondent_email, '') ILIKE '%' || v_search || '%'
    );

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

REVOKE ALL ON FUNCTION public.get_form_responses_tabular(uuid, integer, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_form_responses_tabular(uuid, integer, integer, text, text) TO authenticated;

-- ─── 5. Allow form.restored audit action ───────────────────────────
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'admin.login',
    'admin.logout',
    'form.created',
    'form.published',
    'form.unpublished',
    'form.deleted',
    'form.restored',
    'form.updated',
    'theme.updated',
    'submission.status_changed',
    'submission.exported'
  ));
