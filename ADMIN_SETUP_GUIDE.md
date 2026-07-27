# Admin Account Setup Guide

This guide walks you through creating your first admin account for ITH Forms.

## Prerequisites

- ✅ Supabase project created
- ✅ All 3 migration phases completed (001-003)
- ✅ Tables created and RLS enabled

## Step 1: Create Auth User in Supabase

1. Go to your Supabase project dashboard
2. Click **Authentication** (left sidebar)
3. Click **Users**
4. Click **Add user** (top right)
5. Fill in:
   - **Email**: `test@example.com` (or your email)
   - **Password**: Set a strong password (you'll need this to log in)
6. Click **Create user**

You'll see a popup with:
- **User ID** (UUID) — copy this
- **Email**
- **Password** (if you set one)

**Example User ID:** `550e8400-e29b-41d4-a716-446655440000`

## Step 2: Create Admin Record

Now you need to link this auth user to the admin_users table.

### Option A: Using SQL Editor (Recommended)

1. Go to **SQL Editor** in your Supabase project
2. Paste this query (replace the values):

```sql
INSERT INTO public.admin_users (user_id, email, display_name, is_active)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',  -- Replace with YOUR User ID
  'test@example.com',                        -- Replace with YOUR Email
  'Test Admin',
  true
)
ON CONFLICT (user_id) DO NOTHING;
```

3. Click **Run**
4. You should see: `✓ Success. One row inserted.`

### Option B: Using Migration File

1. Open `supabase/migrations/004_create_test_admin.sql`
2. Replace `'YOUR_USER_UUID_HERE'` with your actual UUID
3. Replace `'test@example.com'` with your email
4. Run the migration in SQL Editor

## Step 3: Verify Admin Setup

Run this query to confirm:

```sql
SELECT * FROM public.admin_users;
```

You should see:
| id | user_id | email | display_name | is_active | created_at |
|---|---|---|---|---|---|
| (uuid) | 550e8400... | test@example.com | Test Admin | true | (timestamp) |

## Step 4: Test Login

1. Go to your app (http://localhost:3000 if running locally)
2. Click **Login**
3. Enter:
   - **Email**: `test@example.com`
   - **Password**: Your password from Step 1
4. Click **Sign In**

You should be redirected to the admin dashboard.

## Step 5: Create Sample Form (Optional)

Once logged in, you can:

1. Click **New Form**
2. Add a title (e.g., "Feedback Form")
3. Add sections and questions
4. Click **Publish** to make it live
5. Share the public link with testers

---

## Troubleshooting

### "Login failed" or "Unauthorized"

**Cause**: User not found in `admin_users` table

**Fix**:
1. Check the UUID is correct: `SELECT user_id FROM public.admin_users;`
2. If empty, re-run the INSERT statement with the correct UUID

### "User not an admin"

**Cause**: The `is_admin()` function is returning false

**Fix**:
1. Verify the user exists: `SELECT * FROM public.admin_users WHERE is_active = true;`
2. Check `is_active` is `true` (not false)

### "Database connection error"

**Cause**: RLS policies blocking access

**Fix**:
1. You must be authenticated as the test user to access admin areas
2. If policies are too restrictive, check `002_rls_and_storage.sql`

---

## Security Notes

⚠️ **For Production:**

- Use a **strong password** for the admin account
- Don't commit credentials to version control
- Use email-based auth or SSO for team members
- Rotate passwords regularly
- Enable 2FA if Supabase supports it

For testing/development, these minimal credentials are fine.

---

## Next Steps

Once admin account is set up:

1. ✅ Create test forms
2. ✅ Test public form submission
3. ✅ Test response viewing/filtering
4. ✅ Test bulk actions (status updates, exports)
5. ✅ Run E2E tests: `npm run test:e2e`

See `docs/testing.md` for detailed testing workflows.
