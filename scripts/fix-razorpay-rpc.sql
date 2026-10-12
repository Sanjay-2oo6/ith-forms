-- Fix the create_razorpay_order RPC to use hardcoded test credentials
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
  v_current_user_id uuid;
  v_key_id text := 'rzp_test_TmxUQmgqUvYKG5';
  v_key_secret text := '5GMbMY7Hndt1Jwz6PUFl8TVd';
  v_basic_auth text;
  v_request_body jsonb;
  v_response http_response;
  v_response_json jsonb;
  v_order_id text;
  v_receipt text;
BEGIN
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Authentication required');
  END IF;
  
  IF p_amount < 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Amount must be at least 100 paise');
  END IF;
  
  v_receipt := 'rcpt_' || SUBSTRING(p_form_id::text, 1, 8) || '_' || 
               EXTRACT(EPOCH FROM now())::bigint::text || '_' || 
               encode(gen_random_bytes(4), 'hex');
  
  v_request_body := jsonb_build_object(
    'amount', p_amount,
    'currency', p_currency,
    'receipt', v_receipt,
    'notes', jsonb_build_object(
      'form_id', p_form_id::text,
      'question_id', p_question_id::text
    )
  );
  
  v_basic_auth := 'Basic ' || encode(
    convert_to(v_key_id || ':' || v_key_secret, 'UTF8'),
    'base64'
  );
  
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
      RETURN jsonb_build_object('ok', false, 'error', 'Payment gateway connection failed');
  END;
  
  IF v_response.status <> 200 THEN
    RETURN jsonb_build_object(
      'ok', false, 
      'error', 'Payment gateway error: ' || v_response.status::text
    );
  END IF;
  
  BEGIN
    v_response_json := v_response.content::jsonb;
    v_order_id := v_response_json->>'id';
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Invalid gateway response');
  END;
  
  IF v_order_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No order ID returned');
  END IF;
  
  RETURN jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'amount', p_amount,
    'currency', p_currency
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_razorpay_order(uuid, uuid, integer, text) TO authenticated;
