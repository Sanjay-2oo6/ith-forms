-- ==================================================================
-- 019_normalize_yes_no_values.sql
-- Normalize yes/no answer values to lowercase
-- Fixes Bug B6 - Yes/No Type stored as "Yes"/"No" instead of "yes"/"no"
-- ==================================================================

-- ═══════════════════════════════════════════════════════════════════
-- 1. Convert existing yes/no answers to lowercase
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_question_id uuid;
  v_answer_count int := 0;
  v_total int := 0;
BEGIN
  FOR v_question_id IN 
    SELECT id FROM public.form_questions WHERE type = 'yes_no'
  LOOP
    -- Update "Yes" to "yes" and "No" to "no"
    UPDATE public.submission_answers
    SET value = lower(value)
    WHERE question_id = v_question_id
      AND value IN ('Yes', 'No');
    
    GET DIAGNOSTICS v_answer_count = ROW_COUNT;
    v_total := v_total + v_answer_count;
    
    IF v_answer_count > 0 THEN
      RAISE NOTICE 'Normalized % yes/no answers for question %', v_answer_count, v_question_id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Total yes/no answers normalized: %', v_total;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Add check constraint to enforce lowercase (optional)
-- ═══════════════════════════════════════════════════════════════════

-- Note: This constraint would need to be type-aware, which is complex.
-- Instead, we rely on client-side enforcement and validation in submit_response.
-- Future enhancement: Add trigger to validate answer format matches question type.

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════

-- Check yes/no answers:
-- SELECT sa.value, fq.label as question, COUNT(*) as count
-- FROM submission_answers sa
-- JOIN form_questions fq ON fq.id = sa.question_id
-- WHERE fq.type = 'yes_no'
-- GROUP BY sa.value, fq.label
-- ORDER BY fq.label, sa.value;
-- 
-- Should see only lowercase "yes" and "no" values

-- Check for any remaining capitalized values:
-- SELECT COUNT(*) FROM submission_answers sa
-- JOIN form_questions fq ON fq.id = sa.question_id
-- WHERE fq.type = 'yes_no' AND sa.value IN ('Yes', 'No');
-- Should return 0
