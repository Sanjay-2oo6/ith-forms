-- Migration 065: Make payment_transactions.submission_id nullable
-- Enables payment-first flow where payment is recorded before submission row exists.
-- This is critical for secure payment verification: payment must be verified BEFORE
-- allowing submission to proceed, preventing dev-tools bypass of required payment.

-- Drop NOT NULL constraint on submission_id
-- submission_id is nullable to support payment-first flow where payment is recorded
-- before submission row exists. The check constraint ensures verified payments are
-- always linked to a valid submission.
ALTER TABLE public.payment_transactions
  ALTER COLUMN submission_id DROP NOT NULL;

-- Add constraint to ensure verified payments have linked submission
-- A verified payment (verified=true) MUST have a submission_id.
-- Unverified/pending payments (verified=false) can have NULL submission_id during checkout.
ALTER TABLE public.payment_transactions
  ADD CONSTRAINT verified_payments_have_submission
  CHECK (verified = false OR submission_id IS NOT NULL);

-- All existing indexes and FK constraints continue to work with NULLs
-- idx_payment_transactions_submission: still effective (NULLs are simply excluded from index)
-- FK to submissions(id) ON DELETE CASCADE: still applies when submission_id is set

COMMENT ON CONSTRAINT verified_payments_have_submission ON public.payment_transactions IS
  'Ensures verified payments are always linked to a submission. Prevents orphaned verified payments.';

SELECT 'Migration 065: payment_transactions.submission_id is now nullable with verification constraint' as status;
