-- 022_save_form_builder.sql
-- Atomic explicit-save endpoint for the admin form builder.
-- The browser keeps edits in memory and calls this RPC only when the admin
-- clicks Save, so section/question edits cannot partially persist.

-- ─── 25-question limit trigger: only count GENUINELY NEW rows ───────────────
-- Postgres fires BEFORE INSERT triggers even when ON CONFLICT DO UPDATE will
-- resolve the row as an update. The original check counted existing rows
-- unconditionally, so a form that already had 25 questions could NEVER be
-- saved again (every upsert tripped the limit). Skip the check when the id
-- already exists — those rows update in place and add nothing to the count.
-- Direct inserts (builder add, templates, duplication) are still capped.
CREATE OR REPLACE FUNCTION public.check_question_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.form_questions WHERE id = NEW.id) THEN
    RETURN NEW; -- upsert-update of an existing question: no new row
  END IF;
  IF (SELECT COUNT(*) FROM public.form_questions WHERE form_id = NEW.form_id) >= 25 THEN
    RAISE EXCEPTION 'Form has reached the 25 question limit';
  END IF;
  RETURN NEW;
END;
$$;

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
    -- Never let an id collision reach into ANOTHER form's rows.
    WHERE form_sections.form_id = p_form_id;

  -- Delete removed questions before inserting new ones, so the existing
  -- 25-question trigger/check cannot reject a valid replacement save.
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
    -- Never let an id collision reach into ANOTHER form's rows.
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
