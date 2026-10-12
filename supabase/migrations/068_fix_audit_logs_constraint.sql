-- Migration 068: Fix audit_logs constraint to include payment security actions
-- Root cause: submit_response (migration 067) writes payment security audit actions
-- that were not in the CHECK constraint, causing the entire transaction to rollback.

ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    -- session
    'admin.login',
    'admin.logout',
    -- forms
    'form.created',
    'form.updated',
    'form.deleted',
    'form.restored',
    'form.published',
    'form.unpublished',
    'form.duplicated',
    -- theme
    'theme.updated',
    -- questions
    'question.created',
    'question.updated',
    'question.deleted',
    -- responses
    'response.status_changed',
    'response.deleted',
    'response.exported',
    -- form builder
    'save_form_builder',
    -- submission security (migration 067)
    'submit_response_email_mismatch',
    'submit_response_rate_limited',
    'submit_response_payment_bypass_blocked'
  ));

SELECT 'Migration 068: audit_logs constraint updated with all actions' as status;
