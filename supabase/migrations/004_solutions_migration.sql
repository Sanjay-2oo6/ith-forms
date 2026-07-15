-- ============================================================
-- ITH-FORMS consolidated migration (Solutions guide, Actions 1–4 + R-05)
-- Idempotent: safe to run more than once.
-- Run this in Supabase → SQL Editor BEFORE deploying the matching frontend build.
-- ============================================================

-- (Action 1) B-02: add missing audit column
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS actor_email text;

-- (Action 2) B-01 + B-05: admin can read submissions, read + track exports
DROP POLICY IF EXISTS "admin_select_submissions" ON public.submissions;
CREATE POLICY "admin_select_submissions" ON public.submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users
            WHERE user_id = auth.uid() AND is_active = true)
  );

DROP POLICY IF EXISTS "admin_select_submission_files" ON public.submission_files;
CREATE POLICY "admin_select_submission_files" ON public.submission_files
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users
            WHERE user_id = auth.uid() AND is_active = true)
  );

DROP POLICY IF EXISTS "admin_insert_submission_files" ON public.submission_files;
CREATE POLICY "admin_insert_submission_files" ON public.submission_files
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.admin_users
            WHERE user_id = auth.uid() AND is_active = true)
  );

ALTER TABLE public.submission_files
  ALTER COLUMN submission_id DROP NOT NULL;

-- (Action 3) R-04: enforce slug uniqueness at the DB level.
-- NOTE: if forms.slug already has duplicates this will fail. Run
--   SELECT slug, count(*) FROM public.forms GROUP BY slug HAVING count(*) > 1;
-- and clean up first. Guarded with a DO block so re-runs don't error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'forms_slug_unique'
  ) THEN
    ALTER TABLE public.forms ADD CONSTRAINT forms_slug_unique UNIQUE (slug);
  END IF;
END $$;

-- (Action 4) R-03 — INTENTIONALLY REMOVED.
-- AUDIT CORRECTION: 001_init.sql ALREADY defines increment_response_count()
-- and the on_submission_inserted AFTER INSERT trigger. Adding a second trigger
-- here caused response_count to be incremented TWICE per submission, halving
-- the effective max_responses limit and inflating dashboard counts.
-- Do NOT re-add a second trigger. If you previously ran a version of this file
-- that created trg_increment_response_count, drop it:
DROP TRIGGER IF EXISTS trg_increment_response_count ON public.submissions;

-- (R-05) Idempotency key: prevents duplicate submissions on resubmit.
-- The frontend sends a per-page-load UUID; the unique index rejects duplicates.
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;
CREATE UNIQUE INDEX IF NOT EXISTS submissions_idempotency_key
  ON public.submissions (idempotency_key);
