-- Verification SQL Queries for Razorpay Payment Export Fix
-- Run these in Supabase SQL Editor after testing payment submissions

-- ============================================================================
-- 1. Check Recent Payment Transactions
-- ============================================================================
-- Verify that payment transactions are being recorded after form submission
SELECT 
  pt.id,
  s.reference_id,
  f.title as form_title,
  q.label as payment_question,
  pt.razorpay_payment_id,
  pt.razorpay_order_id,
  pt.amount,
  pt.currency,
  pt.status,
  pt.verified,
  pt.created_at,
  pt.updated_at
FROM payment_transactions pt
JOIN submissions s ON s.id = pt.submission_id
JOIN forms f ON f.id = pt.form_id
JOIN form_questions q ON q.id = pt.question_id
ORDER BY pt.created_at DESC
LIMIT 10;

-- ============================================================================
-- 2. Check Payment Answers vs Transactions
-- ============================================================================
-- Verify that payment_id in answers matches payment_transactions records
SELECT 
  s.reference_id,
  s.submitted_at,
  q.label as question_label,
  a.value as payment_id_in_answer,
  pt.razorpay_payment_id as payment_id_in_transaction,
  pt.razorpay_order_id,
  pt.amount,
  pt.status,
  pt.verified,
  CASE 
    WHEN a.value = pt.razorpay_payment_id THEN '✓ Match'
    ELSE '✗ Mismatch'
  END as consistency_check
FROM submissions s
JOIN answers a ON a.submission_id = s.id
JOIN form_questions q ON q.id = a.question_id
LEFT JOIN payment_transactions pt ON pt.submission_id = s.id AND pt.question_id = q.id
WHERE q.type = 'payment'
  AND a.value LIKE 'pay_%'  -- Native Razorpay payments only
ORDER BY s.submitted_at DESC
LIMIT 10;

-- ============================================================================
-- 3. Find Missing Payment Transactions
-- ============================================================================
-- Find submissions with payment answers but no transaction record
-- (Indicates potential recording failure)
SELECT 
  s.reference_id,
  s.submitted_at,
  q.label as payment_question,
  a.value as payment_id,
  'Missing transaction record' as issue
FROM submissions s
JOIN answers a ON a.submission_id = s.id
JOIN form_questions q ON q.id = a.question_id
LEFT JOIN payment_transactions pt ON pt.submission_id = s.id AND pt.question_id = q.id
WHERE q.type = 'payment'
  AND a.value LIKE 'pay_%'
  AND pt.id IS NULL
ORDER BY s.submitted_at DESC;

-- ============================================================================
-- 4. Payment Transaction Statistics
-- ============================================================================
-- Summary stats for all payment transactions
SELECT 
  COUNT(*) as total_transactions,
  COUNT(DISTINCT submission_id) as unique_submissions,
  COUNT(DISTINCT form_id) as forms_with_payments,
  SUM(amount) as total_amount_paise,
  SUM(amount) / 100.0 as total_amount_rupees,
  COUNT(CASE WHEN status = 'captured' THEN 1 END) as successful_payments,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments,
  COUNT(CASE WHEN verified = true THEN 1 END) as verified_payments,
  COUNT(CASE WHEN verified = false THEN 1 END) as unverified_payments
FROM payment_transactions;

-- ============================================================================
-- 5. Export Data Preview
-- ============================================================================
-- Simulate what the Excel export will show for payment questions
SELECT 
  s.reference_id as "Reference ID",
  s.status as "Status",
  COALESCE(s.respondent_name, 'Anonymous') as "Respondent",
  s.submitted_at as "Submitted At",
  q.label as "Question Label",
  -- Main answer column
  CASE 
    WHEN pt.razorpay_payment_id IS NOT NULL THEN 'Payment completed (ID: ' || pt.razorpay_payment_id || ')'
    WHEN a.value LIKE 'pay_%' THEN 'No payment recorded'
    ELSE 'Payment completed - screenshot uploaded'
  END as "Answer",
  -- Additional columns for native payments
  UPPER(COALESCE(pt.status, 'NOT PAID')) as "Status_Column",
  CASE 
    WHEN pt.currency = 'INR' THEN '₹' || (pt.amount / 100.0)::text
    WHEN pt.currency IS NOT NULL THEN pt.currency || ' ' || (pt.amount / 100.0)::text
    ELSE ''
  END as "Amount_Column",
  COALESCE(pt.razorpay_payment_id, '') as "Payment_ID_Column",
  COALESCE(pt.razorpay_order_id, '') as "Order_ID_Column",
  CASE WHEN pt.verified THEN 'Yes' ELSE 'No' END as "Verified_Column"
FROM submissions s
JOIN form_questions q ON q.form_id = s.form_id
LEFT JOIN answers a ON a.submission_id = s.id AND a.question_id = q.id
LEFT JOIN payment_transactions pt ON pt.submission_id = s.id AND pt.question_id = q.id
WHERE q.type = 'payment'
ORDER BY s.submitted_at DESC, q.position ASC
LIMIT 20;

-- ============================================================================
-- 6. Forms with Native Razorpay Payment Questions
-- ============================================================================
-- List all forms configured with native Razorpay payments
SELECT 
  f.id,
  f.title,
  f.slug,
  q.label as payment_question,
  (q.config->>'razorpayAmount')::integer as amount_paise,
  (q.config->>'razorpayCurrency')::text as currency,
  q.config->>'razorpayDescription' as description,
  f.published,
  COUNT(DISTINCT s.id) as submission_count,
  COUNT(DISTINCT pt.id) as transaction_count
FROM forms f
JOIN form_questions q ON q.form_id = f.id
LEFT JOIN submissions s ON s.form_id = f.id
LEFT JOIN payment_transactions pt ON pt.form_id = f.id AND pt.question_id = q.id
WHERE q.type = 'payment'
  AND (q.config->>'razorpayAmount')::integer >= 100
GROUP BY f.id, f.title, f.slug, q.id, q.label, q.config
ORDER BY f.created_at DESC;

-- ============================================================================
-- 7. Check for Signature Verification Failures
-- ============================================================================
-- Find any payment attempts where signature verification failed
SELECT 
  pt.id,
  s.reference_id,
  f.title as form_title,
  pt.razorpay_payment_id,
  pt.razorpay_order_id,
  pt.status,
  pt.verified,
  pt.error_message,
  pt.created_at
FROM payment_transactions pt
JOIN submissions s ON s.id = pt.submission_id
JOIN forms f ON f.id = pt.form_id
WHERE pt.verified = false
   OR pt.status = 'failed'
   OR pt.error_message IS NOT NULL
ORDER BY pt.created_at DESC
LIMIT 20;

-- ============================================================================
-- Expected Results After Fix:
-- ============================================================================
-- Query 1: Should show recent payment transactions with all fields populated
-- Query 2: payment_id in answers should match razorpay_payment_id in transactions
-- Query 3: Should return 0 rows (no missing transactions for native payments)
-- Query 4: verified_payments should equal successful_payments
-- Query 5: Shows exactly what appears in Excel export
-- Query 6: Lists forms with Razorpay integration and transaction counts
-- Query 7: Should return 0 rows (no verification failures for legitimate payments)
