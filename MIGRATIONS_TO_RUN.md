# Quick: Run These Migrations in Supabase SQL Editor

**Status**: Ready to run. Just copy-paste each SQL file into your Supabase SQL editor.

**Time**: ~5 minutes total

---

## Step 1: Open Supabase SQL Editor

1. Go to https://app.supabase.com
2. Select your project: `zkaeourngxwykkhapotj`
3. Click **SQL Editor** (left sidebar)
4. Click **New Query**

---

## Step 2: Run Each Migration (In This Order)

Copy the SQL from each file below and paste into the SQL editor, then click **Run**:

### Migration 001-005 (Setup)
```
Copy entire content of: supabase/migrations/001_init.sql
Run it
```
↓
```
Copy entire content of: supabase/migrations/002_audit_actor.sql
Run it
```
↓
```
Copy entire content of: supabase/migrations/003_fixes.sql
Run it
```
↓
```
Copy entire content of: supabase/migrations/004_solutions_migration.sql
Run it
```
↓
```
Copy entire content of: supabase/migrations/005_security_hardening.sql
Run it
```

### Migration 006-014 (Core)
Continue with:
- 006_dashboard_aggregates.sql
- 007_response_view_and_fixes.sql
- 008_complete_fixes.sql
- 009_fix_audit_actor.sql
- 010_per_form_reference_ids.sql
- 011_public_view_response.sql
- 012_fix_audit_log_actions.sql
- 013_fix_dashboard_functions.sql
- **014_add_your_admin_user.sql** ⚠️ EDIT FIRST!

### For 014: EDIT FIRST
Before running 014, find this line:
```sql
INSERT INTO public.admin_users (user_id, email)
VALUES ('your-user-id-here', 'your-email@example.com');
```

Replace:
- `'your-user-id-here'` with your actual Supabase user ID
- `'your-email@example.com'` with YOUR email (innotechhub.edu@gmail.com)

Then run it.

### Migration 015-018 (Config & Fixes - Order Matters!)
1. 015_file_upload_configuration.sql (config track)
2. 016_linear_scale_configuration.sql (config track)
3. 017_question_config.sql (config track)
4. 018_reset_reference_sequences.sql (config track)
5. 015_expand_audit_actions.sql (fix track)
6. 016_fix_double_increment.sql (fix track)
7. 017_fix_checkbox_delimiter.sql (fix track)
8. 018_validate_scale_values.sql (fix track)

### Migration 019-023 (Modern Features) ⚠️ CRITICAL UPDATE
Continue with:
- 019_normalize_yes_no_values.sql
- 020_production_readiness.sql
- 021_responses_date_filter.sql
- 022_save_form_builder.sql
- **023_audit_actions_canonical.sql** ← UPDATED FOR PHASE 0 ✅

### Migration 024-055 (Optional but Recommended)
For full security hardening, continue with all files 024-055.

---

## Shortcut: Copy-Paste All at Once

If you want to run everything in one go (faster but harder to debug if error):

1. Go to `supabase/migrations/ALL_MIGRATIONS_COMBINED.sql`
2. Copy ALL content
3. Paste into Supabase SQL editor
4. Click **Run**

This runs everything in one transaction. If any error, whole thing rolls back.

---

## How to Know It Worked

After running all migrations:

**In Supabase SQL Editor**, run this query:

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'audit_logs_action_check';
```

Should show constraint includes these 3 NEW actions:
- `submit_response_email_mismatch`
- `submit_response_rate_limited`
- `file_upload_path_traversal_attempt`

If you see them → ✅ Migrations worked!

---

## If Error

If a migration fails:

1. **Note the error message**
2. **Check if it's idempotent** (most are - see notes below)
3. **Try running just that migration again**
4. Most errors are harmless (table already exists, etc.)

Common safe-to-ignore errors:
```
ERROR: relation "X" already exists
ERROR: function "Y" already exists
ERROR: policy "Z" already exists
```

These mean you've run them before. Just continue to next migration.

---

## Done!

After all migrations run successfully:

✅ Database schema is up to date  
✅ All functions created  
✅ All policies in place  
✅ Admin user created  
✅ Critical Phase 0 fix applied (migration 023)

You're now ready to deploy the app code!

---

**Next**: Follow `DEPLOYMENT_READY.md` to deploy the app.
