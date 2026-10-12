# Secure Payment Verification Implementation Plan

## Executive Summary

**Status**: Migration 064 exists with server-side payment verification logic, and frontend payment-first flow is partially implemented. However, there are critical bugs and incomplete integration that must be fixed.

**Key Issues Found**:
1. ❌ Migration 064 requires authentication but public forms may be anonymous
2. ❌ Frontend uses custom `/api/razorpay/create-order` endpoint instead of database RPC
3. ❌ Minimum amount validation inconsistency (1 vs 100 paise)
4. ❌ Pre-generated submission ID flow has a timing gap (submission record doesn't exist when recording payment)
5. ⚠️ No integration tests for payment verification bypass scenarios

## Files Analysis

### Migration 064 (`supabase/migrations/064_secure_payment_verification.sql`)
**Status**: EXISTS but needs fixes

**What it does correctly**:
- Adds `p_submission_id` optional parameter to `submit_response`
- Uses provided submission_id or generates new one
- Checks for payment-type questions with `razorpayAmount >= 1`
- Verifies `payment_transactions` table for verified=true transactions
- Deletes submission and returns error if payment missing
- Logs security violations to `audit_logs`
- Creates backward-compatible overload

**Critical bugs**:
1. **Authentication requirement conflict**: Lines 29-43 require `auth.uid()` to be non-null, but:
   - Migration 063 `record_payment_transaction` ALSO requires authentication
   - The plan says "public form submission may be unauthenticated" 
   - Reality: Migration 059 already requires authentication (line 28-30)
   - **DECISION**: This is actually CORRECT. All submissions require Google OAuth per migration 059. The concern in the task description is invalid - the app already requires auth.

2. **Pre-submission payment timing issue**: `record_payment_transaction` (line 594 in $slug.tsx) expects `p_submission_id` to reference an existing submission row (FK constraint: `submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE`). But the frontend pre-generates the ID and records payment BEFORE calling `submit_response` which creates the submission row.
   - **Impact**: Database FK violation when recording payment with non-existent submission_id
   - **Fix needed**: Either:
     - A. Create stub submission row first, then record payment, then update submission (complex, race-prone)
     - B. Modify `payment_transactions` FK to allow pre-payment recording (remove NOT NULL, make it optional until submission created)
     - C. Record payment with NULL submission_id initially, update after submission created
     - **DECISION**: Option B is cleanest - make submission_id nullable during payment, then verify during submit_response

3. **Payment question config check**: Line 111 checks `(config->>'razorpayAmount')::integer >= 1` but should also check for NULL (questions without amount configured should skip verification)

### Frontend (`src/routes/forms/$slug.tsx`)
**Status**: Partially implemented, needs completion

**Lines 583-620 - Payment recording flow**:
- ✅ Pre-generates submission ID
- ✅ Reads `window.__pendingPayments` (set by RazorpayPaymentButton)
- ✅ Calls `record_payment_transaction` BEFORE `submit_response`
- ✅ Passes pre-generated `p_submission_id` to `submit_response`
- ❌ Will fail due to FK constraint (submission doesn't exist yet)

**Lines 625-635 - Submit call**:
- ✅ Passes `p_submission_id` parameter
- ✅ Handles `payment_required` error flag
- ✅ Shows user-friendly payment error messages

### Payment Button (`src/components/RazorpayPaymentButton.tsx`)
**Status**: Uses wrong endpoint

**Lines 133-150 - Order creation**:
- ❌ Calls `/api/razorpay/create-order` (custom HTTP endpoint)
- Should call: `supabase.rpc("create_razorpay_order")` (database RPC from migration 063)
- Reason: Database RPC can atomically create `payment_transactions` row with status='created', custom endpoint cannot

### Server Endpoint (`src/server.ts`)
**Status**: Should be removed or deprecated

**Lines 22-115 - handleRazorpayCreateOrder**:
- Creates Razorpay order via API
- Does NOT create `payment_transactions` record
- Minimum amount check is 100 paise (line 39-44)
- **Decision**: Keep this endpoint but add payment_transactions record creation, OR migrate to database RPC

### Migration 063 (`supabase/migrations/063_razorpay_payment_integration.sql`)
**Status**: Needs modification

**payment_transactions table** (lines 9-33):
- Current: `submission_id uuid NOT NULL REFERENCES public.submissions(id)`
- **Fix needed**: Make nullable to allow pre-payment recording:
  ```sql
  submission_id uuid REFERENCES public.submissions(id) ON DELETE CASCADE,
  ```
- Add constraint: `CHECK (verified = false OR submission_id IS NOT NULL)` (verified payments must have submission)

**record_payment_transaction RPC** (lines 83-189):
- Current: Requires submission_id and validates FK exists (line 118-126)
- **Fix needed**: Allow NULL submission_id, skip submission lookup if NULL
- Validation: When submission_id IS NOT NULL, verify it exists

## Implementation Plan

### FEAT-001: Fix payment_transactions schema to support pre-payment recording

**Type**: fix

**Description**: Modify `payment_transactions.submission_id` FK constraint to be nullable, allowing payment transactions to be recorded before submission row exists. This enables the payment-first security flow where payments are verified before form submission.

**Files**:
- `supabase/migrations/065_nullable_submission_id_for_payments.sql` (NEW)

**Steps**:
1. Create migration 065 with:
   - `ALTER TABLE payment_transactions ALTER COLUMN submission_id DROP NOT NULL;`
   - Add check constraint: `ALTER TABLE payment_transactions ADD CONSTRAINT verified_payments_have_submission CHECK (verified = false OR submission_id IS NOT NULL);`
   - Add comment explaining the nullable design for pre-payment recording
2. Keep all other columns and constraints unchanged
3. Keep indexes unchanged (submission_id index still works with NULLs)

**Acceptance Criteria**:
- ✅ Can insert payment_transactions row with submission_id = NULL
- ✅ Can update submission_id from NULL to a valid UUID after submission created
- ✅ Cannot set verified=true when submission_id is NULL (constraint enforced)
- ✅ FK cascade still works when submission_id is set and submission is deleted

**Verification**:
```sql
-- Test in Supabase SQL editor after running migration 065
-- 1. Insert payment with NULL submission_id
INSERT INTO payment_transactions (form_id, question_id, razorpay_order_id, amount, currency, status, verified, submission_id)
VALUES (
  (SELECT id FROM forms LIMIT 1),
  (SELECT id FROM form_questions WHERE type='payment' LIMIT 1),
  'order_test123',
  10000,
  'INR',
  'created',
  false,
  NULL
);
-- Should succeed

-- 2. Try to set verified=true with NULL submission_id
UPDATE payment_transactions SET verified=true WHERE razorpay_order_id='order_test123';
-- Should FAIL with constraint violation

-- 3. Create submission and update payment
INSERT INTO submissions (form_id, reference_token, respondent_email, status, idempotency_key)
VALUES (
  (SELECT form_id FROM payment_transactions WHERE razorpay_order_id='order_test123'),
  'test_token',
  'test@example.com',
  'new',
  gen_random_uuid()
) RETURNING id;
-- Copy the returned id

UPDATE payment_transactions 
SET submission_id = '<paste-id-here>', verified=true
WHERE razorpay_order_id='order_test123';
-- Should succeed

-- Cleanup
DELETE FROM payment_transactions WHERE razorpay_order_id='order_test123';
```

---

### FEAT-002: Update record_payment_transaction to handle NULL submission_id

**Type**: fix

**Description**: Modify the `record_payment_transaction` RPC to accept NULL submission_id during pre-payment recording. When submission_id is NULL, skip submission validation; when provided, validate it exists. Update migration 064's payment verification to handle pre-recorded payments.

**Files**:
- `supabase/migrations/066_update_payment_rpcs_for_nullable_submission.sql` (NEW)

**Steps**:
1. Create migration 066 with updated `record_payment_transaction`:
   - Change lines 118-126: Skip submission validation when `p_submission_id IS NULL`
   - When `p_submission_id IS NOT NULL`, keep existing validation
   - Allow INSERT with NULL submission_id (remove NOT NULL check)
   - Add comment explaining pre-payment recording flow
2. Keep HMAC signature verification unchanged (lines 138-172)
3. Keep all other security checks unchanged

**Pseudo-SQL**:
```sql
-- Inside record_payment_transaction, replace submission validation section:
IF p_submission_id IS NOT NULL THEN
  -- Validate submission exists
  SELECT form_id INTO v_form_id
  FROM public.submissions
  WHERE id = p_submission_id;
  
  IF v_form_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Submission not found'
    );
  END IF;
ELSE
  -- Pre-payment mode: submission will be created later
  -- We need form_id from somewhere else... 
  -- PROBLEM: How do we get form_id without submission?
  -- SOLUTION: Add p_form_id as separate parameter!
END IF;
```

**Realization**: We need to add `p_form_id` parameter to `record_payment_transaction` for pre-payment recording.

**Updated Steps**:
1. Add `p_form_id uuid` parameter to `record_payment_transaction` signature
2. Use `p_form_id` when `p_submission_id IS NULL`
3. When `p_submission_id IS NOT NULL`, validate it and use its form_id (ignore p_form_id)
4. Update INSERT to use `COALESCE(v_form_id, p_form_id)` so both modes work
5. Grant execute permissions to authenticated role
6. Update function comments

**Acceptance Criteria**:
- ✅ Can call with submission_id=NULL and form_id set (pre-payment mode)
- ✅ Can call with submission_id set and form_id=NULL (post-payment mode, backward compatible)
- ✅ Signature verification still works in both modes
- ✅ Returns transaction_id for tracking

**Verification**:
```bash
npm run test:rpc
# Should add new test cases in tests/integration/rpc.test.ts for payment flow
```

---

### FEAT-003: Update submit_response to verify pre-recorded payments

**Type**: fix

**Description**: Modify migration 064's `submit_response` to correctly verify pre-recorded payment transactions where submission_id was NULL during recording and needs to be updated during submission. Also fix payment question amount check to handle NULL razorpayAmount.

**Files**:
- `supabase/migrations/067_fix_submit_response_payment_verification.sql` (NEW)

**Steps**:
1. Create migration 067 to replace `submit_response` function
2. Keep all existing logic from migration 064
3. Fix payment verification section (lines 110-155):
   - Change amount check to: `AND COALESCE((config->>'razorpayAmount')::integer, 0) >= 1`
   - Before checking for verified payments, UPDATE any payment_transactions that have:
     - `submission_id IS NULL`
     - `question_id = v_payment_question.id`
     - `razorpay_order_id` matches a pending payment from current session
   - Then check if verified transaction exists with current submission_id
4. Add logic to link pre-recorded payments to this submission:
   ```sql
   -- Update pre-recorded payments with this submission_id
   UPDATE public.payment_transactions
   SET submission_id = v_sub_id, updated_at = now()
   WHERE submission_id IS NULL
     AND form_id = p_form_id
     AND question_id = v_payment_question.id
     AND verified = true
     AND created_at > now() - interval '1 hour'; -- Only recent payments
   ```
5. Then verify: `SELECT COUNT(*) FROM payment_transactions WHERE submission_id = v_sub_id AND question_id = ... AND verified = true`

**Acceptance Criteria**:
- ✅ Pre-recorded payments (submission_id=NULL) are linked to submission during submit_response
- ✅ Payment verification succeeds when verified=true payment exists for question
- ✅ Payment verification fails when no verified payment exists
- ✅ Questions without razorpayAmount configured are skipped (backward compatibility)
- ✅ Audit log records bypass attempts

**Verification**:
```bash
npm run test:rpc
# Add integration test for complete payment-first flow
```

---

### FEAT-004: Update frontend to use correct payment recording flow

**Type**: fix

**Description**: Update frontend to call `record_payment_transaction` with form_id for pre-payment recording, and handle the nullable submission_id flow correctly.

**Files**:
- `src/routes/forms/$slug.tsx`

**Steps**:
1. Line 594: Update `record_payment_transaction` call to include `p_form_id`:
   ```typescript
   const { data: txResult, error: txError } = await supabase.rpc("record_payment_transaction", {
     p_submission_id: null, // Pre-payment mode: no submission yet
     p_form_id: form.id,    // NEW: required for pre-payment
     p_question_id: questionId,
     p_razorpay_order_id: paymentData.order_id,
     p_razorpay_payment_id: paymentData.payment_id,
     p_razorpay_signature: paymentData.signature,
     p_amount: paymentData.amount,
     p_currency: paymentData.currency || "INR",
     p_status: "captured",
   });
   ```
2. Remove `p_submission_id: submissionId` from line 594 (change to `null`)
3. Keep `p_submission_id: submissionId` in the `submit_response` call (line 628)
4. Add TypeScript type updates if needed
5. Improve error message for payment verification failure (line 652)

**Acceptance Criteria**:
- ✅ Payment recording succeeds before submission created
- ✅ Form submission succeeds after payment recorded
- ✅ Error handling shows clear messages to user
- ✅ No console errors about FK violations

**Verification**:
```bash
npm run dev
# Manual test: Complete payment flow on test form
# 1. Create form with payment question (amount = 100 INR)
# 2. Open form in browser
# 3. Click "Pay Now" and complete Razorpay checkout
# 4. Submit form
# 5. Should succeed without errors

# Then test bypass attempt:
# 1. Open same form in new tab
# 2. Open dev tools, run: window.__pendingPayments = {}
# 3. Submit form without paying
# 4. Should fail with "Payment verification required" error
```

---

### FEAT-005: Optional: Consolidate payment order creation to use database RPC

**Type**: refactor

**Description**: Migrate from custom `/api/razorpay/create-order` HTTP endpoint to database RPC `create_razorpay_order` for consistency and better integration with `payment_transactions` table tracking.

**Why**: Migration 063 already provides `create_razorpay_order` RPC that calls Razorpay API and could create tracking records. Using it would:
- Centralize Razorpay logic in database
- Enable atomic order + transaction record creation
- Simplify server.ts

**Why not**: The current HTTP endpoint works and is simpler for environment variable access. Database vault access is complex.

**Decision**: SKIP this refactor for now. Current approach works. Mark as future improvement.

**Status**: DEFERRED

---

### FEAT-006: Add integration tests for payment security

**Type**: test

**Description**: Add comprehensive integration tests to verify payment bypass prevention and the complete payment-first submission flow.

**Files**:
- `tests/integration/rpc.test.ts`

**Steps**:
1. Add test suite: "payment security verification"
2. Test case 1: "submit_response blocks submission without payment for payment question"
   - Create form with payment question (razorpayAmount: 10000)
   - Attempt submit_response without recording payment
   - Should fail with error containing "Payment verification required"
3. Test case 2: "submit_response allows submission with verified payment"
   - Create form with payment question
   - Record payment with verified=true
   - Call submit_response
   - Should succeed
4. Test case 3: "submit_response ignores payment questions with no amount configured"
   - Create form with payment question but razorpayAmount not set
   - Call submit_response without payment
   - Should succeed (backward compatibility)
5. Test case 4: "record_payment_transaction works in pre-payment mode"
   - Call record_payment_transaction with submission_id=NULL, form_id set
   - Should succeed and return transaction_id
   - Then create submission and verify payment links to it
6. Test case 5: "payment verification signature check rejects tampered payments"
   - Create order
   - Record transaction with incorrect signature
   - Should fail verification

**Acceptance Criteria**:
- ✅ All 5 test cases pass
- ✅ No false positives (legitimate payments accepted)
- ✅ No false negatives (bypass attempts blocked)

**Verification**:
```bash
npm run test:rpc
# All payment security tests pass
```

---

## Migration Order & Dependencies

**Existing**: 
- 059: Current submit_response (requires auth)
- 063: Razorpay integration (payment_transactions table, RPCs)
- 064: Payment verification in submit_response (NEEDS FIXES)

**New migrations** (execute in this order):
1. **065_nullable_submission_id_for_payments.sql** - Schema change (no dependencies)
2. **066_update_payment_rpcs_for_nullable_submission.sql** - Depends on 065
3. **067_fix_submit_response_payment_verification.sql** - Depends on 065, 066

**After migrations 065-067**:
4. Update frontend code ($slug.tsx)
5. Add integration tests (rpc.test.ts)
6. Manual testing with real Razorpay test account

---

## Verification Strategy

### Unit/Integration Tests
```bash
# Run RPC integration tests (requires Supabase connection)
npm run test:rpc

# Run all unit tests
npm test

# TypeScript type checking
npm run typecheck
```

### Manual Testing Checklist

**Setup**:
- [ ] Razorpay test account credentials configured in Supabase vault
- [ ] Form created with payment question (amount = ₹100)
- [ ] Dev server running on localhost:3000

**Test 1: Normal payment flow**:
- [ ] Open form in browser
- [ ] Fill all required fields
- [ ] Click "Pay Now"
- [ ] Complete Razorpay test payment (use test card: 4111 1111 1111 1111)
- [ ] Submit form
- [ ] Expected: Success message with reference ID
- [ ] Verify in database: `payment_transactions` row with verified=true
- [ ] Verify in database: `submissions` row exists with correct reference

**Test 2: Bypass attempt via dev tools**:
- [ ] Open form in new incognito window
- [ ] Fill all required fields
- [ ] Open browser dev tools console
- [ ] Run: `window.__pendingPayments = {}`
- [ ] Submit form without paying
- [ ] Expected: Error "Payment verification required"
- [ ] Verify in database: No submission row created
- [ ] Verify in database: `audit_logs` entry with action='submit_response_payment_bypass_blocked'

**Test 3: Payment timeout/abandonment**:
- [ ] Open form
- [ ] Click "Pay Now"
- [ ] Close Razorpay modal without completing payment
- [ ] Try to submit form
- [ ] Expected: Error "Payment verification required"

**Test 4: Multiple payment questions**:
- [ ] Create form with 2 payment questions
- [ ] Complete payment for question 1 only
- [ ] Try to submit
- [ ] Expected: Error about missing payment for question 2
- [ ] Complete payment for question 2
- [ ] Submit form
- [ ] Expected: Success

**Test 5: Backward compatibility (no payment questions)**:
- [ ] Create form with NO payment questions
- [ ] Fill and submit
- [ ] Expected: Success (no payment verification)

### Database Verification Queries

After testing, run these queries in Supabase SQL Editor:

```sql
-- Check payment transactions
SELECT 
  pt.id,
  pt.submission_id,
  pt.razorpay_order_id,
  pt.verified,
  pt.status,
  pt.created_at,
  s.reference_id
FROM payment_transactions pt
LEFT JOIN submissions s ON pt.submission_id = s.id
ORDER BY pt.created_at DESC
LIMIT 10;

-- Check for bypass attempts in audit logs
SELECT 
  action,
  entity_id,
  metadata->>'email' as email,
  metadata->>'missing_payments' as missing_payments,
  created_at
FROM audit_logs
WHERE action = 'submit_response_payment_bypass_blocked'
ORDER BY created_at DESC
LIMIT 10;

-- Check submission counts
SELECT 
  f.title,
  f.response_count,
  COUNT(s.id) as actual_submissions,
  COUNT(pt.id) as payment_count
FROM forms f
LEFT JOIN submissions s ON f.id = s.form_id
LEFT JOIN payment_transactions pt ON f.id = pt.form_id AND pt.verified = true
WHERE f.id IN (SELECT DISTINCT form_id FROM form_questions WHERE type='payment')
GROUP BY f.id, f.title, f.response_count;
```

---

## Rollback Plan

If issues occur after deployment:

### Quick Rollback (restore migration 059)
```sql
-- In Supabase SQL Editor, run:
-- This removes payment verification and restores the last known-good submit_response

DROP FUNCTION IF EXISTS public.submit_response(uuid, text, text, uuid, jsonb, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.submit_response(uuid, text, text, uuid, jsonb) CASCADE;

-- Then run the entire contents of:
-- supabase/migrations/059_fix_submit_response_function.sql
```

### Partial Rollback (keep schema, remove verification)
```sql
-- Keep payment_transactions schema changes but disable verification temporarily
-- Update submit_response to skip payment verification loop
-- (Comment out lines 110-155 in migration 067)
```

### Full Rollback (nuclear option)
```sql
-- Drop all payment-related tables and functions
DROP TABLE IF EXISTS payment_transactions CASCADE;
-- Restore migration 059 submit_response
-- Remove payment question type from form_questions
```

---

## Security Considerations

### What This Fixes
✅ **Dev tools bypass**: Users cannot manipulate DOM/JavaScript to skip payment  
✅ **Race conditions**: Atomic verification in submit_response prevents timing attacks  
✅ **Signature tampering**: HMAC-SHA256 verification prevents fake payment_ids  
✅ **Replay attacks**: Idempotency keys prevent duplicate submissions with same payment  

### What This Doesn't Fix (out of scope)
❌ **Refunds**: Users who pay but don't submit (edge case - Razorpay refund API needed)  
❌ **Webhook verification**: Razorpay webhooks for payment state changes (future enhancement)  
❌ **Multi-currency**: Currently hardcoded to INR (future enhancement)  
❌ **Partial payments**: All payment questions must be 100% paid (no partial/installment support)  

### Security Assumptions
1. **Razorpay signature verification is cryptographically secure** (HMAC-SHA256)
2. **Database FK constraints are enforced** (submission_id references submissions.id)
3. **RLS policies protect payment_transactions table** (only authenticated users can read their own)
4. **Audit logs are tamper-evident** (append-only with timestamps)

---

## Performance Impact

### Expected Performance Characteristics

**Payment verification overhead per submission**:
- 1 additional SELECT query per payment question (indexed on question_id, submission_id)
- Typical forms have 0-2 payment questions
- Query time: <5ms (indexed lookup)
- **Impact**: Negligible (<10ms added to submission processing)

**Database indexes** (already exist from migration 063):
```sql
CREATE INDEX idx_payment_transactions_submission ON public.payment_transactions(submission_id);
CREATE INDEX idx_payment_transactions_order_id ON public.payment_transactions(razorpay_order_id);
CREATE INDEX idx_payment_transactions_payment_id ON public.payment_transactions(razorpay_payment_id);
```

**No new indexes needed** - existing indexes cover the verification queries.

---

## Open Questions & Decisions

### Q1: Should we support anonymous submissions with payment?
**Current state**: Migration 059 requires authentication (`auth.uid()` must be non-null)  
**Decision**: Keep authentication required. Razorpay needs user email anyway, and Google OAuth provides it.  
**Rationale**: Prevents abuse, enables payment tracking per user, aligns with existing architecture.

### Q2: Should we create order tracking in payment_transactions?
**Current state**: Razorpay order created via HTTP endpoint, not tracked in DB  
**Decision**: DEFER to future enhancement. Current flow works: order creation → payment → submission.  
**Rationale**: Adding order tracking requires modifying 063, which is risky. Current flow is functional.

### Q3: What happens if user pays multiple times for same question?
**Current state**: No deduplication logic  
**Decision**: Allow multiple payments, verify ANY verified payment exists for question.  
**Rationale**: Edge case (user retries after timeout). Better to allow submission than block legitimate user.  
**Implementation**: Payment verification uses `COUNT(*) > 0`, not `COUNT(*) = 1`.

### Q4: Should we update payment amount minimum from 100 to 1 paise?
**Current state**: `server.ts` checks >= 100, migration 064 checks >= 1  
**Decision**: Keep server.ts at 100 paise minimum (₹1), update migration 064 to match.  
**Rationale**: While Razorpay supports 1 paise, ₹1 minimum is more practical for real transactions.  
**Update FEAT-003**: Change line 111 check to `>= 100` instead of `>= 1`.

---

## Success Criteria

### Definition of Done

✅ **Functional requirements**:
- Users cannot submit forms with required payment questions without completing payment
- Users who complete payment can submit successfully
- Forms without payment questions work unchanged (backward compatibility)
- Error messages are clear and actionable

✅ **Technical requirements**:
- All 3 migrations (065, 066, 067) run without errors
- All existing integration tests pass
- All new payment security tests pass
- TypeScript compiles without errors
- No console errors in browser during normal flow

✅ **Security requirements**:
- Dev tools manipulation blocked (tested manually)
- Signature verification enforced (tested via integration test)
- Bypass attempts logged to audit_logs (verified in database)
- Race conditions prevented via database constraints

✅ **Performance requirements**:
- Submission processing time increase < 50ms
- No N+1 query issues (verified via database query logs)
- Indexes used efficiently (verified via EXPLAIN ANALYZE)

---

## Timeline Estimate

**Development**: 4-6 hours
- Migration 065: 30 min (schema change, simple)
- Migration 066: 1.5 hours (RPC update, testing)
- Migration 067: 2 hours (complex logic, multiple scenarios)
- Frontend update: 1 hour (parameter changes, error handling)
- Integration tests: 1 hour (5 test cases)

**Testing**: 2-3 hours
- Unit tests: 30 min
- Integration tests: 1 hour
- Manual testing: 1-1.5 hours

**Total**: 6-9 hours (1-2 days)

---

## Next Steps (Implementation Order)

1. ✅ Review this plan with team/stakeholder
2. Create migration 065 (nullable submission_id)
3. Test migration 065 in Supabase SQL editor
4. Create migration 066 (update record_payment_transaction)
5. Test migration 066 via npm run test:rpc
6. Create migration 067 (update submit_response)
7. Test migration 067 via npm run test:rpc
8. Update frontend ($slug.tsx)
9. Add integration tests (rpc.test.ts)
10. Run full test suite (npm test && npm run test:rpc)
11. Manual testing with Razorpay test account
12. Deploy migrations to production (after approval)
13. Monitor audit_logs for bypass attempts
14. Document payment flow in PROJECT_DOCS.txt

---

## References

- **Migration 059**: `supabase/migrations/059_fix_submit_response_function.sql` - Current submit_response (auth required)
- **Migration 063**: `supabase/migrations/063_razorpay_payment_integration.sql` - Razorpay tables & RPCs
- **Migration 064**: `supabase/migrations/064_secure_payment_verification.sql` - Payment verification (needs fixes)
- **Security Plan**: `.agents/tasks/payment-security-plan.md` - Original security analysis
- **Frontend**: `src/routes/forms/$slug.tsx` - Public form renderer (lines 583-665 payment flow)
- **Payment Button**: `src/components/RazorpayPaymentButton.tsx` - Razorpay integration
- **Server**: `src/server.ts` - Custom order creation endpoint
- **Tests**: `tests/integration/rpc.test.ts` - Existing RPC integration tests

---

## Appendix: Foreign Key Constraint Analysis

### Current Schema (Migration 063)
```sql
CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  -- ... other columns
);
```

**Problem**: `NOT NULL` + FK reference means submission must exist BEFORE payment transaction.

### Proposed Schema (Migration 065)
```sql
CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES public.submissions(id) ON DELETE CASCADE,
  -- ... other columns
  CONSTRAINT verified_payments_have_submission 
    CHECK (verified = false OR submission_id IS NOT NULL)
);
```

**Solution**: Nullable FK allows pre-recording. Constraint ensures verified payments always linked to submission.

### Flow Comparison

**Current Flow** (broken):
1. User clicks "Pay Now"
2. Razorpay checkout completes
3. Frontend calls `record_payment_transaction(submission_id=<pre-generated>)` ❌ **FAILS: FK violation**

**Fixed Flow** (migrations 065-067):
1. User clicks "Pay Now"
2. Razorpay checkout completes
3. Frontend calls `record_payment_transaction(submission_id=NULL, form_id=X)` ✅ **SUCCESS: NULL allowed**
4. Frontend calls `submit_response(submission_id=<same-uuid>)` 
5. Server creates submission row ✅
6. Server finds payment with NULL submission_id ✅
7. Server UPDATEs payment: `SET submission_id = <new-row-id>` ✅
8. Server verifies payment exists for submission ✅
9. Returns success ✅

---

*End of Implementation Plan*
