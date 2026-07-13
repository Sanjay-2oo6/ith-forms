-- Add actor_email to audit_logs for display in the audit log UI
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_email text;
