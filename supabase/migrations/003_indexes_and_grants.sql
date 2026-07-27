-- ============================================================
-- PHASE 3: Indexes and Grants (006-028 consolidated)
-- ============================================================
-- Creates performance indexes and grants permissions
-- Run this THIRD (after Phases 1 and 2)

-- ============================================================
-- Indexes (Performance Optimization)
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
-- PHASE 3 COMPLETE - All migrations successfully applied!
-- ============================================================
