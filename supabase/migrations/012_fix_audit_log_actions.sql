-- ==================================================================
-- 012_fix_audit_log_actions.sql
-- Fix Audit Log to Only Track Important Actions
-- Remove unnecessary actions, keep only: login, logout, form published, form deleted
-- ==================================================================

-- ═══════════════════════════════════════════════════════════════════
-- 1. Clean up existing audit logs (remove non-essential actions)
-- ═══════════════════════════════════════════════════════════════════

-- First, let's see what actions exist:
DO $$
BEGIN
  RAISE NOTICE 'Current audit log actions:';
END $$;

SELECT action, COUNT(*) as count 
FROM audit_logs 
GROUP BY action 
ORDER BY action;

-- Delete audit logs with non-allowed actions:
DELETE FROM audit_logs 
WHERE action NOT IN (
  'admin.login',
  'admin.logout',
  'form.published',
  'form.unpublished',
  'form.deleted'
);

-- Show how many were deleted:
DO $$
BEGIN
  RAISE NOTICE 'Old audit logs cleaned up. Only keeping essential actions.';
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Add check constraint to only allow specific actions
-- ═══════════════════════════════════════════════════════════════════

-- Drop existing constraint if any
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;

-- Add constraint to only allow specific actions
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'admin.login',
    'admin.logout',
    'form.published',
    'form.deleted',
    'form.unpublished'
  ));

-- ═══════════════════════════════════════════════════════════════════
-- 3. Update function to auto-fill actor_email
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.audit_log_set_actor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only set actor_email if not already set
  IF NEW.actor_email IS NULL THEN
    NEW.actor_email := (SELECT email FROM auth.users WHERE id = auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS audit_log_actor_trigger ON audit_logs;

-- Create trigger
CREATE TRIGGER audit_log_actor_trigger
  BEFORE INSERT ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_set_actor();

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════

-- Test constraint (should fail with non-allowed action):
-- INSERT INTO audit_logs (action, entity) VALUES ('test.action', 'test');

-- Test allowed action (should succeed):
-- INSERT INTO audit_logs (action, entity, entity_id) 
-- VALUES ('admin.login', 'auth', auth.uid());

-- View recent audit logs:
-- SELECT created_at, action, actor_email, metadata 
-- FROM audit_logs 
-- ORDER BY created_at DESC 
-- LIMIT 20;
