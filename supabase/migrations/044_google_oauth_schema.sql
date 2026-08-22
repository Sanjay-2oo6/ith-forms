-- ============================================================
-- 044_google_oauth_schema.sql
-- Google OAuth + Per-Email Submission Limits
--
-- Changes:
-- 1. Add responses_per_email_limit column to forms table
-- 2. Create verified_emails table to track email verification + counts
-- 3. Add RLS policies for verified_emails
-- 4. Add indexes for performance
--
-- Idempotent: safe to re-run
-- ============================================================

-- ─── 1. Add responses_per_email_limit to forms ────────────────────────────────
ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS responses_per_email_limit integer;

-- Comment for clarity
COMMENT ON COLUMN public.forms.responses_per_email_limit IS
  'Max submissions per unique email per form. NULL = unlimited (default).';

-- ─── 2. Create verified_emails table ─────────────────────────────────────────
-- Tracks which emails have submitted to which forms, and how many times.
-- Used to enforce per-email submission limits and prevent duplicate tracking.

CREATE TABLE IF NOT EXISTS public.verified_emails (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id                 uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  email                   text NOT NULL,
  submission_count        integer NOT NULL DEFAULT 0,
  first_submitted_at      timestamptz NOT NULL DEFAULT now(),
  last_submitted_at       timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure one email per form
  CONSTRAINT verified_emails_form_email_unique UNIQUE (form_id, email)
);

-- ─── 3. Indexes for verified_emails ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_verified_emails_form_email 
  ON public.verified_emails (form_id, email);

CREATE INDEX IF NOT EXISTS idx_verified_emails_form_id
  ON public.verified_emails (form_id);

CREATE INDEX IF NOT EXISTS idx_verified_emails_created_at
  ON public.verified_emails (first_submitted_at DESC);

-- ─── 4. Enable RLS on verified_emails ────────────────────────────────────────
ALTER TABLE public.verified_emails ENABLE ROW LEVEL SECURITY;

-- ─── 5. RLS Policies for verified_emails ────────────────────────────────────
-- Policy 1: Anon can insert (RPC will validate the email via session)
DROP POLICY IF EXISTS "anon_verified_emails_insert" ON public.verified_emails;
CREATE POLICY "anon_verified_emails_insert" ON public.verified_emails
  FOR INSERT TO anon
  WITH CHECK (true);  -- Validation happens in submit_response RPC

-- Policy 2: Anon can read (to check submission count on form load)
DROP POLICY IF EXISTS "anon_verified_emails_read" ON public.verified_emails;
CREATE POLICY "anon_verified_emails_read" ON public.verified_emails
  FOR SELECT TO anon
  USING (true);  -- RPC will validate email ownership

-- Policy 3: Authenticated (admin) can read verified_emails for their forms
DROP POLICY IF EXISTS "admin_verified_emails_read" ON public.verified_emails;
CREATE POLICY "admin_verified_emails_read" ON public.verified_emails
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.forms f
      WHERE f.id = public.verified_emails.form_id
      AND public.is_admin()
    )
  );

-- ─── 6. Grant permissions ───────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON public.verified_emails TO anon, authenticated;

-- ─── 7. Verification query (manual check after migration) ────────────────────
-- RUN THESE MANUALLY to verify the migration worked:
-- 
-- a) Check column was added:
--    SELECT column_name, data_type FROM information_schema.columns
--      WHERE table_name='forms' AND column_name='responses_per_email_limit';
--    → should return (responses_per_email_limit, integer)
--
-- b) Check table was created:
--    SELECT tablename FROM pg_tables WHERE tablename='verified_emails';
--    → should return (verified_emails)
--
-- c) Check indexes:
--    SELECT indexname FROM pg_indexes WHERE tablename='verified_emails';
--    → should return idx_verified_emails_form_email, idx_verified_emails_form_id, idx_verified_emails_created_at
--
-- d) Check RLS is enabled:
--    SELECT relname FROM pg_class WHERE oid IN (
--      SELECT attrelid FROM pg_attribute WHERE attname='id' AND attrelid IN (
--        SELECT oid FROM pg_class WHERE relname='verified_emails'
--      )
--    );
--    Then check pg_policies for 'verified_emails'

SELECT 'Migration 044: Google OAuth schema - Complete' as status;
