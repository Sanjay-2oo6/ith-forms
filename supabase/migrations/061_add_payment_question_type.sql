-- Migration 061: Add payment question type support
-- 
-- This migration is informational only - the form_questions.type column is TEXT without constraints.
-- Payment question type is now supported in the application code.
-- 
-- The payment question type allows admins to:
-- 1. Configure a payment URL that users will be redirected to
-- 2. Require users to upload screenshot proof of payment completion
-- 3. View payment proofs in the response detail modal
--
-- Payment questions integrate with the existing file upload system and are excluded
-- from conditional logic triggers since they don't produce answer values.

-- Verify the table structure (no changes needed)
DO $$
BEGIN
  -- Confirm form_questions.type is TEXT (no enum constraint to add to)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'form_questions' 
    AND column_name = 'type' 
    AND data_type = 'text'
  ) THEN
    RAISE NOTICE 'form_questions.type column confirmed as TEXT - payment type supported';
  ELSE
    RAISE EXCEPTION 'Unexpected schema: form_questions.type is not TEXT';
  END IF;
END $$;

-- Document supported question types for reference
COMMENT ON COLUMN form_questions.type IS 
'Question type. Supported values: short_answer, long_answer, single_choice, multiple_choice, dropdown, linear_scale, file_upload, information_paragraph, payment. No CHECK constraint - validation happens in application code.';