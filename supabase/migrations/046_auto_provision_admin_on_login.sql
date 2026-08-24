-- ============================================================
-- 046_auto_provision_admin_on_login.sql
-- Auto-provision admin users on first login
--
-- Creates a function that auto-creates admin_users record
-- if the authenticated user exists but isn't in admin_users yet.
-- This simplifies admin onboarding.
--
-- Idempotent: safe to re-run
-- ============================================================

-- ─── 1. Function: ensure_admin_record ────────────────────────────────────
-- Called after login to auto-create admin_users record if needed.
-- This lets you just authenticate as any user, then it auto-provisions them.

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

  -- Admin record doesn't exist; auto-create it
  -- This makes first-time login automatic (no manual migration step)
  INSERT INTO public.admin_users (user_id, email, is_active)
  VALUES (v_user_id, v_email, true)
  RETURNING * INTO v_admin;

  RETURN jsonb_build_object(
    'admin_id', v_admin.id,
    'user_id', v_admin.user_id,
    'email', v_admin.email,
    'is_active', v_admin.is_active,
    'created', true,
    'message', 'Admin record auto-created on first login'
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

-- ─── 2. Alternative: RPC to check admin status + auto-provision ───────────
-- Simpler version: just checks if user is admin, auto-creates if not

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

  -- User not admin yet; try to create admin record
  INSERT INTO public.admin_users (user_id, email, is_active)
  SELECT id, email, true
  FROM auth.users
  WHERE id = v_user_id
  ON CONFLICT (user_id) DO UPDATE SET
    is_active = true,
    updated_at = now()
  RETURNING true;

  RETURN jsonb_build_object('is_admin', true, 'provisioned', true);
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_admin() TO authenticated;

-- ─── 3. Verification ────────────────────────────────────────────────────────
-- After running this migration, test:
--
-- a) Authenticate, then call:
--    SELECT public.get_or_create_admin();
--    → should return {"is_admin":true}
--
-- b) Check admin_users table:
--    SELECT id, user_id, email, is_active FROM public.admin_users ORDER BY created_at DESC;
--    → should show your user auto-created with is_active=true

SELECT 'Migration 046: Auto-provision admin on login - Complete' as status;
