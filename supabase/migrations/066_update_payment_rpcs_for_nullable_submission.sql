-- Migration 066: Update payment RPCs for nullable submission_id
-- Allows recording payment BEFORE submission exists (pre-payment flow)
-- Depends on migration 065 (nullable submission_id schema)

-- ─── Update record_payment_transaction for pre-payment flow ───────────────────
-- Now accepts NULL submission_id when payment happens before form submission.
-- When submission_id is NULL, p_form_id is required and used directly.
-- When submission_id is provided, validates it exists and uses its form_id.
-- HMAC signature verification logic remains unchanged for security.
CREATE OR REPLACE FUNCTION public.record_payment_transaction(
  p_submission_id uuid,
  p_form_id uuid,
  p_question_id uuid,
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_razorpay_signature text,
  p_amount integer,
  p_currency text DEFAULT 'INR',
  p_status text DEFAULT 'captured'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form_id uuid;
  v_current_user_id uuid;
  v_transaction_id uuid;
  v_key_secret text;
  v_expected_signature text;
  v_signature_payload text;
  v_is_verified boolean;
BEGIN
  -- Authentication required
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Authentication required'
    );
  END IF;
  
  -- Validate submission_id or form_id: at least one must be provided
  IF p_submission_id IS NULL AND p_form_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Either submission_id or form_id must be provided'
    );
  END IF;
  
  -- Get form_id: either from submission lookup or use provided form_id
  IF p_submission_id IS NOT NULL THEN
    -- Post-payment flow: submission exists, validate and get its form_id
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
    -- Pre-payment flow: submission doesn't exist yet, use provided form_id
    v_form_id := p_form_id;
    
    -- Validate form exists
    IF NOT EXISTS (SELECT 1 FROM public.forms WHERE id = v_form_id) THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'Form not found'
      );
    END IF;
  END IF;
  
  -- Retrieve Razorpay secret key from vault for signature verification
  BEGIN
    v_key_secret := current_setting('app.settings.razorpay_key_secret', true);
  EXCEPTION
    WHEN OTHERS THEN
      v_key_secret := NULL;
  END;
  
  IF v_key_secret IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Payment verification not configured. Contact administrator.'
    );
  END IF;
  
  -- Verify Razorpay signature using HMAC-SHA256
  -- Per Razorpay docs: HMAC-SHA256(order_id + "|" + payment_id, secret_key)
  v_signature_payload := p_razorpay_order_id || '|' || p_razorpay_payment_id;
  v_expected_signature := encode(
    hmac(v_signature_payload, v_key_secret, 'sha256'),
    'hex'
  );
  
  -- Constant-time comparison via direct equality (Postgres uses constant-time for text/bytea)
  v_is_verified := (v_expected_signature = p_razorpay_signature);
  
  -- Reject unverified payments
  IF NOT v_is_verified THEN
    -- Log failed verification attempt in payment_transactions with verified=false
    INSERT INTO public.payment_transactions (
      submission_id,
      form_id,
      question_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount,
      currency,
      status,
      verified,
      error_message
    ) VALUES (
      p_submission_id,
      v_form_id,
      p_question_id,
      p_razorpay_order_id,
      p_razorpay_payment_id,
      p_razorpay_signature,
      p_amount,
      p_currency,
      'failed',
      false,
      'Signature verification failed'
    )
    ON CONFLICT (razorpay_order_id) DO UPDATE SET
      razorpay_payment_id = EXCLUDED.razorpay_payment_id,
      razorpay_signature = EXCLUDED.razorpay_signature,
      status = 'failed',
      verified = false,
      error_message = 'Signature verification failed',
      updated_at = now()
    RETURNING id INTO v_transaction_id;
    
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Payment verification failed. If you completed payment, contact support.',
      'transaction_id', v_transaction_id,
      'verified', false
    );
  END IF;
  
  -- Insert or update verified payment transaction
  INSERT INTO public.payment_transactions (
    submission_id,
    form_id,
    question_id,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    amount,
    currency,
    status,
    verified
  ) VALUES (
    p_submission_id,
    v_form_id,
    p_question_id,
    p_razorpay_order_id,
    p_razorpay_payment_id,
    p_razorpay_signature,
    p_amount,
    p_currency,
    p_status,
    true
  )
  ON CONFLICT (razorpay_order_id) DO UPDATE SET
    razorpay_payment_id = EXCLUDED.razorpay_payment_id,
    razorpay_signature = EXCLUDED.razorpay_signature,
    status = EXCLUDED.status,
    verified = true,
    error_message = NULL,
    updated_at = now()
  RETURNING id INTO v_transaction_id;
  
  RETURN jsonb_build_object(
    'ok', true,
    'transaction_id', v_transaction_id,
    'verified', true
  );
END;
$$;

-- Update grants for new signature
GRANT EXECUTE ON FUNCTION public.record_payment_transaction(uuid, uuid, uuid, text, text, text, integer, text, text) TO authenticated;

-- Update function comment
COMMENT ON FUNCTION public.record_payment_transaction IS 'Records and verifies Razorpay payment with HMAC-SHA256 signature check. Supports pre-payment recording (submission_id=NULL, form_id required) and post-payment recording (submission_id required, form_id optional).';

SELECT 'Migration 066: Updated record_payment_transaction for nullable submission_id support' as status;
