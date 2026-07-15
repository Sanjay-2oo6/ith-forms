-- ==================================================================
-- 017_question_config.sql
-- Adds a per-question `config` jsonb for the configurable question types
-- (requirements #4, #5, #6): file accept list + single-file, rating max,
-- min/max length, min/max selections, and Multiple Choice Grid rows/cols.
--
-- Additive & idempotent. The builder and public form both `select("*")`
-- from form_questions, so the new column flows to them with no RPC changes.
-- Existing rows get an empty object and keep working via code-side defaults.
-- ==================================================================

ALTER TABLE public.form_questions
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Shape (all keys optional; code applies sensible defaults):
--   file:     { "accept": [".pdf",".png"], "maxFiles": 1 }
--   rating:   { "ratingMax": 10 }
--   text:     { "minLength": 0, "maxLength": 500 }
--   checkbox: { "minSelections": 0, "maxSelections": 3 }
--   grid:     { "rows": ["Row 1","Row 2"], "cols": ["Col 1","Col 2"] }
