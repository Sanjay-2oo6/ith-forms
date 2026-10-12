-- Setup Razorpay secrets using database settings (works without vault permissions)
-- Run this in Supabase SQL Editor

-- Set the Razorpay secret key in database settings
-- This makes it available to the record_payment_transaction RPC via current_setting()
ALTER DATABASE postgres SET app.settings.razorpay_key_secret = '5GMbMY7Hndt1Jwz6PUFl8TVd';
ALTER DATABASE postgres SET app.settings.razorpay_key_id = 'rzp_test_TmxUQmgqUvYKG5';

-- Verify the settings were stored
SELECT current_setting('app.settings.razorpay_key_secret', true) as secret_key;
SELECT current_setting('app.settings.razorpay_key_id', true) as key_id;

-- Test with a dummy signature verification (this will show if the setting is accessible)
SELECT 
  encode(hmac('test_order|test_payment', current_setting('app.settings.razorpay_key_secret', true), 'sha256'), 'hex') as test_signature;

SELECT 'Razorpay credentials configured successfully via database settings' as status;
