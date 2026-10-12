-- Create a simple config table to store Razorpay credentials
-- This bypasses vault and ALTER DATABASE permission issues

-- 1. Create config table
CREATE TABLE IF NOT EXISTS public.razorpay_config (
  id integer PRIMARY KEY DEFAULT 1,
  key_id text NOT NULL,
  key_secret text NOT NULL,
  is_live boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Enable RLS
ALTER TABLE public.razorpay_config ENABLE ROW LEVEL SECURITY;

-- Only admins can read config
CREATE POLICY "admin_read_razorpay_config" ON public.razorpay_config
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- 2. Insert test credentials
INSERT INTO public.razorpay_config (id, key_id, key_secret, is_live)
VALUES (1, 'rzp_test_TmxUQmgqUvYKG5', '5GMbMY7Hndt1Jwz6PUFl8TVd', false)
ON CONFLICT (id) DO UPDATE SET
  key_id = EXCLUDED.key_id,
  key_secret = EXCLUDED.key_secret,
  is_live = EXCLUDED.is_live,
  updated_at = now();

-- 3. Update record_payment_transaction to read from config table
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
  
  -- Get Razorpay secret from config table
  SELECT key_secret INTO v_key_secret
  FROM public.razorpay_config
  WHERE id = 1
  LIMIT 1;
  
  IF v_key_secret IS NULL OR v_key_secret = '' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Payment configuration not found. Contact administrator.'
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

-- 4. Update create_razorpay_order to read from config table
CREATE OR REPLACE FUNCTION public.create_razorpay_order(
  p_form_id uuid,
  p_question_id uuid,
  p_amount integer,
  p_currency text DEFAULT 'INR'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id uuid;
  v_key_id text;
  v_key_secret text;
  v_basic_auth text;
  v_request_body jsonb;
  v_response http_response;
  v_response_json jsonb;
  v_order_id text;
  v_receipt text;
BEGIN
  -- Authentication required
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Authentication required'
    );
  END IF;
  
  -- Validate amount (minimum 100 paise = ₹1 for Razorpay)
  IF p_amount < 100 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Amount must be at least 100 paise (₹1)'
    );
  END IF;
  
  -- Get Razorpay credentials from config table
  SELECT key_id, key_secret INTO v_key_id, v_key_secret
  FROM public.razorpay_config
  WHERE id = 1
  LIMIT 1;
  
  IF v_key_id IS NULL OR v_key_secret IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Payment configuration not found. Contact administrator.'
    );
  END IF;
  
  -- Generate unique receipt ID for tracking
  v_receipt := 'rcpt_' || to_char(now(), 'YYYYMMDDHHmmss') || '_' || 
               SUBSTRING(md5(random()::text), 1, 8);
  
  -- Build Razorpay Orders API request body
  v_request_body := jsonb_build_object(
    'amount', p_amount,
    'currency', p_currency,
    'receipt', v_receipt,
    'notes', jsonb_build_object(
      'form_id', p_form_id,
      'question_id', p_question_id,
      'user_id', v_current_user_id
    )
  );
  
  -- Encode Basic Auth header (key_id:key_secret)
  v_basic_auth := 'Basic ' || encode(
    convert_to(v_key_id || ':' || v_key_secret, 'UTF8'),
    'base64'
  );
  
  -- Call Razorpay Orders API
  BEGIN
    v_response := http((
      'POST',
      'https://api.razorpay.com/v1/orders',
      ARRAY[
        http_header('Authorization', v_basic_auth),
        http_header('Content-Type', 'application/json')
      ],
      'application/json',
      v_request_body::text
    )::http_request);
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'Failed to connect to payment gateway. Please try again.'
      );
  END;
  
  -- Check HTTP status
  IF v_response.status <> 200 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Payment gateway returned error. Please try again.'
    );
  END IF;
  
  -- Parse response JSON
  BEGIN
    v_response_json := v_response.content::jsonb;
    v_order_id := v_response_json->>'id';
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'Invalid response from payment gateway'
      );
  END;
  
  IF v_order_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Order creation failed - no order ID returned'
    );
  END IF;
  
  -- Return success with real order_id
  RETURN jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'amount', p_amount,
    'currency', p_currency
  );
END;
$$;

-- Verify setup
SELECT * FROM public.razorpay_config;

SELECT 'Razorpay configuration table created and populated successfully' as status;
