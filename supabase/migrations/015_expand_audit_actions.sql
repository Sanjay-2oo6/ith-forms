-- ==================================================================
-- 015_expand_audit_actions.sql
-- Migration 012 restricted audit_logs.action to only 5 values, which
-- REJECTED the status-change and theme-update audit inserts the app
-- makes (constraint violation 23514 → those actions never got logged).
--
-- This expands the allowed set to every meaningful admin action the
-- code actually produces, so the audit log records them correctly.
-- Idempotent: safe to re-run.
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
    'form.updated',
    -- theme
    'theme.updated',
    -- submissions
    'submission.status_changed',
    'submission.exported'
  ));

-- Keep the actor-email auto-fill trigger from 012 (recreate defensively so
-- this migration also works if 012 was never applied).
CREATE OR REPLACE FUNCTION public.audit_log_set_actor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.actor_email IS NULL THEN
    NEW.actor_email := (SELECT email FROM auth.users WHERE id = auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_log_actor_trigger ON public.audit_logs;
CREATE TRIGGER audit_log_actor_trigger
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_set_actor();

-- Verify afterwards:
--   SELECT created_at, action, actor_email FROM public.audit_logs
--   ORDER BY created_at DESC LIMIT 20;
