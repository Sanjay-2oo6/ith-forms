-- ==================================================================
-- 014_add_your_admin_user.sql
-- Add yourself as an admin user
-- IMPORTANT: Replace the email and user_id with YOUR details
-- ==================================================================

-- ═══════════════════════════════════════════════════════════════════
-- HOW TO FIND YOUR USER_ID
-- ═══════════════════════════════════════════════════════════════════

-- Option 1: If you already have an auth account, find your user_id:
-- SELECT id, email FROM auth.users ORDER BY created_at DESC;

-- Option 2: Sign up first, then run this to see your ID:
-- SELECT id, email FROM auth.users WHERE email = 'YOUR_EMAIL@example.com';

-- ═══════════════════════════════════════════════════════════════════
-- ADD ADMIN USER (Replace with your details)
-- ═══════════════════════════════════════════════════════════════════

-- 🔴 REPLACE THESE VALUES:
-- user_id: Your actual user ID from auth.users
-- email: Your actual email address

INSERT INTO public.admin_users (user_id, email, is_active)
VALUES (
  'd2728dd0-ab98-49a3-8330-9be77fdd3574',  -- ✅ Admin user ID
  'innotechhub.edu@gmail.com',             -- ✅ Admin email
  true
)
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- ═══════════════════════════════════════════════════════════════════
-- ADD MULTIPLE ADMINS (Optional)
-- ═══════════════════════════════════════════════════════════════════

-- Uncomment and modify to add more admin users:
/*
INSERT INTO public.admin_users (user_id, email, is_active)
VALUES 
  ('user-id-2', 'admin2@example.com', true),
  ('user-id-3', 'admin3@example.com', true)
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  is_active = EXCLUDED.is_active,
  updated_at = now();
*/

-- ═══════════════════════════════════════════════════════════════════
-- VERIFY
-- ═══════════════════════════════════════════════════════════════════

-- Check admin users:
SELECT id, user_id, email, is_active, created_at 
FROM public.admin_users 
ORDER BY created_at DESC;

-- Verify your admin status:
-- SELECT public.is_admin(); -- Should return true when logged in as admin

-- ═══════════════════════════════════════════════════════════════════
-- NOTES
-- ═══════════════════════════════════════════════════════════════════

-- 1. user_id MUST match a real user in auth.users table
-- 2. If user_id doesn't exist, this INSERT will fail (foreign key constraint)
-- 3. To make yourself admin:
--    a. Sign up/login first (creates user in auth.users)
--    b. Find your user_id from auth.users
--    c. Run this migration with your user_id
-- 4. ON CONFLICT ensures running this multiple times is safe

-- ═══════════════════════════════════════════════════════════════════
-- DEACTIVATE ADMIN (Don't delete, just deactivate)
-- ═══════════════════════════════════════════════════════════════════

-- To remove admin access without deleting:
-- UPDATE public.admin_users SET is_active = false WHERE email = 'user@example.com';

-- To reactivate:
-- UPDATE public.admin_users SET is_active = true WHERE email = 'user@example.com';
