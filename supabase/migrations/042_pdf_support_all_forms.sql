-- Migration 042: Enable PDF Support for ALL File Questions in ALL Forms
-- This migration ensures every file question everywhere accepts PDFs

-- ============================================================
-- 1. LIST: Find all file questions in all forms
-- ============================================================
-- SELECT 
--   f.id as form_id,
--   f.slug,
--   f.title,
--   q.id as question_id,
--   q.label,
--   q.type,
--   q.config
-- FROM public.form_questions q
-- JOIN public.forms f ON f.id = q.form_id
-- WHERE q.type IN ('file', 'document', 'image')
-- ORDER BY f.slug, q.label;

-- ============================================================
-- 2. UPDATE ALL FILE QUESTIONS: Set proper config with PDF
-- ============================================================
UPDATE public.form_questions
SET config = jsonb_build_object(
  'accept', '[ ".pdf", ".doc", ".docx", ".txt", ".xls", ".xlsx", ".ppt", ".pptx", ".jpg", ".jpeg", ".png", ".gif" ]'::jsonb,
  'maxSizeMB', 10,
  'maxFiles', 1
)
WHERE type IN ('file', 'document', 'image');

-- ============================================================
-- 3. VERIFY: Show all updated file questions
-- ============================================================
SELECT 
  f.slug as form_slug,
  q.label as question_label,
  q.type,
  q.config->'accept' as accept_extensions,
  (q.config->>'maxSizeMB') as max_size_mb,
  CASE 
    WHEN q.config->'accept' @> '".pdf"'::jsonb THEN '✓ PDF'
    ELSE '✗ NO PDF'
  END as pdf_status
FROM public.form_questions q
JOIN public.forms f ON f.id = q.form_id
WHERE q.type IN ('file', 'document', 'image')
ORDER BY f.slug, q.label;

-- ============================================================
-- 4. FOCUS: Check job-applications form specifically
-- ============================================================
SELECT 
  q.id,
  q.label,
  q.type,
  q.required,
  q.config,
  q.config->'accept' as accept_list
FROM public.form_questions q
WHERE q.form_id = (SELECT id FROM public.forms WHERE slug = 'job-applications' LIMIT 1)
  AND q.type IN ('file', 'document', 'image')
ORDER BY q.label;

-- ============================================================
-- 5. COUNT: How many file questions now have PDF support
-- ============================================================
SELECT 
  COUNT(*) as total_file_questions,
  SUM(CASE WHEN config->'accept' @> '".pdf"'::jsonb THEN 1 ELSE 0 END) as with_pdf_support,
  SUM(CASE WHEN config->'accept' IS NULL THEN 1 ELSE 0 END) as with_null_config
FROM public.form_questions
WHERE type IN ('file', 'document', 'image');

-- ============================================================
-- STATUS
-- ============================================================
SELECT 'Migration 042: PDF support enabled for all file questions globally' as status;

