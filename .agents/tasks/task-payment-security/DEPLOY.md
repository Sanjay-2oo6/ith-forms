# Payment Security Implementation — Deployment Guide

**Status**: Implementation complete and reviewed. Ready for production deployment.

**Branch**: `payment-security-implementation` (current working branch)

**Target**: `main` branch (production)

---

## Pre-Deployment Checklist

Before deploying to production, ensure:

- [ ] All integration tests pass locally: `npm run test:rpc`
- [ ] TypeScript compilation succeeds: `npm run typecheck`
- [ ] Production build completes: `npm run build`
- [ ] Razorpay credentials configured in production environment
- [ ] Backup current database schema (Supabase dashboard → Database → Backups)
- [ ] Review changelog and understand what will change
- [ ] Schedule maintenance window if high-traffic form submissions expected

---

## Database Migration Steps

These migrations MUST be run manually in the Supabase SQL Editor in numeric order.

### Step 1: Migration 065 — Schema Update

**File**: `supabase/migrations/065_nullable_submission_id_for_payments.sql`

**What it does**: Makes `payment_transactions.submission_id` nullable with check constraint to enable payment-first flow.

**How to run**:
1. Log in to Supabase dashboard: https://app.supabase.com
2. Navigate to SQL Editor (left sidebar)
3. Open the migration file: `d:\ITHub\ith-forms\supabase\migrations\065_nullable_submission_id_for_payments.sql`
4. Copy the entire file contents
5. Paste into SQL Editor
6. Click "Run" (or press Ctrl+Enter)

**Expected output**:
```
Migration 065: payment_transactions.submission_id is now nullable with verification constraint
```

**Verification query**:
```sql
-- Check that submission_id is nullable
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'payment_transactions'
  AND column_name = 'submission_id';
-- Expected: is_nullable = 'YES'

-- Check constraint exists
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'verified_payments_have_submission';
-- Expected: one row with CHECK clause
```

**Rollback** (if needed):
```sql
-- Only rollback if no NULL submission_ids exist
ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS verified_payments_have_submission;

ALTER TABLE public.payment_transactions
  ALTER COLUMN submission_id SET NOT NULL;
```

---

### Step 2: Migration 066 — Update Payment RPC

**File**: `supabase/migrations/066_update_payment_rpcs_for_nullable_submission.sql`

**What it does**: Updates `record_payment_transaction` to accept dual modes (pre-payment with form_id, post-payment with submission_id).

**How to run**:
1. Same process as Step 1
2. Copy contents of `066_update_payment_rpcs_for_nullable_submission.sql`
3. Paste into SQL Editor
4. Click "Run"

**Expected output**:
```
Migration 066: Updated record_payment_transaction for nullable submission_id support
```

**Verification query**:
```sql
-- Check function signature includes p_form_id parameter
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_name = 'record_payment_transaction'
  AND specific_schema = 'public';
-- Expected: routine_definition includes 'p_form_id uuid' parameter

-- Test function can be called with NULL submission_id
-- (Don't run in production without valid payment credentials!)
```

**Rollback** (if needed):
```sql
-- Restore migration 063 version (from supabase/migrations/063_razorpay_payment_integration.sql)
-- Copy the CREATE OR REPLACE FUNCTION record_payment_transaction from that file
```

---

### Step 3: Migration 067 — Server-Side Payment Verification

**File**: `supabase/migrations/067_fix_submit_response_payment_verification.sql`

**What it does**: Updates `submit_response` to link pre-recorded payments and verify all payment questions before allowing submission.

**How to run**:
1. Same process as Steps 1 & 2
2. Copy contents of `067_fix_submit_response_payment_verification.sql`
3. Paste into SQL Editor
4. Click "Run"

**Expected output**:
```
Migration 067: Fixed payment verification - links pre-recorded payments, enforces >= 100 paise minimum
```

**Verification query**:
```sql
-- Check function signature includes optional p_submission_id parameter
SELECT routine_name, data_type, ordinal_position, parameter_name
FROM information_schema.parameters
WHERE specific_schema = 'public'
  AND specific_name LIKE 'submit_response%'
ORDER BY specific_name, ordinal_position;
-- Expected: Two overloads (5-param and 6-param versions)

-- Check audit_logs action constraint includes new bypass action
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'audit_logs_action_check';
-- Expected: CHECK clause includes 'submit_response_payment_bypass_blocked'
```

**Rollback** (if needed):
```sql
-- Restore migration 064 version (from supabase/migrations/064_secure_payment_verification.sql)
-- Copy the CREATE OR REPLACE FUNCTION submit_response from that file
```

---

## Frontend Deployment

After all three migrations are successfully applied:

1. **Merge to main**:
   ```powershell
   git checkout main
   git merge payment-security-implementation
   git push origin main
   ```

2. **Vercel auto-deploys** from main branch (typically 2-5 minutes)

3. **Hard refresh browsers** after deploy: Press Ctrl+Shift+R (or Cmd+Shift+R on Mac)

---

## Manual Testing Checklist

Test these scenarios in production AFTER deployment:

### Test 1: Payment-Required Form (Happy Path)
- [ ] Create a test form with a payment question (amount: 10000 paise = ₹100)
- [ ] Add other questions (name, email, etc.)
- [ ] Publish the form
- [ ] Open form as public user (incognito/private browsing)
- [ ] Sign in with Google (required per migration 059)
- [ ] Fill all questions
- [ ] Click payment button
- [ ] Complete Razorpay test payment (use test card: 4111 1111 1111 1111)
- [ ] Submit form
- [ ] Verify success message appears
- [ ] Check Supabase dashboard → Authentication → Users to confirm submission created
- [ ] Check `payment_transactions` table: verify `verified = true` and `submission_id` is set
- [ ] Check `submissions` table: verify submission exists with correct reference_id

### Test 2: Dev-Tools Bypass Prevention (Security Test)
- [ ] Create same form as Test 1
- [ ] Open form as public user
- [ ] Sign in with Google
- [ ] Fill all questions
- [ ] Open browser dev tools (F12)
- [ ] In Console, type: `window.__pendingPayments = []` (simulate removing payment)
- [ ] Try to submit form
- [ ] **Expected**: Error message "Payment verification required. Please complete payment..."
- [ ] Check `audit_logs` table: verify row with action = `submit_response_payment_bypass_blocked`
- [ ] Check `submissions` table: verify NO submission created for this attempt

### Test 3: Backward Compatibility (Forms Without Payment)
- [ ] Create a form WITHOUT any payment questions
- [ ] Publish the form
- [ ] Open as public user
- [ ] Sign in with Google
- [ ] Fill and submit form
- [ ] **Expected**: Submission succeeds normally (no payment verification)
- [ ] Verify submission appears in admin dashboard

### Test 4: Legacy Payment Questions (Amount < 100 paise)
- [ ] Create a form with payment question
- [ ] In builder, set `razorpayAmount: null` or `< 100` in config
- [ ] Publish form
- [ ] Submit without payment
- [ ] **Expected**: Submission succeeds (backward compatibility for legacy configs)

### Test 5: Signature Verification Failure
This test requires modifying Razorpay signature (advanced testing):
- [ ] Intercept network request to `record_payment_transaction`
- [ ] Alter the `razorpay_signature` parameter to incorrect value
- [ ] Attempt to submit
- [ ] **Expected**: Error "Payment verification failed. If you completed payment, contact support."
- [ ] Check `payment_transactions` table: verify `verified = false` and `status = 'failed'`

### Test 6: Stale Payment Reuse Prevention
- [ ] Complete payment for a form (Test 1 scenario)
- [ ] Wait 1 hour (or manually update `payment_transactions.created_at` to 2 hours ago)
- [ ] Try to submit again with same payment
- [ ] **Expected**: Error about payment verification (old payment not linked)
- [ ] Check `audit_logs`: verify bypass attempt logged

---

## Monitoring After Deployment

Watch these metrics for 24-48 hours:

1. **Supabase Dashboard → Logs**:
   - Filter for `submit_response_payment_bypass_blocked` in audit_logs
   - Any entries? Investigate if legitimate users are being blocked

2. **Error Tracking** (if Sentry configured):
   - Monitor for increased errors related to payment submission
   - Check for signature verification failures (could indicate Razorpay config issue)

3. **Form Submission Rate**:
   - Compare submission rates before/after deployment
   - Drop in submissions? Check if payment flow has UX issues

4. **Database Query Performance**:
   - Monitor query performance on `submit_response` RPC
   - The new payment verification adds UPDATE + SELECT per payment question
   - Expect minimal impact (< 50ms per payment question)

---

## Rollback Procedure

If critical issues arise after deployment:

### Database Rollback (Emergency)

Run these queries in SQL Editor to restore pre-065 behavior:

```sql
-- Step 1: Restore submit_response to migration 064 version
-- (Copy from supabase/migrations/064_secure_payment_verification.sql)

-- Step 2: Restore record_payment_transaction to migration 063 version
-- (Copy from supabase/migrations/063_razorpay_payment_integration.sql)

-- Step 3: Re-add NOT NULL constraint (only if no NULL submission_ids exist)
UPDATE public.payment_transactions
SET submission_id = gen_random_uuid()  -- Emergency: link orphans to dummy submissions
WHERE submission_id IS NULL;

ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS verified_payments_have_submission;

ALTER TABLE public.payment_transactions
  ALTER COLUMN submission_id SET NOT NULL;
```

### Frontend Rollback

```powershell
# Revert the merge commit
git revert -m 1 <merge-commit-hash>
git push origin main
```

Vercel will auto-deploy the reverted version.

---

## Known Issues / Edge Cases

1. **1-hour payment window**: If a user completes payment but doesn't submit within 1 hour, they must restart payment. This is intentional to prevent stale payment reuse.

2. **Multiple payment questions**: Each payment question requires separate Razorpay checkout. User must complete all payments before submitting.

3. **Razorpay test mode**: Test payments use different credentials than production. Ensure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set correctly for the environment.

4. **Google OAuth required**: Per migration 059, all submissions require Google sign-in. Anonymous submissions are not supported.

---

## Support Resources

- **Razorpay Dashboard**: https://dashboard.razorpay.com
- **Supabase Dashboard**: https://app.supabase.com
- **Vercel Dashboard**: https://vercel.com
- **Implementation Review**: `.agents/tasks/task-payment-security/2025-01-20-120000-review.md`
- **Test Coverage**: `tests/integration/rpc.test.ts` (search for "Payment Security Verification")

---

## Success Criteria

Deployment is successful when:

- ✅ All three migrations run without errors
- ✅ Frontend deploys to production (Vercel build succeeds)
- ✅ Manual Test 1 (happy path) passes
- ✅ Manual Test 2 (bypass prevention) passes
- ✅ Manual Test 3 (backward compatibility) passes
- ✅ No unexpected errors in Supabase logs for 24 hours
- ✅ Form submission rates remain stable

---

**Last Updated**: 2025-01-20

**Implementation Team**: AI Agent Workflow `wf_9109c832900c8637`

**Review Status**: APPROVED (see verdict.json)

**Ready to Deploy**: YES (pending user approval)
