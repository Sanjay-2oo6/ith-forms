# Migration Deployment Checklist
## Which migrations to run for Phase 0-3 deployment

**Status**: Phase 0-3 complete — only ONE migration was modified  
**Critical**: Must run the updated migration 023 before deployment  
**Timeline**: 5 minutes to run all migrations  

---

## ⚠️ CRITICAL: Migration 023 Was Modified

**File**: `supabase/migrations/023_audit_actions_canonical.sql`

**Change**: Added 3 new audit actions to CHECK constraint:
- `submit_response_email_mismatch` (from migration 053)
- `submit_response_rate_limited` (from migration 053)
- `file_upload_path_traversal_attempt` (from migration 055)

**Why**: Without these actions in the constraint, form submissions with email validation or rate limiting will crash with database error.

---

## 📋 Migrations to Run (Canonical Order)

This is the **COMPLETE canonical order** from `docs/migrations.md`. Run them in this sequence in Supabase SQL editor.

### Setup Migrations (001-005)
```sql
-- Run these ONCE (if fresh environment)
001_init.sql
002_audit_actor.sql
003_fixes.sql
004_solutions_migration.sql
005_security_hardening.sql
```

### Core Functionality (006-014)
```sql
006_dashboard_aggregates.sql
007_response_view_and_fixes.sql
008_complete_fixes.sql
009_fix_audit_actor.sql
010_per_form_reference_ids.sql
011_public_view_response.sql
012_fix_audit_log_actions.sql
013_fix_dashboard_functions.sql
014_add_your_admin_user.sql  ← ⚠️ EDIT FIRST! (see below)
```

### Parallel Track Migrations (015-018) — Order Matters!
```sql
-- First: File upload + scale configuration (config track)
015_file_upload_configuration.sql
016_linear_scale_configuration.sql
017_question_config.sql
018_reset_reference_sequences.sql

-- Then: Bug fixes (fix track) — some depend on config above
015_expand_audit_actions.sql
016_fix_double_increment.sql
017_fix_checkbox_delimiter.sql
018_validate_scale_values.sql  ← Must be AFTER 016 (needs scale_min/max)
```

### Modern Features (019-023)
```sql
019_normalize_yes_no_values.sql
020_production_readiness.sql
021_responses_date_filter.sql
022_save_form_builder.sql
023_audit_actions_canonical.sql  ← ✅ UPDATED FOR PHASE 0
```

### Optional: Google OAuth (044-046)
```sql
044_google_oauth_schema.sql       ← Only if using Google OAuth
045_google_oauth_rpcs.sql         ← Only if using Google OAuth
046_auto_provision_admin_on_login.sql  ← Only if using Google OAuth
```

### Optional: Security Hardening (050-055)
```sql
050_fix_reference_id_enumeration.sql    ← Security fix
051_fix_verified_emails_rls.sql         ← Security fix
052_fix_auto_admin_provisioning.sql     ← Security fix
053_add_email_validation_to_submit_response.sql  ← CRITICAL for Phase 0
054_add_rate_limiting_to_submit_response.sql     ← Security
055_fix_file_path_traversal.sql                  ← CRITICAL for Phase 0
```

---

## 🚀 Quick Deploy (Fresh Environment)

If starting from scratch (fresh Supabase project):

1. **Open Supabase SQL editor** (your project → SQL Editor)

2. **Run each migration file IN ORDER** (copy-paste from file into editor, run)

3. **Important steps:**
   - Before 014: Edit `supabase/migrations/014_add_your_admin_user.sql`
     - Replace `your-email@example.com` with YOUR email
     - Replace `your-user-id-here` with your Supabase auth user_id
   
   - After 023: Verify migration ran without errors
     - Should update the audit_logs CHECK constraint
     - Should see: `ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS`
     - Should see: `ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check`

4. **Done!** All migrations applied in correct order

---

## 🔄 Upgrade Existing Environment

If you already have an older version deployed:

### Recommended: Run Complete Canonical Sequence

Best approach: Run ALL migrations in canonical order. Most are idempotent:
- `IF NOT EXISTS` clauses skip creation of existing objects
- `CREATE OR REPLACE` overwrites functions
- `DROP POLICY IF EXISTS` handles existing policies

**Time**: ~5 minutes for all migrations

**Risk**: Very low (everything is idempotent)

**Procedure**:
```bash
# In Supabase SQL editor, run migrations in order:
# 001 → 002 → 003 → ... → 023

# Each migration shows:
# ✓ Tables created / altered
# ✓ Functions created / replaced
# ✓ Policies applied
# ✓ Triggers created
```

### Minimum: Just Run Updated 023

If you want to ONLY fix the critical issue:

```sql
-- Just run this ONE file:
-- supabase/migrations/023_audit_actions_canonical.sql

-- This will:
-- ✓ Drop old audit_logs_action_check constraint
-- ✓ Create new constraint with ALL 13 audit actions (including 3 new ones)
-- ✓ Preserve all existing audit log rows (idempotent)
```

**⚠️ Warning**: If you're missing migrations 050-055, you may have other issues:
- No rate limiting on form submissions
- No email validation on submissions
- File path traversal vulnerability unfixed

---

## ✅ Verification After Running Migrations

### Check 1: Audit Actions Constraint

```sql
-- In Supabase SQL editor, run:
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'audit_logs_action_check';

-- Should show:
-- audit_logs_action_check | CHECK (action IN (
--   'admin.login', 'admin.logout',
--   'form.created', 'form.published', 'form.unpublished', 'form.deleted', 'form.restored', 'form.updated',
--   'theme.updated',
--   'submission.status_changed', 'submission.exported',
--   'submit_response_email_mismatch',           ← NEW
--   'submit_response_rate_limited',              ← NEW
--   'file_upload_path_traversal_attempt'         ← NEW
-- ))
```

### Check 2: Key Functions Exist

```sql
-- Verify these RPCs exist (should return 1 each):
SELECT COUNT(*) FROM pg_proc WHERE proname = 'submit_response';
SELECT COUNT(*) FROM pg_proc WHERE proname = 'get_form_responses_tabular';
SELECT COUNT(*) FROM pg_proc WHERE proname = 'save_form_builder';
SELECT COUNT(*) FROM pg_proc WHERE proname = 'register_submission_file';

-- All should return: 1
```

### Check 3: Tables Exist

```sql
-- Verify core tables:
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_name IN ('forms', 'form_sections', 'form_questions', 'submissions', 'audit_logs')
AND table_schema = 'public';

-- Should return: 5
```

---

## 🆘 Troubleshooting

### "Error: Relation 'forms' does not exist"

**Cause**: Migration 001 didn't run

**Solution**: Scroll to top of migration list, run 001-005 first

### "Error: Function submit_response already exists"

**Cause**: 018_validate_scale_values.sql tries to create, but function already exists

**Solution**: This is fine (handled by `DROP FUNCTION IF EXISTS` in migration). Just means you ran it before. Continue to next migration.

### "Error: Constraint audit_logs_action_check already exists"

**Cause**: Migration 023 tries to add, but constraint already exists

**Solution**: Idempotent — migration handles with `DROP CONSTRAINT IF EXISTS`. This is correct behavior.

### "Error: Audit log insertion fails with 'violates check constraint'"

**Cause**: Migration 023 didn't run, or ran incorrectly

**Solution**: 
1. Run migration 023 again
2. Verify constraint with Check 1 query above
3. If still fails, check the actual constraint in your DB

---

## 📊 Migration Summary Table

| # | File | Purpose | Must Run? | Phase 0-3? |
|---|------|---------|-----------|-----------|
| 001-005 | Setup | Schema, auth, security | ✅ Yes | Core |
| 006-013 | Core | Forms, submissions, audit | ✅ Yes | Core |
| 014 | Admin | Add first admin (EDIT!) | ✅ Yes | Core |
| 015-018 | Config/Fixes | Fields, functions | ✅ Yes | Core |
| 019-023 | Modern | Date filter, builder, audit | ✅ Yes | ✅ **023 Updated** |
| 044-046 | OAuth | Google login (optional) | ❌ No | Optional |
| 050-052 | Security | RLS, auto-provision | ⚠️ Optional | Optional |
| 053-055 | Security | Email validation, rate limit, file path | ✅ Critical | Optional but recommended |

---

## 🎯 For Phase 0-3 Deployment

**Minimum** (just fix the blocker):
- Run ONLY `023_audit_actions_canonical.sql`

**Recommended** (full system):
- Run ALL migrations 001-023 in canonical order
- Optionally add 050-055 for full security hardening

**Complete** (enterprise ready):
- Run ALL migrations 001-055 in canonical order

---

## 📝 Environment-Specific Notes

### Fresh Supabase Project
1. Run all migrations 001-023 (or 001-055 for full security)
2. Must edit 014 first (your admin email + user_id)
3. Takes ~5 minutes
4. Then deploy app code

### Existing Production
1. Check which migrations are already applied
2. Run missing ones in canonical order
3. CRITICAL: Must run updated 023
4. Then deploy app code

### Staging/Test Environment
1. Run complete sequence 001-055 for testing
2. This tests the exact path production will take
3. Verify no errors before production deploy

---

## ✅ Deployment Checklist

- [ ] Backed up Supabase database (or have restore point)
- [ ] Read this guide completely
- [ ] Identified which environment (fresh/existing)
- [ ] Have Supabase SQL editor open
- [ ] Know your admin email + user_id (for migration 014)
- [ ] Running migrations in correct order
- [ ] After each migration: checked for errors
- [ ] After all: Ran verification queries (Check 1-3 above)
- [ ] All checks passed ✅
- [ ] Ready to deploy app code

---

**TL;DR**: Run migrations 001-023 in order from `docs/migrations.md`. Migration 023 was updated — this is the critical fix for Phase 0. Takes 5 minutes.
