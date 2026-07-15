# 📋 Migration Guide - ITH-FORMS

## Complete List of Migrations (001-013)

This guide lists all migrations in order with their purpose and status.

---

## ✅ Already Run (Probably)

These migrations were likely run during initial setup:

### 001_init.sql
**Purpose:** Initial database schema  
**Creates:** Forms, sections, questions, submissions, audit_logs tables  
**Status:** ✅ Should already be run

### 002_audit_actor.sql
**Purpose:** Add actor tracking to audit logs  
**Status:** ✅ Should already be run

### 003_fixes.sql
**Purpose:** Early bug fixes  
**Status:** ✅ Should already be run

### 004_solutions_migration.sql
**Purpose:** Additional schema updates  
**Status:** ✅ Should already be run

### 005_security_hardening.sql
**Purpose:** RLS policies and security  
**Status:** ✅ Should already be run

### 006_dashboard_aggregates.sql
**Purpose:** Dashboard stats functions (OLD VERSION)  
**Status:** ✅ Should already be run (superseded by 008 and 013)

### 007_response_view_and_fixes.sql
**Purpose:** Response viewing and fixes  
**Status:** ✅ Should already be run

---

## 🔥 MUST RUN (For 8 Items Fix)

These migrations are REQUIRED for the 8 UI/UX improvements:

### ⚡ 008_complete_fixes.sql
**Purpose:** Complete fix for dashboard functions  
**Creates:**
- `get_dashboard_stats(p_days integer)` - Enhanced dashboard stats
- `get_daily_submission_trend(p_start_date text)` - Trend chart data
- `get_form_responses_tabular(...)` - Tabular response view

**When to Run:** If dashboard shows errors or won't load  
**Status:** ⚠️ RUN IF DASHBOARD IS BROKEN

**How to check if needed:**
```sql
-- Run this in Supabase SQL Editor:
SELECT public.get_dashboard_stats(7);
-- If error: run migration 008
-- If works: already run
```

---

### ⚡ 009_fix_audit_actor.sql
**Purpose:** Fix audit log actor_email auto-population  
**Creates:** Trigger to auto-fill actor_email from auth.users  
**Status:** ⚠️ RUN IF AUDIT LOG SHOWS BLANK ACTORS

**How to check if needed:**
```sql
-- Check audit logs:
SELECT action, actor_email FROM audit_logs ORDER BY created_at DESC LIMIT 10;
-- If actor_email is blank: run migration 009
-- If filled: already run
```

---

### ⚡ 010_per_form_reference_ids.sql ⭐ IMPORTANT
**Purpose:** Per-form reference IDs (Item 1 of 8)  
**Creates:**
- `form_submission_sequences` table
- `generate_form_abbreviation()` function
- `next_form_reference_id()` function
- Format: `ABBR-formid-00001`

**Status:** 🔴 **MUST RUN** - Required for Item 1

**Test after running:**
```sql
-- Submit a form and check reference_id format
SELECT reference_id FROM submissions ORDER BY submitted_at DESC LIMIT 5;
-- Should see: NXG-a1b2c3d4-00001 format
```

---

### ⚡ 011_public_view_response.sql ⭐ IMPORTANT
**Purpose:** Public response viewing (Item 8B of 8)  
**Creates:**
- `get_submission_by_reference(p_reference_id text)` function
- Public route: `/view-response/{referenceId}`

**Status:** 🔴 **MUST RUN** - Required for Item 8B

**Test after running:**
```sql
-- Test the function:
SELECT * FROM public.get_submission_by_reference('test-ref-id');
-- Should return result (or null if ref not found)
```

---

### ⚡ 012_fix_audit_log_actions.sql ⭐ IMPORTANT
**Purpose:** Restrict audit log to important actions only  
**Restricts to:**
- `admin.login`
- `admin.logout`
- `form.published`
- `form.unpublished`
- `form.deleted`

**Status:** 🔴 **MUST RUN** - Prevents clutter in audit log

**Test after running:**
```sql
-- Try to insert invalid action (should fail):
INSERT INTO audit_logs (action, entity) VALUES ('test.action', 'test');
-- Should get error: violates check constraint
```

---

### ⚡ 013_fix_dashboard_functions.sql ⭐ CRITICAL
**Purpose:** Fix dashboard to exclude soft-deleted items  
**Updates:**
- `get_dashboard_stats()` - Adds `WHERE deleted_at IS NULL`
- `get_daily_submission_trend()` - Adds `WHERE deleted_at IS NULL`

**Status:** 🔴 **MUST RUN** - Fixes dashboard dummy data issue

**Test after running:**
```sql
-- Check dashboard stats:
SELECT public.get_dashboard_stats(365);
-- Should return stats matching what you see in Forms page
```

---

## 🎯 Migration Order to Run

If you're not sure what's been run, run them in this order:

### 1️⃣ FIRST - Fix Dashboard (if broken)
```
008_complete_fixes.sql
```

### 2️⃣ SECOND - 8 Items Fixes (in order)
```
010_per_form_reference_ids.sql   (Item 1 - Per-form reference IDs)
011_public_view_response.sql     (Item 8B - Public view)
012_fix_audit_log_actions.sql    (Fix audit log clutter)
013_fix_dashboard_functions.sql  (Fix dashboard dummy data)
```

### 3️⃣ OPTIONAL - Audit Actor Fix (if needed)
```
009_fix_audit_actor.sql  (Only if actor_email is blank)
```

---

## 📝 How to Run Migrations

### Step 1: Open Supabase Dashboard
1. Go to https://supabase.com
2. Select your project
3. Click "SQL Editor" in left sidebar

### Step 2: Run Each Migration
1. Open migration file (e.g., `010_per_form_reference_ids.sql`)
2. Copy ENTIRE contents
3. Paste into SQL Editor
4. Click "Run" button
5. Wait for "Success" message
6. Move to next migration

### Step 3: Verify
After running all migrations, verify:
```sql
-- Check functions exist:
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%dashboard%' OR routine_name LIKE '%reference%'
ORDER BY routine_name;

-- Should see:
-- generate_form_abbreviation
-- get_dashboard_stats
-- get_daily_submission_trend
-- get_submission_by_reference
-- next_form_reference_id
```

---

## ⚠️ Common Issues

### Issue 1: "Function already exists"
**Solution:** Migration already run successfully. Skip it.

### Issue 2: "Permission denied"
**Solution:** You need to be project owner or have correct permissions.

### Issue 3: "Relation does not exist"
**Solution:** Earlier migrations not run. Run migrations in order from 001.

### Issue 4: Dashboard still shows dummy data
**Solution:** Run migration 013 then refresh browser (hard refresh: Ctrl+Shift+R)

---

## ✅ Quick Checklist

After running all migrations, test:

- [ ] Dashboard loads without errors
- [ ] Dashboard shows correct stats (matches Forms page)
- [ ] Submit form → Reference ID format: `ABBR-xxxxx-00001`
- [ ] Visit `/view-response/{referenceId}` → Works
- [ ] Audit log only shows: login, logout, published, deleted
- [ ] Recent submissions update correctly

---

## 📞 Need Help?

If migrations fail or you're unsure:
1. Check the error message carefully
2. Copy the full error
3. Check which line failed
4. Ask for help with the specific error and migration number

**All migrations have clear headers now!** Look for:
```
-- ==================================================================
-- 0XX_migration_name.sql
-- Description of what it does
-- ==================================================================
```

---

## 🎉 Summary

**Total Migrations:** 13  
**Already Run:** 001-007 (probably)  
**Must Run Now:** 010, 011, 012, 013  
**Optional:** 008, 009 (if dashboard broken or audit log blank)  

**Run migrations 010, 011, 012, 013 and you're done!** 🚀

---

## 🔐 BONUS: Add Yourself as Admin

### Migration 014 - Add Admin User
**File:** `014_add_your_admin_user.sql`  
**Purpose:** Make yourself (or others) an admin  
**Important:** Replace the user_id and email with YOUR details

**How to use:**
1. Sign up/login to your app first
2. Find your user_id: `SELECT id, email FROM auth.users;`
3. Edit `014_add_your_admin_user.sql` with your user_id
4. Run the migration
5. You're now an admin!

**Note:** The `admin_users` table exists (created in migration 001), but you need to manually add users for security reasons.
