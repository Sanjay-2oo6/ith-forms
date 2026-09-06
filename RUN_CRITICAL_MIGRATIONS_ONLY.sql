-- ============================================================
-- CRITICAL MIGRATIONS FOR THIS DEPLOYMENT
-- Only migrations 022 (form builder) and 023 (audit actions)
-- Run this if you see "already exists" errors
-- ============================================================

-- ============================================================
-- 022_save_form_builder.sql
-- Adds the ability to save form drafts
-- ============================================================

-- Create table for tracking form builder saves if it doesn't exist
CREATE TABLE IF NOT EXISTS public.form_builder_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL UNIQUE REFERENCES public.forms(id) ON DELETE CASCADE,
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_builder_saves_form_id
  ON public.form_builder_saves(form_id);

-- ============================================================
-- 023_audit_actions_canonical.sql - CRITICAL FIX
-- Adds 3 new audit actions to support Phase 1 security features
-- ============================================================

ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    -- session
    'admin.login',
    'admin.logout',
    -- form lifecycle
    'form.created',
    'form.published',
    'form.unpublished',
    'form.deleted',
    'form.restored',
    'form.updated',          -- written by save_form_builder (022)
    -- theme
    'theme.updated',
    -- submissions
    'submission.status_changed',
    'submission.exported',
    -- security validations (053, 055)
    'submit_response_email_mismatch',      -- written by submit_response (053)
    'submit_response_rate_limited',         -- written by submit_response (053)
    'file_upload_path_traversal_attempt'   -- written by register_submission_file (055)
  ));

-- ============================================================
-- VERIFY THE FIX
-- ============================================================

-- Run this query to confirm the audit constraint is updated:
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'audit_logs_action_check';

-- Expected result: Should show all 3 new audit actions:
-- - submit_response_email_mismatch
-- - submit_response_rate_limited
-- - file_upload_path_traversal_attempt
