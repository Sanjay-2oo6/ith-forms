-- ============================================================
-- ITH-FORMS: ALL MIGRATIONS COMBINED (001-028)
-- For new Supabase project setup
-- Paste ENTIRE contents into Supabase SQL Editor and Run
-- ============================================================

-- Includes all schema, RLS, functions, indexes, and performance optimizations
-- Originally split into 28 files for git history; combined here for single deployment

-- ============================================================
-- 001_init.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE form_status AS ENUM ('draft','published','closed','archived','deleted');
CREATE TYPE submission_status AS ENUM ('new','under_review','approved','rejected','more_info_required','archived');

CREATE TABLE public.admin_users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text NOT NULL,
  display_name text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.forms (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                 text NOT NULL UNIQUE,
  title                text NOT NULL,
  description          text,
  category             text,
  status               form_status NOT NULL DEFAULT 'draft',
  opens_at             timestamptz,
  closes_at            timestamptz,
  max_responses        integer CHECK (max_responses > 0),
  response_count       integer NOT NULL DEFAULT 0,
  allow_anonymous      boolean NOT NULL DEFAULT true,
  consent_text         text,
  confirmation_title   text,
  confirmation_message text,
  published_at         timestamptz,
  deleted_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.form_sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id     uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT 'Section',
  description text,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.form_questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id       uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  section_id    uuid NOT NULL REFERENCES public.form_sections(id) ON DELETE CASCADE,
  type          text NOT NULL,
  label         text NOT NULL,
  description   text,
  placeholder   text,
  required      boolean NOT NULL DEFAULT false,
  default_value text,
  options       jsonb NOT NULL DEFAULT '[]',
  config        jsonb,
  file_config   jsonb,
  scale_min     integer,
  scale_max     integer,
  position      integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.form_themes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id             uuid NOT NULL UNIQUE REFERENCES public.forms(id) ON DELETE CASCADE,
  preset              text NOT NULL DEFAULT 'ith-default',
  primary_color       text,
  background_color    text,
  card_color          text,
  font_family         text,
  border_radius       text,
  form_width          text,
  bg_image_path       text,
  bg_overlay_opacity  numeric(3,2) DEFAULT 0.5,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.submissions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id                 uuid NOT NULL REFERENCES public.forms(id) ON DELETE RESTRICT,
  reference_id            text NOT NULL UNIQUE DEFAULT '',
  reference_token         text UNIQUE,
  status                  submission_status NOT NULL DEFAULT 'new',
  respondent_name         text,
  respondent_email        text,
  submitted_at            timestamptz NOT NULL DEFAULT now(),
  metadata                jsonb NOT NULL DEFAULT '{}',
  idempotency_key         uuid UNIQUE,
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.submission_answers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  form_id       uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  question_id   uuid NOT NULL REFERENCES public.form_questions(id) ON DELETE RESTRICT,
  value         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.submission_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES public.submissions(id) ON DELETE CASCADE,
  form_id       uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  question_id   uuid REFERENCES public.form_questions(id) ON DELETE RESTRICT,
  file_path     text NOT NULL,
  file_name     text NOT NULL,
  file_size     bigint,
  mime_type     text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.submission_notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  form_id       uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  body          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.submission_status_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  form_id       uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  from_status   submission_status,
  to_status     submission_status NOT NULL,
  note          text,
  changed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action     text NOT NULL,
  entity     text,
  entity_id  text,
  actor_email text,
  metadata   jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_settings (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_name                    text DEFAULT 'ITH Forms',
  org_name                    text DEFAULT 'InnoTech Hub',
  powered_by                  text DEFAULT 'Powered by ITH Forms',
  default_appearance          text DEFAULT 'system',
  default_confirmation_message text DEFAULT 'Your response has been received.',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.form_submission_sequences (
  form_id uuid PRIMARY KEY REFERENCES public.forms(id) ON DELETE CASCADE,
  current_value integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Functions and Triggers
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS submission_ref_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_form_abbreviation(form_title text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  words text[];
  abbr text := '';
  word text;
BEGIN
  form_title := regexp_replace(form_title, '[^a-zA-Z0-9 ]', '', 'g');
  words := string_to_array(upper(form_title), ' ');
  FOR word IN SELECT unnest(words) LOOP
    IF length(word) > 0 AND length(abbr) < 5 THEN
      abbr := abbr || left(word, 1);
    END IF;
  END LOOP;
  IF length(abbr) < 2 THEN
    abbr := upper(left(regexp_replace(form_title, '[^a-zA-Z0-9]', '', 'g'), 5));
  END IF;
  IF length(abbr) < 2 THEN
    abbr := 'FORM';
  END IF;
  RETURN abbr;
END;
$$;

CREATE OR REPLACE FUNCTION public.next_form_reference_id(p_form_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form_title text;
  v_abbr text;
  v_sequence integer;
  v_form_id_short text;
BEGIN
  SELECT title INTO v_form_title FROM public.forms WHERE id = p_form_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'form_not_found'; END IF;
  
  v_abbr := public.generate_form_abbreviation(v_form_title);
  v_form_id_short := left(p_form_id::text, 8);
  
  INSERT INTO public.form_submission_sequences (form_id, current_value)
  VALUES (p_form_id, 1)
  ON CONFLICT (form_id) DO UPDATE 
    SET current_value = form_submission_sequences.current_value + 1,
        updated_at = now()
  RETURNING current_value INTO v_sequence;
  
  RETURN v_abbr || '-' || v_form_id_short || '-' || lpad(v_sequence::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.next_reference_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seq_val bigint;
BEGIN
  seq_val := nextval('submission_ref_seq');
  RETURN 'ITH-' || to_char(now(), 'YYYY') || '-' || lpad(seq_val::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_reference_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.reference_id := public.next_form_reference_id(NEW.form_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_reference_token()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT encode(gen_random_bytes(24), 'base64url');
$$;

CREATE OR REPLACE FUNCTION public.assign_reference_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reference_token IS NULL THEN
    NEW.reference_token := public.generate_reference_token();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_response_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.forms SET response_count = response_count + 1 WHERE id = NEW.form_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_question_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.form_questions WHERE form_id = NEW.form_id) >= 25 THEN
    RAISE EXCEPTION 'Form has reached the 25 question limit';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.submit_response(
  p_form_id         uuid,
  p_name            text,
  p_email           text,
  p_idempotency_key uuid,
  p_answers         jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form     public.forms%ROWTYPE;
  v_existing public.submissions%ROWTYPE;
  v_sub_id   uuid;
  v_ref      text;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.submissions
      WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'submission_id', v_existing.id,
        'reference_id',  v_existing.reference_id,
        'reference_token', v_existing.reference_token,
        'duplicate',     true);
    END IF;
  END IF;

  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'array'
     OR jsonb_array_length(p_answers) > 50 THEN
    RAISE EXCEPTION 'invalid_payload';
  END IF;

  SELECT * INTO v_form FROM public.forms WHERE id = p_form_id FOR UPDATE;

  IF NOT FOUND OR v_form.deleted_at IS NOT NULL OR v_form.status <> 'published' THEN
    RAISE EXCEPTION 'form_unavailable';
  END IF;
  IF v_form.opens_at IS NOT NULL AND v_form.opens_at > now() THEN
    RAISE EXCEPTION 'form_not_open';
  END IF;
  IF v_form.closes_at IS NOT NULL AND v_form.closes_at <= now() THEN
    RAISE EXCEPTION 'form_closed';
  END IF;
  IF v_form.max_responses IS NOT NULL AND v_form.response_count >= v_form.max_responses THEN
    RAISE EXCEPTION 'limit_reached';
  END IF;

  INSERT INTO public.submissions
    (form_id, status, respondent_name, respondent_email, submitted_at, metadata, idempotency_key)
  VALUES
    (p_form_id, 'new',
     nullif(trim(coalesce(p_name,  '')), ''),
     nullif(trim(coalesce(p_email, '')), ''),
     now(), '{}'::jsonb, p_idempotency_key)
  RETURNING id, reference_id INTO v_sub_id, v_ref;

  INSERT INTO public.submission_answers (submission_id, form_id, question_id, value)
  SELECT v_sub_id, p_form_id,
         (a->>'question_id')::uuid,
         left(a->>'value', 20000)
  FROM jsonb_array_elements(p_answers) AS a
  WHERE (a->>'question_id') IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.form_questions q
                WHERE q.id = (a->>'question_id')::uuid
                  AND q.form_id = p_form_id);

  RETURN jsonb_build_object(
    'submission_id', v_sub_id,
    'reference_id',  v_ref,
    'duplicate',     false);

EXCEPTION WHEN unique_violation THEN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.submissions
      WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'submission_id', v_existing.id,
        'reference_id',  v_existing.reference_id,
        'duplicate',     true);
    END IF;
  END IF;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_response(uuid,text,text,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_response(uuid,text,text,uuid,jsonb) TO anon, authenticated;

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
  IF NOT FOUND THEN RAISE EXCEPTION 'submission_not_found'; END IF;

  SELECT * INTO v_question
  FROM public.form_questions
  WHERE id = p_question_id AND form_id = v_form_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_question'; END IF;

  IF position(p_submission_id::text || '/' IN p_file_path) <> 1 THEN
    RAISE EXCEPTION 'invalid_path';
  END IF;

  v_max_mb := COALESCE((v_question.config->>'maxSizeMB')::numeric, 10);
  v_max_mb := LEAST(50, GREATEST(1, v_max_mb));
  v_max_bytes := (v_max_mb * 1024 * 1024)::bigint;

  IF p_file_size IS NOT NULL AND p_file_size > v_max_bytes THEN
    RAISE EXCEPTION 'file_too_large';
  END IF;

  IF v_question.config ? 'accept'
     AND jsonb_typeof(v_question.config->'accept') = 'array'
     AND jsonb_array_length(v_question.config->'accept') > 0 THEN
    v_ext := lower(coalesce(substring(p_file_name from '\.[^.]*$'), ''));
    SELECT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(v_question.config->'accept') AS e(val)
      WHERE lower(e.val) = v_ext
    ) INTO v_allowed;
    IF NOT v_allowed THEN RAISE EXCEPTION 'invalid_file_type'; END IF;
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

-- ============================================================
-- Triggers
-- ============================================================

DROP TRIGGER IF EXISTS before_submission_insert ON public.submissions;
CREATE TRIGGER before_submission_insert
  BEFORE INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.assign_reference_id();

DROP TRIGGER IF EXISTS before_submission_insert_token ON public.submissions;
CREATE TRIGGER before_submission_insert_token
  BEFORE INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.assign_reference_token();

DROP TRIGGER IF EXISTS on_submission_inserted ON public.submissions;
CREATE TRIGGER on_submission_inserted
  AFTER INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.increment_response_count();

DROP TRIGGER IF EXISTS enforce_question_limit ON public.form_questions;
CREATE TRIGGER enforce_question_limit
  BEFORE INSERT ON public.form_questions
  FOR EACH ROW EXECUTE FUNCTION public.check_question_limit();

DROP TRIGGER IF EXISTS forms_updated_at ON public.forms;
CREATE TRIGGER forms_updated_at BEFORE UPDATE ON public.forms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  
DROP TRIGGER IF EXISTS submissions_updated_at ON public.submissions;
CREATE TRIGGER submissions_updated_at BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  
DROP TRIGGER IF EXISTS themes_updated_at ON public.form_themes;
CREATE TRIGGER themes_updated_at BEFORE UPDATE ON public.form_themes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Enable RLS
-- ============================================================

ALTER TABLE public.admin_users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forms                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_sections             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_questions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_themes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_answers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_files          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_notes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings              ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies
-- ============================================================

-- admin_users
CREATE POLICY "admin_self_read" ON public.admin_users
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admin_users_manage" ON public.admin_users
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- forms
CREATE POLICY "admin_forms_all" ON public.forms
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "anon_read_published_forms" ON public.forms
  FOR SELECT TO anon
  USING (status = 'published' AND deleted_at IS NULL AND (opens_at IS NULL OR opens_at <= now()) AND (closes_at IS NULL OR closes_at > now()));

-- form_sections
CREATE POLICY "admin_sections_all" ON public.form_sections
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "anon_read_published_sections" ON public.form_sections
  FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.status = 'published' AND f.deleted_at IS NULL));

-- form_questions
CREATE POLICY "admin_questions_all" ON public.form_questions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "anon_read_published_questions" ON public.form_questions
  FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.status = 'published' AND f.deleted_at IS NULL));

-- form_themes
CREATE POLICY "admin_themes_all" ON public.form_themes
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "anon_read_published_themes" ON public.form_themes
  FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.status = 'published' AND f.deleted_at IS NULL));

-- submissions
CREATE POLICY "admin_submissions_all" ON public.submissions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- submission_answers
CREATE POLICY "admin_answers_all" ON public.submission_answers
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- submission_files
CREATE POLICY "admin_files_all" ON public.submission_files
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- submission_notes
CREATE POLICY "admin_notes_all" ON public.submission_notes
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- submission_status_history
CREATE POLICY "admin_history_all" ON public.submission_status_history
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- audit_logs
CREATE POLICY "admin_audit_read" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin_audit_insert" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- app_settings
CREATE POLICY "app_settings_admin_all" ON public.app_settings
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "app_settings_anon_read" ON public.app_settings
  FOR SELECT TO anon USING (true);

-- ============================================================
-- Storage Buckets
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('submission-files', 'submission-files', false)
ON CONFLICT (id) DO UPDATE SET public = false;

INSERT INTO storage.buckets (id, name, public)
VALUES ('form-assets', 'form-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "anon_upload_submission_files" ON storage.objects;
CREATE POLICY "anon_upload_submission_files" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'submission-files');

DROP POLICY IF EXISTS "admin_all_submission_files" ON storage.objects;
CREATE POLICY "admin_all_submission_files" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'submission-files' AND public.is_admin())
  WITH CHECK (bucket_id = 'submission-files' AND public.is_admin());

DROP POLICY IF EXISTS "admin_write_form_assets" ON storage.objects;
CREATE POLICY "admin_write_form_assets" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'form-assets' AND public.is_admin())
  WITH CHECK (bucket_id = 'form-assets' AND public.is_admin());

DROP POLICY IF EXISTS "public_read_form_assets" ON storage.objects;
CREATE POLICY "public_read_form_assets" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'form-assets');

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_submissions_form_id ON public.submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON public.submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_form_submitted ON public.submissions(form_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_submission_answers_sub_id ON public.submission_answers(submission_id);
CREATE INDEX IF NOT EXISTS idx_form_questions_form_id ON public.form_questions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_questions_section_id ON public.form_questions(section_id);
CREATE INDEX IF NOT EXISTS idx_form_sections_form_id ON public.form_sections(form_id);
CREATE INDEX IF NOT EXISTS idx_submission_files_sub_id ON public.submission_files(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_notes_sub_id ON public.submission_notes(submission_id);
CREATE INDEX IF NOT EXISTS idx_status_history_sub_id ON public.submission_status_history(submission_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_id ON public.audit_logs(created_at DESC, id DESC);

-- ============================================================
-- Grants
-- ============================================================

GRANT EXECUTE ON FUNCTION public.generate_form_abbreviation(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.next_form_reference_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_reference_id() TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT SELECT ON public.form_submission_sequences TO authenticated;

-- ============================================================
-- Initialize sequences for existing forms
-- ============================================================

INSERT INTO public.form_submission_sequences (form_id, current_value)
SELECT id, 0 FROM public.forms WHERE deleted_at IS NULL
ON CONFLICT (form_id) DO NOTHING;

-- ============================================================
-- All migrations successfully applied!
-- ============================================================
