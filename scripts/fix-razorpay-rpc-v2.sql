-- Fix the create_razorpay_order RPC - remove auth requirement, handle it client-side
DROP FUNCTION IF EXISTS public.create_razorpay_order(uuid, uuid, integer, text);

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
  v_key_id text := 'rzp_test_TmxUQmgqUvYKG5';
  v_key_secret text := '5GMbMY7Hndt1Jwz6PUFl8TVd';
  v_basic_auth text;
  v_request_body jsonb;
  v_response http_response;
  v_response_json jsonb;
  v_order_id text;
  v_receipt text;
BEGIN
  -- Validate amount (minimum 100 paise = ₹1 for Razorpay)
  IF p_amount < 100 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Amount must be at least 100 paise'
    );
  END IF;
  
  -- Generate unique receipt ID
  v_receipt := 'rcpt_' || to_char(now(), 'YYYYMMDDHHmmss') || '_' || 
               SUBSTRING(md5(random()::text), 1, 8);
  
  -- Build request body
  v_request_body := jsonb_build_object(
    'amount', p_amount,
    'currency', p_currency,
    'receipt', v_receipt
  );
  
  -- Build Basic Auth
  v_basic_auth := 'Basic ' || encode(
    convert_to(v_key_id || ':' || v_key_secret, 'UTF8'),
    'base64'
  );
  
  -- Call Razorpay API
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
        'error', 'Failed to connect to payment gateway: ' || SQLERRM
      );
  END;
  
  -- Check response status
  IF v_response.status NOT IN (200, 201) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Payment gateway error (HTTP ' || v_response.status || '): ' || COALESCE(v_response.content, 'No response')
    );
  END IF;
  
  -- Parse response
  BEGIN
    v_response_json := v_response.content::jsonb;
    v_order_id := v_response_json->>'id';
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'Failed to parse gateway response: ' || SQLERRM
      );
  END;
  
  IF v_order_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'No order ID in gateway response'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'amount', p_amount,
    'currency', p_currency
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_razorpay_order(uuid, uuid, integer, text) TO anon, authenticated;
