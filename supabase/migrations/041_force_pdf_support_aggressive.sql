-- Migration 041: Aggressive PDF Support Fix
-- This migration handles all edge cases and ensures PDFs are accepted

-- ============================================================
-- 1. CHECK: What's currently in the database
-- ============================================================
-- Run this to see what we're working with:
-- SELECT id, label, type, config, config->'accept' as accept_field
-- FROM form_questions 
-- WHERE form_id IN (SELECT id FROM forms WHERE slug = 'job-applications')
-- AND type IN ('file', 'document', 'image');

-- ============================================================
-- 2. FORCE: Set accept array for ALL file questions
--    This completely replaces whatever is there
-- ============================================================
UPDATE public.form_questions
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{accept}',
  '[ ".pdf", ".doc", ".docx", ".txt", ".xls", ".xlsx", ".ppt", ".pptx", ".jpg", ".jpeg", ".png", ".gif" ]'::jsonb
)
WHERE form_id IN (
  SELECT id FROM public.forms WHERE slug = 'job-applications'
)
AND type IN ('file', 'document', 'image');

-- ============================================================
-- 3. ALSO SET: Ensure maxSizeMB is set
-- ============================================================
UPDATE public.form_questions
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{maxSizeMB}',
  '10'::jsonb
)
WHERE form_id IN (
  SELECT id FROM public.forms WHERE slug = 'job-applications'
)
AND type IN ('file', 'document', 'image');

-- ============================================================
-- 4. VERIFY: Check the updates worked
-- ============================================================
SELECT 
  id,
  label,
  type,
  config as full_config,
  config->'accept' as accept_array,
  config->'maxSizeMB' as max_size_mb
FROM public.form_questions
WHERE form_id IN (SELECT id FROM public.forms WHERE slug = 'job-applications')
AND type IN ('file', 'document', 'image')
ORDER BY label;

-- ============================================================
-- 5. VALIDATE: Ensure PDF is actually in the array
-- ============================================================
SELECT 
  id,
  label,
  CASE 
    WHEN config->'accept' @> '".pdf"'::jsonb THEN 'YES - PDF IS SUPPORTED ✓'
    WHEN config->'accept' IS NULL THEN 'NO - ACCEPT ARRAY IS NULL ✗'
    ELSE 'NO - PDF NOT IN ARRAY ✗'
  END as pdf_support
FROM public.form_questions
WHERE form_id IN (SELECT id FROM public.forms WHERE slug = 'job-applications')
AND type IN ('file', 'document', 'image');

-- ============================================================
-- 6. DOUBLE CHECK: Show exact config JSON for debugging
-- ============================================================
SELECT 
  id,
  label,
  jsonb_pretty(config) as config_pretty_json
FROM public.form_questions
WHERE form_id IN (SELECT id FROM public.forms WHERE slug = 'job-applications')
AND type IN ('file', 'document', 'image')
ORDER BY label;

-- ============================================================
-- 7. FINAL STATUS
-- ============================================================
SELECT 'Migration 041 complete: PDF support forcefully enabled' as status;
SELECT COUNT(*) as file_questions_updated
FROM public.form_questions
WHERE form_id IN (SELECT id FROM public.forms WHERE slug = 'job-applications')
AND type IN ('file', 'document', 'image')
AND config->'accept' @> '".pdf"'::jsonb;

