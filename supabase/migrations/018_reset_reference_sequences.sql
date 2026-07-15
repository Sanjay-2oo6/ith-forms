-- ==================================================================
-- 018_reset_reference_sequences.sql  (requirement #7)
-- Reference IDs were starting from 00003 because test submissions advanced
-- the per-form sequence. This realigns each form's sequence to the HIGHEST
-- number actually in use, so:
--   • numbering stays sequential, unique, and zero-padded (00001, 00002, …)
--   • a form with no remaining submissions restarts cleanly at 00001
--   • it can NEVER collide with an existing reference_id (uses MAX, not COUNT)
--
-- To get a fresh 00001: delete the unwanted test submissions first, then run
-- this migration. Idempotent — safe to re-run any time.
-- ==================================================================

-- Make sure every non-deleted form has a sequence row.
INSERT INTO public.form_submission_sequences (form_id, current_value)
SELECT id, 0 FROM public.forms WHERE deleted_at IS NULL
ON CONFLICT (form_id) DO NOTHING;

-- Set each sequence to the max trailing number already used (0 if none).
UPDATE public.form_submission_sequences fss
SET current_value = COALESCE((
      SELECT MAX((regexp_replace(s.reference_id, '^.*[-_](\d+)$', '\1'))::int)
      FROM public.submissions s
      WHERE s.form_id = fss.form_id
        AND s.reference_id ~ '[-_]\d+$'
    ), 0),
    updated_at = now();

-- Verify:
--   SELECT f.title, fss.current_value
--   FROM public.form_submission_sequences fss
--   JOIN public.forms f ON f.id = fss.form_id;
