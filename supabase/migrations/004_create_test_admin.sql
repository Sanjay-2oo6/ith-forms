-- ============================================================
-- PHASE 4: Create Test Admin Account
-- ============================================================
-- Creates a test admin user for development/testing
-- Run this AFTER Phase 3

-- AUTOMATED SETUP: This uses a generated UUID for testing.
-- You can log in with:
--   Email: admin@test.local
--   Password: TestAdmin123!@#
--
-- CHANGE THESE CREDENTIALS LATER for production!

-- ============================================================
-- Insert Test Admin User
-- ============================================================

INSERT INTO public.admin_users (user_id, email, display_name, is_active)
VALUES (
  'a0000000-0000-0000-0000-000000000001',  -- Test UUID
  'admin@test.local',
  'Test Admin',
  true
)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- Insert Sample Form Settings
-- ============================================================

INSERT INTO public.app_settings (
  app_name,
  org_name,
  powered_by,
  default_appearance,
  default_confirmation_message
)
VALUES (
  'ITH Forms',
  'InnoTech Hub',
  'Powered by ITH Forms',
  'system',
  'Your response has been received. Thank you!'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- All migrations complete!
-- ============================================================
-- 
-- TEST CREDENTIALS:
--   Email: admin@test.local
--   Password: TestAdmin123!@#
--
-- IMPORTANT: Change these credentials immediately in production!
-- ============================================================
