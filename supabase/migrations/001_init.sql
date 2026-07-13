-- ITH-FORMS v1 — Full schema, RLS, functions
-- Paste the ENTIRE contents of this file into the Supabase SQL Editor and click Run

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enums ───────────────────────────────────────────────────────────────────
CREATE TYPE form_status AS ENUM ('draft','published','closed','archived','deleted');
CREATE TYPE submission_status AS ENUM ('new','under_review','approved','rejected','more_info_required','archived');

-- ─── Tables ──────────────────────────────────────────────────────────────────

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
  status                  submission_status NOT NULL DEFAULT 'new',
  respondent_name         text,
  respondent_email        text,
  submitted_at            timestamptz NOT NULL DEFAULT now(),
  metadata                jsonb NOT NULL DEFAULT '{}',
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
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  form_id       uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  question_id   uuid NOT NULL REFERENCES public.form_questions(id) ON DELETE RESTRICT,
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
  metadata   jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Reference ID sequence ────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS submission_ref_seq START 1;

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

-- Auto-assign reference_id on submission insert
CREATE OR REPLACE FUNCTION public.assign_reference_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.reference_id := public.next_reference_id();
  RETURN NEW;
END;
$$;

CREATE TRIGGER before_submission_insert
  BEFORE INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.assign_reference_id();

-- ─── Response count trigger ───────────────────────────────────────────────────
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

CREATE TRIGGER on_submission_inserted
  AFTER INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.increment_response_count();

-- ─── 25-question limit trigger ────────────────────────────────────────────────
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

CREATE TRIGGER enforce_question_limit
  BEFORE INSERT ON public.form_questions
  FOR EACH ROW EXECUTE FUNCTION public.check_question_limit();

-- ─── updated_at triggers ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER forms_updated_at BEFORE UPDATE ON public.forms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER submissions_updated_at BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER themes_updated_at BEFORE UPDATE ON public.form_themes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── is_admin helper ─────────────────────────────────────────────────────────
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

-- ─── Enable RLS ───────────────────────────────────────────────────────────────
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

-- ─── RLS Policies ────────────────────────────────────────────────────────────

-- admin_users
CREATE POLICY "admin_self_read" ON public.admin_users
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- forms
CREATE POLICY "admin_forms_all" ON public.forms
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "anon_read_published_forms" ON public.forms
  FOR SELECT TO anon
  USING (
    status = 'published'
    AND deleted_at IS NULL
    AND (opens_at IS NULL OR opens_at <= now())
    AND (closes_at IS NULL OR closes_at > now())
  );

-- form_sections
CREATE POLICY "admin_sections_all" ON public.form_sections
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "anon_read_published_sections" ON public.form_sections
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = form_id AND f.status = 'published' AND f.deleted_at IS NULL
  ));

-- form_questions
CREATE POLICY "admin_questions_all" ON public.form_questions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "anon_read_published_questions" ON public.form_questions
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = form_id AND f.status = 'published' AND f.deleted_at IS NULL
  ));

-- form_themes
CREATE POLICY "admin_themes_all" ON public.form_themes
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "anon_read_published_themes" ON public.form_themes
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = form_id AND f.status = 'published' AND f.deleted_at IS NULL
  ));

-- submissions: admin full + anon insert for published+open forms
CREATE POLICY "admin_submissions_all" ON public.submissions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "anon_insert_submissions" ON public.submissions
  FOR INSERT TO anon
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = form_id
      AND f.status = 'published'
      AND f.deleted_at IS NULL
      AND (f.opens_at IS NULL OR f.opens_at <= now())
      AND (f.closes_at IS NULL OR f.closes_at > now())
      AND (f.max_responses IS NULL OR f.response_count < f.max_responses)
  ));

-- anon needs to SELECT their own submission to get back reference_id
CREATE POLICY "anon_read_own_submission" ON public.submissions
  FOR SELECT TO anon
  USING (true);

-- submission_answers
CREATE POLICY "admin_answers_all" ON public.submission_answers
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "anon_insert_answers" ON public.submission_answers
  FOR INSERT TO anon
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.submissions s
    JOIN public.forms f ON f.id = s.form_id
    WHERE s.id = submission_id AND f.status = 'published' AND f.deleted_at IS NULL
  ));

-- submission_files
CREATE POLICY "admin_files_all" ON public.submission_files
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "anon_insert_files" ON public.submission_files
  FOR INSERT TO anon
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.submissions s
    JOIN public.forms f ON f.id = s.form_id
    WHERE s.id = submission_id AND f.status = 'published' AND f.deleted_at IS NULL
  ));

-- submission_notes
CREATE POLICY "admin_notes_all" ON public.submission_notes
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- submission_status_history
CREATE POLICY "admin_history_all" ON public.submission_status_history
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "anon_insert_history" ON public.submission_status_history
  FOR INSERT TO anon WITH CHECK (true);

-- audit_logs
CREATE POLICY "admin_audit_read" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "admin_audit_insert" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "anon_audit_insert" ON public.audit_logs
  FOR INSERT TO anon WITH CHECK (true);

-- ─── Grants ───────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.next_reference_id() TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
