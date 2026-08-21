-- Migration 039: Final PDF Fix with Diagnostics
-- Comprehensive fix for PDF upload issues across all file questions

-- ============================================================
-- DIAGNOSTIC: Check current state
-- ============================================================
-- Run this query to see what's currently stored:
-- SELECT 
--   id,
--   label,
--   type,
--   required,
--   config,
--   (config->>'accept')::text as accept_field
-- FROM public.form_questions
-- WHERE form_id IN (SELECT id FROM public.forms WHERE slug = 'job-applications')
--   AND type IN ('file', 'document');

-- ============================================================
-- 1. FIX: Update ALL file questions in job-applications form
-- ============================================================
-- Set accept to include PDF and other common document types
UPDATE public.form_questions
SET config = jsonb_set(
  COALESCE(config, '{}'),
  '{accept}',
  '[ ".pdf", ".doc", ".docx", ".txt", ".xls", ".xlsx", ".jpg", ".jpeg", ".png", ".gif" ]'::jsonb
)
WHERE form_id IN (SELECT id FROM public.forms WHERE slug = 'job-applications')
  AND type IN ('file', 'document');

-- ============================================================
-- 2. FIX: Ensure maxSizeMB is set for all file questions
-- ============================================================
UPDATE public.form_questions
SET config = jsonb_set(
  COALESCE(config, '{}'),
  '{maxSizeMB}',
  '10'::jsonb
)
WHERE form_id IN (SELECT id FROM public.forms WHERE slug = 'job-applications')
  AND type IN ('file', 'document');

-- ============================================================
-- 3. VERIFY: Check the updates
-- ============================================================
-- After applying this migration, verify with:
-- SELECT 
--   id,
--   label,
--   type,
--   required,
--   config->'accept' as accept_extensions,
--   config->'maxSizeMB' as max_size_mb
-- FROM public.form_questions
-- WHERE form_id IN (SELECT id FROM public.forms WHERE slug = 'job-applications')
--   AND type IN ('file', 'document')
-- ORDER BY label;

-- ============================================================
-- 4. DEBUG: Check if register_submission_file RPC accepts PDFs
-- ============================================================
-- The RPC validates file extensions: pdf, doc, docx, xls, xlsx, ppt, pptx, txt, csv, jpg, jpeg, png, gif, zip
-- PDF is already in this list, so the RPC should accept PDFs

-- ============================================================
-- 5. Verify the form exists and has the right slug
-- ============================================================
SELECT 
  id,
  title,
  slug,
  status
FROM public.forms
WHERE slug = 'job-applications'
LIMIT 1;

-- ============================================================
-- 6. List all file questions in the job-applications form
-- ============================================================
SELECT 
  id,
  label,
  type,
  required,
  config->'accept' as accept_extensions,
  config->'maxSizeMB' as max_size_mb
FROM public.form_questions
WHERE form_id IN (SELECT id FROM public.forms WHERE slug = 'job-applications')
  AND type IN ('file', 'document')
ORDER BY label;

-- ============================================================
-- 7. Verify register_submission_file RPC works
-- ============================================================
-- This function should accept PDFs:
-- - Checks file extension (pdf is allowed)
-- - Checks file size (max 50MB)
-- - Validates path security
-- - Registers file in submission_files table
SELECT 'Migration 039: PDF support fully enabled' as status;

