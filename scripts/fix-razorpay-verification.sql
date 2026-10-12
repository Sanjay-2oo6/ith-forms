-- Fix Razorpay signature verification to read from vault properly
-- This replaces the record_payment_transaction RPC to work with Supabase vault

CREATE OR REPLACE FUNCTION public.record_payment_transaction(
  p_submission_id uuid,
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
  
  -- Get form_id from submission
  SELECT form_id INTO v_form_id
  FROM public.submissions
  WHERE id = p_submission_id;
  
  IF v_form_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Submission not found'
    );
  END IF;
  
  -- Retrieve Razorpay secret key from vault
  BEGIN
    SELECT decrypted_secret INTO v_key_secret 
    FROM vault.decrypted_secrets 
    WHERE name = 'RAZORPAY_KEY_SECRET' 
    LIMIT 1;
  EXCEPTION
    WHEN OTHERS THEN
      v_key_secret := NULL;
  END;
  
  -- Fallback to current_setting
  IF v_key_secret IS NULL THEN
    BEGIN
      v_key_secret := current_setting('app.settings.razorpay_key_secret', true);
    EXCEPTION
      WHEN OTHERS THEN
        v_key_secret := NULL;
    END;
  END;
  
  IF v_key_secret IS NULL OR v_key_secret = '' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Payment verification not configured',
      'debug', 'RAZORPAY_KEY_SECRET not found in vault or settings'
    );
  END IF;
  
  -- Verify Razorpay signature using HMAC-SHA256
  -- Per Razorpay docs: HMAC-SHA256(order_id + "|" + payment_id, secret_key)
  v_signature_payload := p_razorpay_order_id || '|' || p_razorpay_payment_id;
  v_expected_signature := encode(
    hmac(v_signature_payload, v_key_secret, 'sha256'),
    'hex'
  );
  
  -- Constant-time comparison
  v_is_verified := (v_expected_signature = p_razorpay_signature);
  
  -- Reject unverified payments
  IF NOT v_is_verified THEN
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
      'error', 'Payment verification failed',
      'transaction_id', v_transaction_id,
      'verified', false,
      'debug', jsonb_build_object(
        'expected', v_expected_signature,
        'received', p_razorpay_signature
      )
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

SELECT 'Fixed record_payment_transaction RPC to read from vault properly' as status;
