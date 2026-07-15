-- ==================================================================
-- 023_audit_actions_canonical.sql
--
-- FIX: clicking Save in the form builder failed with
--   new row for relation "audit_logs" violates check constraint
--   "audit_logs_action_check"
--
-- Root cause: save_form_builder (022) writes the audit action
-- 'form.updated', but the live constraint still dates from migration 012,
-- which allowed only five actions (admin.login/logout, form.published/
-- unpublished/deleted). The expansions in 015_expand_audit_actions and
-- 020 §5 were never applied to this environment. Because the audit INSERT
-- runs inside the save_form_builder transaction, the violation rolled the
-- ENTIRE save back (no partial state — but nothing saved either).
--
-- This sets the constraint to the canonical list of every action the
-- application actually writes (grep-verified against src/ and the RPCs).
-- Forward-only and idempotent: safe to run whether the current constraint
-- is the 012, 015, or 020 version. Audit validation is NOT weakened —
-- unknown actions are still rejected.
-- ==================================================================

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
    'submission.exported'
  ));

-- Verify afterwards (should list the new definition):
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conname = 'audit_logs_action_check';
