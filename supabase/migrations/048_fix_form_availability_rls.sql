-- ============================================================
-- 048_fix_form_availability_rls.sql
-- Fixes form availability check: anon users should be able to READ
-- published forms even if they haven't opened yet, but SUBMIT should be blocked
--
-- ISSUE: The RLS policy on forms table was checking opens_at/closes_at,
-- preventing anon users from even reading published forms that haven't opened.
-- This caused "Form Unavailable" errors.
--
-- FIX: Remove schedule checks from RLS policy. Let anon read published forms,
-- and let the frontend/RPC handle the availability gates (upcoming/closed/limit).
-- This allows respondents to see "Form Opens on X date" instead of just 404.
-- ============================================================

-- Drop the old policy
DROP POLICY IF EXISTS "anon_read_published_forms" ON public.forms;

-- Create new policy: anon can read published, non-deleted forms
-- Schedule checking happens in frontend/RPC, not RLS
CREATE POLICY "anon_read_published_forms" ON public.forms
  FOR SELECT TO anon
  USING (status = 'published' AND deleted_at IS NULL);
