-- ==================================================================
-- 017_fix_checkbox_delimiter.sql
-- Change checkbox answer delimiter from comma to || (double pipe)
-- Fixes Bug B4 - Checkbox Array Storage with commas in option labels
-- ==================================================================

-- ═══════════════════════════════════════════════════════════════════
-- IMPORTANT: This migration converts existing data
-- Backup recommended before running
-- ═══════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════
-- 1. Convert existing checkbox answers from comma to || delimiter
-- ═══════════════════════════════════════════════════════════════════

-- Find all checkbox question IDs
DO $$
DECLARE
  v_question_id uuid;
  v_answer_count int := 0;
BEGIN
  FOR v_question_id IN 
    SELECT id FROM public.form_questions WHERE type = 'checkbox'
  LOOP
    -- Update answers for this checkbox question
    -- Replace commas with || but only for multi-value answers
    -- (single values without commas remain unchanged)
    UPDATE public.submission_answers
    SET value = replace(value, ',', '||')
    WHERE question_id = v_question_id
      AND value LIKE '%,%'; -- Only update if contains comma
    
    GET DIAGNOSTICS v_answer_count = ROW_COUNT;
    IF v_answer_count > 0 THEN
      RAISE NOTICE 'Converted % checkbox answers for question %', v_answer_count, v_question_id;
    END IF;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Add helper function to parse checkbox values
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.parse_checkbox_value(answer_value text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF answer_value IS NULL OR answer_value = '' THEN
    RETURN ARRAY[]::text[];
  END IF;
  
  -- If contains ||, split on that (new format)
  IF position('||' IN answer_value) > 0 THEN
    RETURN string_to_array(answer_value, '||');
  END IF;
  
  -- Otherwise return as single-element array (backward compat)
  RETURN ARRAY[answer_value];
END;
$$;

COMMENT ON FUNCTION public.parse_checkbox_value(text) IS 
'Parse checkbox answer value into array. Handles || delimiter (new format) and single values (old format).';

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════

-- View checkbox answers before/after:
-- SELECT sa.id, sa.value, fq.label as question
-- FROM submission_answers sa
-- JOIN form_questions fq ON fq.id = sa.question_id
-- WHERE fq.type = 'checkbox'
-- LIMIT 10;

-- Test parsing function:
-- SELECT parse_checkbox_value('Option A||Option B||Option C');
-- Should return: {"Option A","Option B","Option C"}

-- SELECT parse_checkbox_value('Single Option');
-- Should return: {"Single Option"}
