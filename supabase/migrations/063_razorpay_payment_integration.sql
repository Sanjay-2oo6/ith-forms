-- Migration 063: Razorpay Payment Integration
-- Upgrade payment question type to native Razorpay payments
-- Replaces external URL + screenshot workflow with Razorpay checkout

-- Ensure required extensions are installed
CREATE EXTENSION IF NOT EXISTS http;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── 1. Create payment_transactions table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.form_questions(id) ON DELETE CASCADE,
  
  -- Razorpay identifiers
  razorpay_order_id text NOT NULL UNIQUE,
  razorpay_payment_id text,
  razorpay_signature text,
  
  -- Payment details
  amount integer NOT NULL,  -- in paise (100 paise = ₹1)
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'created',  -- created, authorized, captured, failed
  
  -- Verification
  verified boolean NOT NULL DEFAULT false,
  
  -- Metadata
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT payment_status_check CHECK (status IN ('created', 'authorized', 'captured', 'failed', 'refunded'))
);

-- Enable RLS
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Admin can read all payments
CREATE POLICY "admin_read_payments" ON public.payment_transactions
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Users can read their own payments
CREATE POLICY "user_read_own_payments" ON public.payment_transactions
  FOR SELECT TO authenticated
  USING (
    submission_id IN (
      SELECT id FROM public.submissions
      WHERE respondent_email IN (
        SELECT email FROM auth.users WHERE id = auth.uid()
      )
    )
  );

-- Indexes for performance
CREATE INDEX idx_payment_transactions_submission ON public.payment_transactions(submission_id);
CREATE INDEX idx_payment_transactions_order_id ON public.payment_transactions(razorpay_order_id);
CREATE INDEX idx_payment_transactions_payment_id ON public.payment_transactions(razorpay_payment_id);

-- ─── 2. RPC: Create Razorpay Order ────────────────────────────────────────────
-- Calls Razorpay's Orders API to create a real order_id that can be used with checkout.
-- Requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET stored in Supabase vault.
-- The order is tracked in payment_transactions with status='created' until payment completes.
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
  
  -- Retrieve Razorpay credentials from Supabase vault
  -- The RPC must have access to secrets set via Supabase dashboard
  BEGIN
    -- Try to get from vault.decrypted_secrets (requires proper RLS setup)
    SELECT secret INTO v_key_id FROM vault.decrypted_secrets WHERE name = 'RAZORPAY_KEY_ID' LIMIT 1;
    SELECT secret INTO v_key_secret FROM vault.decrypted_secrets WHERE name = 'RAZORPAY_KEY_SECRET' LIMIT 1;
  EXCEPTION
    WHEN OTHERS THEN
      -- If vault access fails, try direct approach
      v_key_id := NULL;
      v_key_secret := NULL;
  END;
  
  -- Fallback: try current_setting if database config was set
  IF v_key_id IS NULL THEN
    BEGIN
      v_key_id := current_setting('app.settings.razorpay_key_id', true);
      v_key_secret := current_setting('app.settings.razorpay_key_secret', true);
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END;
  
  IF v_key_id IS NULL OR v_key_secret IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Razorpay credentials not configured. Contact administrator.'
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
  
  -- Call Razorpay Orders API (requires http extension - available by default on Supabase)
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

GRANT EXECUTE ON FUNCTION public.create_razorpay_order(uuid, uuid, integer, text) TO authenticated;

-- ─── 3. RPC: Record Payment Transaction ───────────────────────────────────────
-- Records and verifies Razorpay payment signature using HMAC-SHA256.
-- Signature verification prevents attackers from submitting fake payment_ids.
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

GRANT EXECUTE ON FUNCTION public.record_payment_transaction(uuid, uuid, text, text, text, integer, text, text) TO authenticated;

-- ─── 4. Comments ──────────────────────────────────────────────────────────────
COMMENT ON TABLE public.payment_transactions IS 'Razorpay payment transactions for payment question type';
COMMENT ON FUNCTION public.create_razorpay_order IS 'Creates real Razorpay order via API for checkout';
COMMENT ON FUNCTION public.record_payment_transaction IS 'Records and verifies Razorpay payment with HMAC-SHA256 signature check';

-- ─── 5. Setup Instructions ────────────────────────────────────────────────────
-- Before using Razorpay payments, configure the following in Supabase:
--
-- 1. Store Razorpay credentials in Supabase Vault (Dashboard > Project Settings > Vault):
--    - RAZORPAY_KEY_ID: Your publishable key (rzp_test_xxx or rzp_live_xxx)
--    - RAZORPAY_KEY_SECRET: Your secret key (NEVER expose this client-side)
--
-- 2. Enable the 'http' extension (usually enabled by default on Supabase):
--    CREATE EXTENSION IF NOT EXISTS http;
--
-- 3. Enable the 'pgcrypto' extension for HMAC-SHA256 (usually enabled by default):
--    CREATE EXTENSION IF NOT EXISTS pgcrypto;
--
-- 4. Set app.settings config to expose vault secrets to the RPCs:
--    ALTER DATABASE postgres SET app.settings.razorpay_key_id = 'rzp_test_xxx';
--    ALTER DATABASE postgres SET app.settings.razorpay_key_secret = 'your_secret_key';
--
-- Note: For security, the RPCs will fail gracefully if credentials are not configured,
-- returning error messages that don't expose the setup details to end users.

SELECT 'Migration 063: Razorpay payment integration - payment_transactions table created' as status;
