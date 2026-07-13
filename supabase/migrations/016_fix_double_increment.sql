-- ==================================================================
-- 016_fix_double_increment.sql
-- BUG: response_count is incremented TWICE per submission because more than
-- one AFTER INSERT trigger on public.submissions calls increment_response_count
-- (a leftover from an earlier version of migration 004). This makes forms hit
-- their max_responses limit at HALF the intended number — e.g. a form capped
-- at 3 became "full" after ~1–2 real submissions, blocking respondents.
--
-- This migration:
--   1. Drops EVERY increment trigger on submissions (by function, name-agnostic)
--   2. Recreates exactly ONE
--   3. Reconciles every form's response_count to the real submission count
-- Idempotent: safe to re-run.
-- ==================================================================

-- 1. Drop all triggers on public.submissions whose function increments the count.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.submissions'::regclass
      AND NOT t.tgisinternal
      AND p.proname = 'increment_response_count'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.submissions', r.tgname);
  END LOOP;
END $$;

-- Also drop by any known legacy names, just in case.
DROP TRIGGER IF EXISTS trg_increment_response_count ON public.submissions;
DROP TRIGGER IF EXISTS on_submission_inserted        ON public.submissions;

-- 2. Recreate the single canonical increment trigger.
CREATE OR REPLACE FUNCTION public.increment_response_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.forms
    SET response_count = COALESCE(response_count, 0) + 1
    WHERE id = NEW.form_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_submission_inserted
  AFTER INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.increment_response_count();

-- 3. Reconcile ALL forms' counts to the true number of submissions.
UPDATE public.forms f
SET response_count = (
  SELECT count(*) FROM public.submissions s WHERE s.form_id = f.id
);

-- Verify afterwards (expect exactly ONE increment trigger):
--   SELECT tgname FROM pg_trigger
--   WHERE tgrelid = 'public.submissions'::regclass AND NOT tgisinternal;
--   SELECT title, response_count, max_responses FROM public.forms;
