-- Enable pgcrypto extension for HMAC-SHA256 signature verification
-- This is required for Razorpay payment signature verification

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Verify it's enabled
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';

SELECT 'pgcrypto extension enabled successfully' as status;
