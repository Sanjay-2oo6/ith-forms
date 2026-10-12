-- Setup Razorpay secrets in Supabase vault
-- Run this in Supabase SQL Editor

-- Insert Razorpay test keys into vault
-- Replace these with your actual Razorpay keys
INSERT INTO vault.secrets (name, secret)
VALUES ('RAZORPAY_KEY_SECRET', '5GMbMY7Hndt1Jwz6PUFl8TVd')
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;

-- Verify the secret was stored
SELECT name, created_at, updated_at 
FROM vault.secrets 
WHERE name = 'RAZORPAY_KEY_SECRET';

-- Test that the RPC can read it
SELECT decrypted_secret 
FROM vault.decrypted_secrets 
WHERE name = 'RAZORPAY_KEY_SECRET';

SELECT 'Razorpay secret key configured in vault' as status;
