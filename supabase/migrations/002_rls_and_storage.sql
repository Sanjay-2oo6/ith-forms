-- ============================================================
-- PHASE 2: RLS Policies and Storage (004-005 consolidated)
-- ============================================================
-- Enables Row Level Security and creates storage buckets/policies
-- Run this SECOND (after Phase 1)

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
-- PHASE 2 COMPLETE
-- ============================================================
