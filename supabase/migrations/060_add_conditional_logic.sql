-- Migration 060: Add Conditional Logic Support
-- Description: Documents the logic_rules field structure in form_questions.config
-- Risk: NONE (documentation only, no schema changes)
-- Date: 2026-10-01

-- ============================================================================
-- CONDITIONAL LOGIC DOCUMENTATION
-- ============================================================================
-- The form_questions.config JSONB field already exists and supports storing
-- logic rules. This migration documents the structure without changing schema.
--
-- Logic Rule Structure:
-- {
--   "logic_rules": [
--     {
--       "id": "uuid-string",              -- Unique rule identifier
--       "condition": "equals",             -- Phase 1: only "equals" supported
--       "value": "answer-value",           -- Value to match (e.g., "yes", "option-a")
--       "action": "show_section",          -- Phase 1: only "show_section" supported
--       "target_section_id": "uuid-string" -- Section to show when condition matches
--     }
--   ]
-- }
--
-- Behavior Rules:
-- 1. Default: No logic rules = show all sections (backward compatible)
-- 2. Match: If rule matches → show ONLY targeted sections
-- 3. No match: Show all sections (fallback)
-- 4. Validation: Skip hidden questions (don't require answers)
-- 5. Submission: Only save visible question answers
-- 6. Cascading: Section A question can affect Section B (re-evaluate on answer change)
--
-- Phase 1 Limitations:
-- - Only "equals" condition (no "not_equals", "contains", "greater_than", etc.)
-- - Only "show_section" action (no "hide_section", "jump_to", etc.)
-- - No AND/OR logic (single condition per rule)
-- - No validation rules (only visibility)
--
-- Future Enhancements (Phase 2+):
-- - Additional conditions: not_equals, contains, greater_than, less_than
-- - Additional actions: hide_section, jump_to, skip_to_end
-- - Complex logic: AND/OR operators, nested conditions
-- - Question-level visibility (not just sections)
-- - Validation rules: require_if, validate_if
-- ============================================================================

-- Verify the config column exists (it already does, this is a sanity check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'form_questions' 
      AND column_name = 'config'
  ) THEN
    RAISE EXCEPTION 'form_questions.config column does not exist. Migration failed.';
  END IF;
  
  RAISE NOTICE '✅ form_questions.config column exists and ready for logic_rules';
END $$;

-- Create a helper function to validate logic rule structure (optional, for safety)
CREATE OR REPLACE FUNCTION validate_logic_rule(rule JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Check required fields exist
  IF NOT (
    rule ? 'id' AND
    rule ? 'condition' AND
    rule ? 'value' AND
    rule ? 'action' AND
    rule ? 'target_section_id'
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Check field types
  IF NOT (
    jsonb_typeof(rule->'id') = 'string' AND
    jsonb_typeof(rule->'condition') = 'string' AND
    jsonb_typeof(rule->'value') = 'string' AND
    jsonb_typeof(rule->'action') = 'string' AND
    jsonb_typeof(rule->'target_section_id') = 'string'
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Phase 1: Validate allowed values
  IF (rule->>'condition') NOT IN ('equals') THEN
    RETURN FALSE;
  END IF;
  
  IF (rule->>'action') NOT IN ('show_section') THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION validate_logic_rule IS 
  'Validates the structure and values of a conditional logic rule (Phase 1)';

-- Test the validation function
DO $$
DECLARE
  valid_rule JSONB := '{
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "condition": "equals",
    "value": "yes",
    "action": "show_section",
    "target_section_id": "223e4567-e89b-12d3-a456-426614174000"
  }'::JSONB;
  
  invalid_rule JSONB := '{
    "id": "123",
    "condition": "invalid",
    "value": 123
  }'::JSONB;
BEGIN
  -- Test valid rule
  IF NOT validate_logic_rule(valid_rule) THEN
    RAISE EXCEPTION 'Valid rule validation failed';
  END IF;
  
  -- Test invalid rule
  IF validate_logic_rule(invalid_rule) THEN
    RAISE EXCEPTION 'Invalid rule validation should have failed';
  END IF;
  
  RAISE NOTICE '✅ Logic rule validation function working correctly';
END $$;

-- Migration complete
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 060 complete: Conditional logic support documented and ready';
END $$;
