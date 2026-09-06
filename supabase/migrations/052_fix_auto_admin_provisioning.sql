-- Migration 052: Fix Auto-Admin Provisioning Vulnerability
-- Issue: get_or_create_admin() and ensure_admin_record() automatically create admin users
--        on first login. ANY authenticated user becomes admin instantly.
--
-- Solution:
-- 1. Create admin_whitelist table to store approved admin emails
-- 2. Update get_or_create_admin() to check whitelist before creating admin
-- 3. Update ensure_admin_record() similarly
-- 4. Only whitelisted emails can become admins
-- 5. Remove GRANT INSERT on admin_users from authenticated users

-- ─── 1. Create admin_whitelist table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_whitelist (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text NOT NULL UNIQUE,
  approved_by       uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_at       timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure email is lowercase
  CONSTRAINT admin_whitelist_email_lowercase CHECK (email = LOWER(email))
);

ALTER TABLE public.admin_whitelist ENABLE ROW LEVEL SECURITY;

-- RLS: Only admins can manage whitelist
DROP POLICY IF EXISTS "admin_whitelist_read" ON public.admin_whitelist;
CREATE POLICY "admin_whitelist_read" ON public.admin_whitelist
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_whitelist_insert" ON public.admin_whitelist;
CREATE POLICY "admin_whitelist_insert" ON public.admin_whitelist
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_whitelist_delete" ON public.admin_whitelist;
CREATE POLICY "admin_whitelist_delete" ON public.admin_whitelist
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ─── 2. Update get_or_create_admin() to check whitelist ─────────────────────
DROP FUNCTION IF EXISTS public.get_or_create_admin() CASCADE;

CREATE OR REPLACE FUNCTION public.get_or_create_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_email   text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('is_admin', false, 'error', 'not_authenticated');
  END IF;

  -- Try to get existing admin record
  IF EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = v_user_id AND is_active = true) THEN
    RETURN jsonb_build_object('is_admin', true);
  END IF;

  -- Check if user's email is on the whitelist
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('is_admin', false, 'error', 'email_not_found');
  END IF;

  -- Only create admin record if email is whitelisted
  IF NOT EXISTS (SELECT 1 FROM public.admin_whitelist WHERE email = LOWER(v_email)) THEN
    RETURN jsonb_build_object(
      'is_admin', false, 
      'error', 'not_whitelisted',
      'message', 'Your email is not approved for admin access. Contact an administrator.'
    );
  END IF;

  -- Email is whitelisted; create admin record
  INSERT INTO public.admin_users (user_id, email, is_active)
  VALUES (v_user_id, v_email, true)
  ON CONFLICT (user_id) DO UPDATE SET
    is_active = true,
    updated_at = now();

  RETURN jsonb_build_object('is_admin', true, 'provisioned', true);
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_admin() TO anon, authenticated;

-- ─── 3. Update ensure_admin_record() to check whitelist ─────────────────────
DROP FUNCTION IF EXISTS public.ensure_admin_record() CASCADE;

CREATE OR REPLACE FUNCTION public.ensure_admin_record()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_email   text;
  v_admin   public.admin_users%ROWTYPE;
BEGIN
  -- Get current authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Get user email from auth.users
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  -- Check if admin record exists
  SELECT * INTO v_admin FROM public.admin_users WHERE user_id = v_user_id;

  IF FOUND THEN
    -- Admin record exists; return status
    RETURN jsonb_build_object(
      'admin_id', v_admin.id,
      'user_id', v_admin.user_id,
      'email', v_admin.email,
      'is_active', v_admin.is_active,
      'created', false,
      'message', CASE
        WHEN v_admin.is_active THEN 'Admin record exists and is active'
        ELSE 'Admin record exists but is inactive'
      END
    );
  END IF;

  -- Admin record doesn't exist; check whitelist before creating
  IF NOT EXISTS (SELECT 1 FROM public.admin_whitelist WHERE email = LOWER(v_email)) THEN
    RETURN jsonb_build_object(
      'admin_id', NULL,
      'email', v_email,
      'is_active', false,
      'created', false,
      'message', 'Email not on admin whitelist. Contact an administrator to request access.'
    );
  END IF;

  -- Email is whitelisted; create admin record
  INSERT INTO public.admin_users (user_id, email, is_active)
  VALUES (v_user_id, v_email, true)
  RETURNING * INTO v_admin;

  RETURN jsonb_build_object(
    'admin_id', v_admin.id,
    'user_id', v_admin.user_id,
    'email', v_admin.email,
    'is_active', v_admin.is_active,
    'created', true,
    'message', 'Admin record created (email was whitelisted)'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error', SQLERRM,
    'created', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_admin_record() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_admin_record() TO authenticated;

-- ─── 4. REVOKE unauthorized insert permission ──────────────────────────────
-- No longer allow authenticated users to directly insert into admin_users
REVOKE INSERT, UPDATE ON public.admin_users FROM authenticated;

-- Only allow via RPCs (which have whitelis checks)
GRANT EXECUTE ON FUNCTION public.get_or_create_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_admin_record() TO authenticated;

-- ─── 5. Create indexes for performance ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_admin_whitelist_email ON public.admin_whitelist(email);
CREATE INDEX IF NOT EXISTS idx_admin_whitelist_approved_at ON public.admin_whitelist(approved_at);

-- ─── 6. Seed initial admin(s) if needed ────────────────────────────────────
-- IMPORTANT: Manually add the initial admin email(s) to admin_whitelist:
--
-- INSERT INTO public.admin_whitelist (email, approved_by)
-- VALUES ('admin@example.com', (SELECT id FROM auth.users WHERE email = 'admin@example.com' LIMIT 1))
-- ON CONFLICT DO NOTHING;
--
-- Then that user can log in and call get_or_create_admin() to get admin privileges

-- ─── 7. Verification queries ───────────────────────────────────────────────
SELECT 'Migration 052: Auto-admin provisioning fixed - whitelist implemented' as status;

-- Check whitelist table:
-- SELECT email, approved_at FROM public.admin_whitelist;

-- Check admin users:
-- SELECT email, is_active, created_at FROM public.admin_users ORDER BY created_at DESC;
