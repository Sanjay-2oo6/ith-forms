-- Migration 054: Add Rate Limiting to submit_response() RPC
-- Issue: No rate limiting on form submissions enables:
--        - Spam/abuse of public forms
--        - Resource exhaustion (database overload, storage fill)
--        - Denial of service (legitimate respondents blocked once limit reached)
--
-- Solution:
-- 1. Create submission_rate_limit table to track submission attempts per email/hour
-- 2. Add sliding window rate limiting (max 10 submissions per hour per email)
-- 3. Add check in submit_response() before allowing submission
-- 4. Log rate limit violations to audit_logs

-- ─── 1. Create submission_rate_limit table for tracking attempts ──────────────
CREATE TABLE IF NOT EXISTS public.submission_rate_limit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id         uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  email           text NOT NULL,
  submission_time timestamptz NOT NULL DEFAULT now(),
  
  -- Composite index for efficient windowing queries
  CONSTRAINT submission_rate_limit_unique UNIQUE (form_id, email, submission_time)
);

ALTER TABLE public.submission_rate_limit ENABLE ROW LEVEL SECURITY;

-- RLS: Only admins can read (for monitoring)
DROP POLICY IF EXISTS "admin_rate_limit_read" ON public.submission_rate_limit;
CREATE POLICY "admin_rate_limit_read" ON public.submission_rate_limit
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ─── 2. Create function to check rate limit ───────────────────────────────────
DROP FUNCTION IF EXISTS public.check_submission_rate_limit(uuid, text) CASCADE;

CREATE OR REPLACE FUNCTION public.check_submission_rate_limit(
  p_form_id uuid,
  p_email   text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submission_count int;
  v_rate_limit_per_hour int DEFAULT 10;  -- Max 10 submissions per hour per email
  v_window_start timestamptz;
BEGIN
  -- Calculate 1-hour sliding window start time
  v_window_start := now() - interval '1 hour';
  
  -- Count submissions from this email in the past hour
  SELECT COUNT(*) INTO v_submission_count
  FROM public.submission_rate_limit
  WHERE form_id = p_form_id
    AND email = LOWER(p_email)
    AND submission_time > v_window_start;
  
  -- Return status
  IF v_submission_count >= v_rate_limit_per_hour THEN
    RETURN jsonb_build_object(
      'ok', false,
      'remaining', 0,
      'error', 'Rate limit exceeded. Maximum 10 submissions per hour per email.'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'ok', true,
    'remaining', v_rate_limit_per_hour - v_submission_count,
    'message', 'Rate limit check passed'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_submission_rate_limit(uuid, text) TO authenticated;

-- ─── 3. UPDATE submit_response() to include rate limiting ────────────────────
-- Note: This is a STUB. The actual submit_response() in migration 053 needs to:
--
--   1. Call check_submission_rate_limit() before processing submission
--   2. If rate limited, return error immediately
--   3. If allowed, INSERT into submission_rate_limit table to record attempt
--   4. Log violations to audit_logs
--
-- Implementation in submit_response():
--
--   -- Rate limiting check
--   v_rate_check := public.check_submission_rate_limit(p_form_id, LOWER(p_email));
--   IF NOT (v_rate_check->>'ok')::boolean THEN
--     INSERT INTO public.audit_logs (action, entity, entity_id, metadata)
--     VALUES (
--       'submit_response_rate_limited',
--       'submission',
--       p_form_id::text,
--       jsonb_build_object('email', p_email, 'user_id', v_current_user_id)
--     );
--     RETURN jsonb_build_object(
--       'ok', false,
--       'error', v_rate_check->>'error',
--       'submission_id', NULL
--     );
--   END IF;
--   
--   -- After successful submission, record the attempt
--   INSERT INTO public.submission_rate_limit (form_id, email, submission_time)
--   VALUES (p_form_id, LOWER(p_email), now())
--   ON CONFLICT DO NOTHING;

-- ─── 4. Create indexes for performance ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_submission_rate_limit_form_email_time 
  ON public.submission_rate_limit(form_id, email, submission_time DESC);

-- ─── 5. Create cleanup function to remove old rate limit records ──────────────
DROP FUNCTION IF EXISTS public.cleanup_old_rate_limit_records() CASCADE;

CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limit_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete records older than 24 hours
  DELETE FROM public.submission_rate_limit
  WHERE submission_time < now() - interval '24 hours';
END;
$$;

-- ─── 6. Alternative: Client-side rate limiting via headers ──────────────────
-- For Netlify/Vercel edge, add rate limiting middleware:
--
--   // In /api/submit or edge function
--   const ip = request.headers.get('cf-connecting-ip') || 'unknown';
--   const rateKey = `${ip}:${formId}`;
--   const count = await redis.incr(rateKey);
--   if (count === 1) await redis.expire(rateKey, 60);  // 1 minute window
--   if (count > 100) return new Response('Rate limited', { status: 429 });

-- ─── 7. Verification ──────────────────────────────────────────────────────────
SELECT 'Migration 054: Rate limiting infrastructure added' as status;

-- Test queries:
-- SELECT COUNT(*) as submissions_last_hour FROM public.submission_rate_limit 
-- WHERE submission_time > now() - interval '1 hour' AND form_id = '<form-id>';
--
-- SELECT public.check_submission_rate_limit('<form-id>', 'test@example.com');
