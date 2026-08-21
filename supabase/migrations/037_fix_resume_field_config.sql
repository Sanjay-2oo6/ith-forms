-- Migration 037: Fix Resume/CV field to accept PDF files
-- Issue: Resume field rejects PDFs but accepts PNGs
-- Cause: config.accept array is missing ".pdf" extension

-- Find and update the Resume/CV question in Job Application form
UPDATE public.form_questions
SET config = jsonb_set(
  COALESCE(config, '{}'),
  '{accept}',
  jsonb_build_array('.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png')
)
WHERE type IN ('file', 'document')
  AND label ILIKE '%resume%' OR label ILIKE '%cv%'
  AND form_id IN (
    SELECT id FROM public.forms WHERE slug = 'job-applications'
  );

-- Also ensure file_config allows PDFs (if using newer config format)
UPDATE public.form_questions
SET file_config = jsonb_set(
  COALESCE(file_config, '{}'),
  '{acceptedTypes}',
  jsonb_build_array(
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/jpg'
  )
)
WHERE type IN ('file', 'document')
  AND (label ILIKE '%resume%' OR label ILIKE '%cv%')
  AND form_id IN (
    SELECT id FROM public.forms WHERE slug = 'job-applications'
  );

-- Verify the update
SELECT 
  id,
  label,
  type,
  config,
  file_config
FROM public.form_questions
WHERE (label ILIKE '%resume%' OR label ILIKE '%cv%')
  AND form_id IN (SELECT id FROM public.forms WHERE slug = 'job-applications');

SELECT 'Resume/CV field configuration updated to accept PDFs' as status;
