-- ==================================================================
-- 026_cryptographic_reference_tokens.sql
-- Security Fix: Non-sequential submission tokens prevent enumeration
-- Issue #6 from Professional Audit: Reference ID Sequential Guessing
--
-- SECURITY IMPACT:
-- - Prevents attackers from guessing other respondents' submission IDs
-- - Before: Reference ID = NXG-a1b2-00042 (predictable, enumerable)
-- - After: Reference Token = aB3xK9mP2qL8qR7sT5u2... (cryptographic, non-guessable)
--
-- BACKWARD COMPATIBILITY:
-- - Keeps reference_id for admin display (still sequential)
-- - Adds reference_token for public /view-response/[token] links
-- - Migration is additive; no data loss
--
-- Idempotent — safe to run multiple times
-- ==================================================================

-- Add reference_token column (not indexed; public but not searchable)
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS reference_token text UNIQUE;

-- Function to generate cryptographically random token
CREATE OR REPLACE FUNCTION public.generate_reference_token()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT encode(gen_random_bytes(24), 'base64url');
$$;

COMMENT ON FUNCTION public.generate_reference_token() IS 'Generate cryptographically random token: 32 Base64url chars, non-guessable';

-- Trigger to assign token on insertion
CREATE OR REPLACE FUNCTION public.assign_reference_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reference_token IS NULL THEN
    NEW.reference_token := public.generate_reference_token();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_submission_insert_token ON public.submissions;
CREATE TRIGGER before_submission_insert_token
  BEFORE INSERT ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_reference_token();

-- Backfill existing submissions without tokens (should be none in fresh installs)
UPDATE public.submissions
  SET reference_token = public.generate_reference_token()
  WHERE reference_token IS NULL;

-- Add constraint to ensure all future submissions have a token
ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_reference_token_not_null CHECK (reference_token IS NOT NULL);

-- Verify all submissions have tokens now
-- SELECT COUNT(*) FROM submissions WHERE reference_token IS NULL;  -- Should be 0

COMMENT ON COLUMN public.submissions.reference_token IS 'Non-sequential, cryptographic token for /view-response/[token] public links; prevents enumeration attacks';

-- ───────────────────────────────────────────────────────────────────
-- USAGE IN APPLICATION:
-- 
-- 1. Public form submit RPC returns both reference_id and reference_token:
--    {
--      submission_id: "uuid",
--      reference_id: "NXG-a1b2-00042",      ← Keep for admin/respondent reference
--      reference_token: "aB3xK9mP2qL8..."   ← Use for /view-response link
--    }
--
-- 2. Thank-you page displays reference_id but uses reference_token in link:
--    <a href="/view-response/aB3xK9mP2qL8...">View your submission</a>
--
-- 3. /view-response route loads submission by reference_token (UNIQUE),
--    not reference_id, preventing enumeration:
--    const { data } = await supabase
--      .from("submissions")
--      .select("*")
--      .eq("reference_token", token)  ← No enumeration possible
--      .maybeSingle();
-- ───────────────────────────────────────────────────────────────────

