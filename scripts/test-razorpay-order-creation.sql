-- Test Razorpay order creation RPC
-- This will help debug the "Failed to connect to payment gateway" error

-- 1. Verify razorpay_config exists and has credentials
SELECT * FROM public.razorpay_config;

-- 2. Test the create_razorpay_order RPC directly
SELECT public.create_razorpay_order(
  '991023b1-3990-41b4-b96a-9040dc2d6103'::uuid, -- form_id
  'f2a78212-df6a-41b2-9987-95f0a0c5dbb5'::uuid, -- question_id
  10000, -- amount (₹100)
  'INR' -- currency
);

-- If the above fails, let's check if the http extension is working
SELECT * FROM pg_extension WHERE extname = 'http';

-- Test a simple HTTP call
SELECT status, content::text 
FROM http_get('https://httpbin.org/get');
