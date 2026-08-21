-- Migration 040: Comprehensive File Question Configuration Fix
-- This migration ensures all file upload questions have proper config
-- including PDF support, proper MIME types, and size limits

-- ============================================================
-- 1. GET the form ID for job-applications
-- ============================================================
-- First, let's ensure the form exists
DO $$
DECLARE
  v_form_id uuid;
BEGIN
  SELECT id INTO v_form_id FROM public.forms WHERE slug = 'job-applications' LIMIT 1;
  
  IF v_form_id IS NULL THEN
    RAISE NOTICE 'job-applications form not found';
  ELSE
    RAISE NOTICE 'Found job-applications form: %', v_form_id;
  END IF;
END $$;

-- ============================================================
-- 2. FIX ALL FILE QUESTIONS - Use direct JSON building
-- ============================================================
-- This approach creates a clean JSON config object from scratch
UPDATE public.form_questions
SET config = jsonb_build_object(
  'accept', jsonb_build_array('.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.gif'),
  'maxSizeMB', 10,
  'maxFiles', 1
)
WHERE form_id IN (SELECT id FROM public.forms WHERE slug = 'job-applications')
  AND type IN ('file', 'document', 'image');

-- ============================================================
-- 3. VERIFY THE FIX - Show all file questions with their config
-- ============================================================
WITH job_app_form AS (
  SELECT id FROM public.forms WHERE slug = 'job-applications'
)
SELECT 
  q.id as question_id,
  q.label,
  q.type,
  q.required,
  q.config,
  q.config->'accept' as accept_extensions,
  (q.config->>'maxSizeMB')::text as max_size_mb
FROM public.form_questions q
WHERE q.form_id IN (SELECT id FROM job_app_form)
  AND q.type IN ('file', 'document', 'image')
ORDER BY q.label;

-- ============================================================
-- 4. TEST - Verify PDF is in the accept array
-- ============================================================
WITH job_app_form AS (
  SELECT id FROM public.forms WHERE slug = 'job-applications'
)
SELECT 
  q.id,
  q.label,
  CASE 
    WHEN q.config->'accept' @> '".pdf"'::jsonb THEN '✓ PDF supported'
    ELSE '✗ PDF NOT supported'
  END as pdf_support,
  q.config->'accept' as accept_list
FROM public.form_questions q
WHERE q.form_id IN (SELECT id FROM job_app_form)
  AND q.type IN ('file', 'document', 'image');

-- ============================================================
-- 5. DOUBLE CHECK - Show raw config for debugging
-- ============================================================
WITH job_app_form AS (
  SELECT id FROM public.forms WHERE slug = 'job-applications'
)
SELECT 
  q.id,
  q.label,
  q.type,
  jsonb_pretty(q.config) as config_json
FROM public.form_questions q
WHERE q.form_id IN (SELECT id FROM job_app_form)
  AND q.type IN ('file', 'document', 'image')
ORDER BY q.label;

-- ============================================================
-- 6. FINAL STATUS
-- ============================================================
SELECT 'Migration 040: File question configs comprehensively fixed' as status;
SELECT COUNT(*) as file_questions_updated
FROM public.form_questions
WHERE form_id IN (SELECT id FROM public.forms WHERE slug = 'job-applications')
  AND type IN ('file', 'document', 'image');

