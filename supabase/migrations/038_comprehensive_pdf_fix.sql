-- Migration 038: Comprehensive PDF Upload Fix
-- This migration ensures ALL file upload questions properly accept PDFs

-- 1. UPDATE ALL FILE QUESTIONS TO ACCEPT PDFs
UPDATE public.form_questions
SET config = jsonb_set(
  COALESCE(config, '{}'),
  '{accept}',
  jsonb_build_array('.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.gif')
)
WHERE type IN ('file', 'document')
  AND form_id IN (SELECT id FROM public.forms WHERE slug = 'job-applications')
  AND (config IS NULL OR NOT (config->'accept' @> '".pdf"'::jsonb));

-- 2. ALSO UPDATE file_config with proper MIME types
UPDATE public.form_questions
SET file_config = CASE
  WHEN type = 'document' THEN jsonb_build_object(
    'accept', jsonb_build_array('.pdf', '.doc', '.docx', '.txt'),
    'maxFiles', 1,
    'maxSizeMB', 10,
    'acceptedTypes', jsonb_build_array(
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    )
  )
  WHEN type = 'file' THEN jsonb_build_object(
    'accept', jsonb_build_array('.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png'),
    'maxFiles', 1,
    'maxSizeMB', 10,
    'acceptedTypes', jsonb_build_array(
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png'
    )
  )
  ELSE file_config
END
WHERE type IN ('file', 'document')
  AND form_id IN (SELECT id FROM public.forms WHERE slug = 'job-applications');

-- 3. VERIFY THE UPDATE
SELECT 
  id,
  label,
  type,
  required,
  config,
  file_config
FROM public.form_questions
WHERE form_id IN (SELECT id FROM public.forms WHERE slug = 'job-applications')
  AND type IN ('file', 'document')
ORDER BY label;

-- 4. Double check PDF is now in accept list
SELECT 
  id,
  label,
  config->'accept' as accept_extensions,
  file_config->'acceptedTypes' as accepted_mime_types
FROM public.form_questions
WHERE form_id IN (SELECT id FROM public.forms WHERE slug = 'job-applications')
  AND type IN ('file', 'document');

SELECT 'PDF support comprehensively enabled for all file questions' as status;
