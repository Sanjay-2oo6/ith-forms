-- ==================================================================
-- 015_file_upload_configuration.sql
-- Add per-question file upload configuration (accepted types, max files, max size)
-- Fixes Bug B3 - File Upload - No Per-Question File Type Configuration
-- ==================================================================

-- ═══════════════════════════════════════════════════════════════════
-- 1. Add file_config column to form_questions
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.form_questions
ADD COLUMN IF NOT EXISTS file_config jsonb DEFAULT NULL;

COMMENT ON COLUMN public.form_questions.file_config IS 
'Configuration for file/document/image upload questions. 
Format: {
  "acceptedTypes": ["application/pdf", "image/png"], 
  "maxFiles": 3, 
  "maxSize": 5242880
}';

-- ═══════════════════════════════════════════════════════════════════
-- 2. Set default configurations for existing file upload questions
-- ═══════════════════════════════════════════════════════════════════

-- For existing 'file' type questions - accept anything, max 5 files, 10MB each
UPDATE public.form_questions
SET file_config = jsonb_build_object(
  'acceptedTypes', '["*"]'::jsonb,
  'maxFiles', 5,
  'maxSize', 10485760
)
WHERE type = 'file' AND file_config IS NULL;

-- For existing 'document' type questions - PDFs and Office docs
UPDATE public.form_questions
SET file_config = jsonb_build_object(
  'acceptedTypes', jsonb_build_array(
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv'
  ),
  'maxFiles', 3,
  'maxSize', 10485760
)
WHERE type = 'document' AND file_config IS NULL;

-- For existing 'image' type questions - common image formats
UPDATE public.form_questions
SET file_config = jsonb_build_object(
  'acceptedTypes', jsonb_build_array(
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ),
  'maxFiles', 5,
  'maxSize', 10485760
)
WHERE type = 'image' AND file_config IS NULL;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Update register_submission_file to validate MIME types
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.register_submission_file(
  p_submission_id uuid,
  p_question_id   uuid,
  p_file_path     text,
  p_file_name     text,
  p_file_size     bigint,
  p_mime_type     text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form_id uuid;
  v_question record;
  v_accepted_types jsonb;
  v_max_size bigint;
BEGIN
  -- Only fresh submissions to live forms
  SELECT s.form_id INTO v_form_id
  FROM public.submissions s
  JOIN public.forms f ON f.id = s.form_id
  WHERE s.id = p_submission_id
    AND f.status = 'published' AND f.deleted_at IS NULL
    AND s.submitted_at > now() - interval '1 hour';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'submission_not_found';
  END IF;

  -- Get question with file config
  SELECT * INTO v_question
  FROM public.form_questions
  WHERE id = p_question_id AND form_id = v_form_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_question';
  END IF;

  -- Path must live under the submission's own folder
  IF position(p_submission_id::text || '/' IN p_file_path) <> 1 THEN
    RAISE EXCEPTION 'invalid_path';
  END IF;

  -- Validate file size against question config or default
  IF v_question.file_config IS NOT NULL THEN
    v_max_size := COALESCE((v_question.file_config->>'maxSize')::bigint, 10485760);
  ELSE
    v_max_size := 10485760; -- 10MB default
  END IF;
  
  IF p_file_size IS NOT NULL AND p_file_size > v_max_size THEN
    RAISE EXCEPTION 'file_too_large';
  END IF;

  -- Validate MIME type against question config
  IF v_question.file_config IS NOT NULL THEN
    v_accepted_types := v_question.file_config->'acceptedTypes';
    
    -- If acceptedTypes exists and is not wildcard "*"
    IF v_accepted_types IS NOT NULL THEN
      -- Check if it's wildcard
      IF NOT (v_accepted_types @> '["*"]'::jsonb) THEN
        -- Validate MIME type is in accepted list
        IF NOT (v_accepted_types ? p_mime_type) THEN
          RAISE EXCEPTION 'invalid_file_type';
        END IF;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.submission_files
    (submission_id, form_id, question_id, file_path, file_name, file_size, mime_type)
  VALUES
    (p_submission_id, v_form_id, p_question_id,
     p_file_path, left(p_file_name, 300), p_file_size, left(p_mime_type, 100));
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════

-- Check file_config column exists:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'form_questions' AND column_name = 'file_config';

-- View existing file question configurations:
-- SELECT id, label, type, file_config 
-- FROM public.form_questions 
-- WHERE type IN ('file', 'document', 'image');
