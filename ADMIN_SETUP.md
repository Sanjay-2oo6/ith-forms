# 🔐 Admin User Setup Guide

## What is admin_users?

The `admin_users` table controls who can access the admin dashboard (`/admin/dashboard`).

**Security:** Only users in this table with `is_active = true` can:
- View forms
- See submissions
- Access audit logs
- Manage system

---

## ✅ Quick Setup

### Step 1: Sign Up First
1. Go to your app: `http://localhost:3000/admin/login`
2. Sign up with your email
3. This creates your user account in Supabase

### Step 2: Find Your User ID
Run this in Supabase SQL Editor:
```sql
SELECT id, email FROM auth.users ORDER BY created_at DESC;
```

Copy your `id` (looks like: `7f16dfd0-b14c-4931-9184-be69c65da378`)

### Step 3: Run Migration 014
1. Open `014_add_your_admin_user.sql`
2. Replace `user_id` with your actual ID (from Step 2)
3. Replace `email` with your actual email
4. Run the migration in Supabase SQL Editor

### Step 4: Test
1. Login to your app
2. Should redirect to `/dashboard`
3. You're admin! 🎉

---

## 📝 Manual Method (Without Migration)

If you prefer to run the INSERT directly:

```sql
-- Find your user_id first:
SELECT id, email FROM auth.users;

-- Then insert (replace with your actual values):
INSERT INTO public.admin_users (user_id, email, is_active)
VALUES (
  'YOUR-USER-ID-HERE',
  'your-email@example.com',
  true
);
```

---

## 👥 Add Multiple Admins

```sql
INSERT INTO public.admin_users (user_id, email, is_active)
VALUES 
  ('user-id-1', 'admin1@example.com', true),
  ('user-id-2', 'admin2@example.com', true),
  ('user-id-3', 'admin3@example.com', true)
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  is_active = EXCLUDED.is_active;
```

---

## 🔒 Manage Admin Access

### Deactivate an Admin (Don't Delete)
```sql
UPDATE public.admin_users 
SET is_active = false 
WHERE email = 'user@example.com';
```

### Reactivate an Admin
```sql
UPDATE public.admin_users 
SET is_active = true 
WHERE email = 'user@example.com';
```

### View All Admins
```sql
SELECT id, email, is_active, created_at 
FROM public.admin_users 
ORDER BY created_at DESC;
```

### Check If You're Admin
```sql
-- Must be logged in first
SELECT public.is_admin();
-- Returns: true (if you're admin) or false
```

---

## ❓ Troubleshooting

### Issue 1: "violates foreign key constraint"
**Cause:** user_id doesn't exist in auth.users  
**Fix:** Sign up first, THEN add to admin_users

### Issue 2: "Login redirects back to login"
**Cause:** Not in admin_users table OR is_active = false  
**Fix:** 
```sql
-- Check if you're in the table:
SELECT * FROM public.admin_users WHERE email = 'your@email.com';

-- If not found, add yourself
-- If found but is_active = false, activate:
UPDATE public.admin_users SET is_active = true WHERE email = 'your@email.com';
```

### Issue 3: "Can't access dashboard"
**Cause:** RLS policies blocking access  
**Fix:** Make sure you're logged in as the user whose ID is in admin_users

---

## 🛡️ Security Notes

1. **Don't expose user_id:** This is sensitive info
2. **Use deactivate, not delete:** Preserves audit trail
3. **Review admins regularly:** Keep list up to date
4. **First admin is critical:** Make sure it's YOU

---

## 📊 Admin Table Schema

```sql
CREATE TABLE public.admin_users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text NOT NULL,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
```

**Columns:**
- `id`: Internal ID
- `user_id`: Links to auth.users (Supabase auth)
- `email`: For easy identification
- `is_active`: Enable/disable admin access
- `created_at`: When added as admin
- `updated_at`: Last modified

---

## ✅ Quick Checklist

After setup:
- [ ] Signed up at `/admin/login`
- [ ] Found my user_id from auth.users
- [ ] Added myself to admin_users table
- [ ] Can login and access dashboard
- [ ] Can view forms and submissions
- [ ] Can see audit logs

**You're all set!** 🚀
