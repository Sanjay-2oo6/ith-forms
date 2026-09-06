-- Migration 051: Fix Overpermissive RLS on verified_emails Table
-- Issue: Anon users can READ all verified_emails via USING(true)
--        Enables email enumeration: attacker learns which emails have submitted to which forms
--        Anon users can INSERT any email via WITH CHECK(true)
--
-- Solution:
-- 1. Remove anon READ permission entirely (USING (false))
-- 2. Remove anon INSERT permission entirely (WITH CHECK (false))
-- 3. Route ALL modifications through submit_response() RPC instead
-- 4. Only authenticated admins can read verified_emails (for form stats)

-- ─── Remove direct anon access ─────────────────────────────────────────────────

-- Policy 1: Drop anon INSERT (all submissions go through submit_response() RPC)
DROP POLICY IF EXISTS "anon_verified_emails_insert" ON public.verified_emails;

-- Policy 2: Drop anon READ (prevents email enumeration)
DROP POLICY IF EXISTS "anon_verified_emails_read" ON public.verified_emails;

-- ─── Create new restrictive policies ───────────────────────────────────────────

-- Policy 1: Anon CANNOT insert (all insertions must go through RPC)
CREATE POLICY "anon_verified_emails_no_insert" ON public.verified_emails
  FOR INSERT TO anon
  WITH CHECK (false);  -- Explicitly deny

-- Policy 2: Anon CANNOT read (no email enumeration)
CREATE POLICY "anon_verified_emails_no_read" ON public.verified_emails
  FOR SELECT TO anon
  USING (false);  -- Explicitly deny

-- Policy 3: Admin can read (for dashboard form statistics)
-- Note: This policy is already created in migration 044, just ensure it remains
DROP POLICY IF EXISTS "admin_verified_emails_read" ON public.verified_emails;

CREATE POLICY "admin_verified_emails_read" ON public.verified_emails
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.forms
      WHERE forms.id = verified_emails.form_id
        AND forms.created_by = auth.uid()
    )
    OR public.is_admin()
  );

-- ─── IMPORTANT: All verified_emails modifications MUST go through submit_response() RPC ─────
-- The submit_response() RPC (migration 050+) handles:
-- - INSERT new verified_emails on first submission (SECURITY DEFINER)
-- - UPDATE submission_count on subsequent submissions
-- - This ensures email ownership is validated before incrementing counts
-- - Prevents unauthorized email registration or submission count inflation

-- ─── Verification ─────────────────────────────────────────────────────────────
SELECT 'verified_emails RLS policies updated - anon access revoked' as status;

-- Test (should return 0 if policies work):
-- SELECT COUNT(*) FROM public.verified_emails;  -- As anon: should fail with RLS error
