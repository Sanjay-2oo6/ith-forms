-- ==================================================================
-- 009_fix_audit_actor.sql
-- Fix audit log to properly capture actor_email for all events
-- ==================================================================

-- Add actor_email to audit_logs if it doesn't exist (it should, but let's be sure)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'actor_email'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN actor_email TEXT;
  END IF;
END $$;

-- Create or replace trigger function to auto-populate actor_email
CREATE OR REPLACE FUNCTION public.set_audit_actor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- If actor_email is not provided, try to get it from auth.users
  IF NEW.actor_email IS NULL THEN
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = auth.uid();
    
    NEW.actor_email := user_email;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS audit_logs_set_actor ON public.audit_logs;

-- Create trigger to run before insert
CREATE TRIGGER audit_logs_set_actor
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_audit_actor();

-- Add comment for clarity
COMMENT ON FUNCTION public.set_audit_actor() IS 'Automatically populates actor_email from auth.users if not explicitly provided';

-- Verification query (run this to check if it works)
-- SELECT action, actor_email, entity, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 10;
