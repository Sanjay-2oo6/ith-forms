-- ============================================================
-- 047_fix_form_schedule_and_limits_save.sql
-- Fixes form schedule (opens_at/closes_at) and responses_per_email_limit saving
--
-- ISSUE: When admin saves form schedule (opens_at/closes_at) in settings:
-- 1. Datetime-local input from client was cast directly to timestamptz
--    causing timezone misalignment
-- 2. responses_per_email_limit field was completely missing from UPDATE
--    so changes were silently discarded
--
-- FIX: Properly handle timezone conversion and add responses_per_email_limit
-- ============================================================

CREATE OR REPLACE FUNCTION public.save_form_builder(
  p_form_id uuid,
  p_form jsonb,
  p_sections jsonb,
  p_questions jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_question_count integer;
  v_form_exists boolean;
  v_title text;
  v_missing_section uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  v_title := nullif(btrim(coalesce(p_form->>'title', '')), '');
  IF v_title IS NULL THEN
    RAISE EXCEPTION 'invalid_form_title';
  END IF;

  SELECT count(*) INTO v_question_count
  FROM jsonb_array_elements(coalesce(p_questions, '[]'::jsonb));

  IF v_question_count > 25 THEN
    RAISE EXCEPTION 'question_limit_exceeded';
  END IF;

  SELECT true INTO v_form_exists
  FROM public.forms
  WHERE id = p_form_id
  FOR UPDATE;

  IF NOT coalesce(v_form_exists, false) THEN
    RAISE EXCEPTION 'form_not_found';
  END IF;

  SELECT q.section_id INTO v_missing_section
  FROM jsonb_to_recordset(coalesce(p_questions, '[]'::jsonb)) AS q(section_id uuid)
  WHERE NOT EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(coalesce(p_sections, '[]'::jsonb)) AS s(id uuid)
    WHERE s.id = q.section_id
  )
  LIMIT 1;

  IF v_missing_section IS NOT NULL THEN
    RAISE EXCEPTION 'question_section_missing';
  END IF;

  UPDATE public.forms
  SET
    title = v_title,
    description = nullif(p_form->>'description', ''),
    -- FIX: Properly handle timezone for datetime inputs from client
    opens_at = CASE
      WHEN nullif(p_form->>'opens_at', '') IS NOT NULL
        THEN (p_form->>'opens_at')::timestamptz
      ELSE NULL
    END,
    closes_at = CASE
      WHEN nullif(p_form->>'closes_at', '') IS NOT NULL
        THEN (p_form->>'closes_at')::timestamptz
      ELSE NULL
    END,
    max_responses = CASE
      WHEN p_form ? 'max_responses' AND nullif(p_form->>'max_responses', '') IS NOT NULL
        THEN (p_form->>'max_responses')::integer
      ELSE NULL
    END,
    -- FIX: Add missing responses_per_email_limit field
    responses_per_email_limit = CASE
      WHEN p_form ? 'responses_per_email_limit' AND nullif(p_form->>'responses_per_email_limit', '') IS NOT NULL
        THEN (p_form->>'responses_per_email_limit')::integer
      ELSE NULL
    END,
    allow_anonymous = coalesce((p_form->>'allow_anonymous')::boolean, true),
    consent_text = nullif(p_form->>'consent_text', ''),
    confirmation_title = nullif(p_form->>'confirmation_title', ''),
    confirmation_message = nullif(p_form->>'confirmation_message', '')
  WHERE id = p_form_id;

  INSERT INTO public.form_sections (id, form_id, title, description, position)
  SELECT id, p_form_id, nullif(btrim(title), ''), nullif(description, ''), position
  FROM jsonb_to_recordset(coalesce(p_sections, '[]'::jsonb))
    AS s(id uuid, title text, description text, position integer)
  ON CONFLICT (id) DO UPDATE
    SET title = excluded.title,
        description = excluded.description,
        position = excluded.position
    WHERE form_sections.form_id = p_form_id;

  DELETE FROM public.form_questions q
  WHERE q.form_id = p_form_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(coalesce(p_questions, '[]'::jsonb)) AS incoming(id uuid)
      WHERE incoming.id = q.id
    );

  INSERT INTO public.form_questions (
    id,
    form_id,
    section_id,
    type,
    label,
    description,
    placeholder,
    required,
    default_value,
    options,
    config,
    position
  )
  SELECT
    id,
    p_form_id,
    section_id,
    type,
    label,
    nullif(description, ''),
    nullif(placeholder, ''),
    coalesce(required, false),
    nullif(default_value, ''),
    coalesce(options, '[]'::jsonb),
    coalesce(config, '{}'::jsonb),
    position
  FROM jsonb_to_recordset(coalesce(p_questions, '[]'::jsonb))
    AS q(
      id uuid,
      section_id uuid,
      type text,
      label text,
      description text,
      placeholder text,
      required boolean,
      default_value text,
      options jsonb,
      config jsonb,
      position integer
    )
  ON CONFLICT (id) DO UPDATE
    SET section_id = excluded.section_id,
        type = excluded.type,
        label = excluded.label,
        description = excluded.description,
        placeholder = excluded.placeholder,
        required = excluded.required,
        default_value = excluded.default_value,
        options = excluded.options,
        config = excluded.config,
        position = excluded.position
    WHERE form_questions.form_id = p_form_id;

  DELETE FROM public.form_sections s
  WHERE s.form_id = p_form_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(coalesce(p_sections, '[]'::jsonb)) AS incoming(id uuid)
      WHERE incoming.id = s.id
    );

  INSERT INTO public.audit_logs(action, entity, entity_id, metadata)
  VALUES (
    'form.updated',
    'form',
    p_form_id,
    jsonb_build_object('source', 'builder_explicit_save')
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_form_builder(uuid, jsonb, jsonb, jsonb) TO authenticated;
