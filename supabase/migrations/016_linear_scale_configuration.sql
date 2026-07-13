-- ==================================================================
-- 016_linear_scale_configuration.sql
-- Add configurable range for linear_scale questions
-- Fixes Bug B1 - Linear Scale Hardcoded Range (1-10)
-- ==================================================================

-- ═══════════════════════════════════════════════════════════════════
-- 1. Add scale configuration columns
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.form_questions
ADD COLUMN IF NOT EXISTS scale_min integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS scale_max integer DEFAULT 5;

-- Add check constraint: max must be greater than min
ALTER TABLE public.form_questions
ADD CONSTRAINT scale_range_check CHECK (scale_max > scale_min);

-- Add check constraint: reasonable range limits (1-100)
ALTER TABLE public.form_questions
ADD CONSTRAINT scale_bounds_check CHECK (
  scale_min >= 0 AND scale_min <= 100 AND
  scale_max >= 1 AND scale_max <= 100
);

COMMENT ON COLUMN public.form_questions.scale_min IS 'Minimum value for linear_scale questions (default 1)';
COMMENT ON COLUMN public.form_questions.scale_max IS 'Maximum value for linear_scale questions (default 5)';

-- ═══════════════════════════════════════════════════════════════════
-- 2. Set defaults for existing linear_scale questions
-- ═══════════════════════════════════════════════════════════════════

-- Update existing linear_scale questions to have 1-10 range (current behavior)
UPDATE public.form_questions
SET scale_min = 1, scale_max = 10
WHERE type = 'linear_scale' AND (scale_min IS NULL OR scale_max IS NULL);

-- Update existing rating questions to have 1-5 range
UPDATE public.form_questions
SET scale_min = 1, scale_max = 5
WHERE type = 'rating' AND (scale_min IS NULL OR scale_max IS NULL);

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════

-- Check columns exist:
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'form_questions' AND column_name LIKE 'scale_%';

-- View existing scale configurations:
-- SELECT id, label, type, scale_min, scale_max 
-- FROM public.form_questions 
-- WHERE type IN ('linear_scale', 'rating');
