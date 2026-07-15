-- ==================================================================
-- 010_per_form_reference_ids.sql
-- Implement per-form reference ID system with form abbreviations
-- Format: {ABBR}-{formId}-{sequence}
-- Example: NXG-a1b2c3d4-00001
-- ==================================================================

-- ─── 1. Add per-form sequence tracking table ────────────────────
CREATE TABLE IF NOT EXISTS public.form_submission_sequences (
  form_id uuid PRIMARY KEY REFERENCES public.forms(id) ON DELETE CASCADE,
  current_value integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_form_submission_sequences_form_id 
  ON public.form_submission_sequences(form_id);

-- ─── 2. Function to generate form abbreviation from title ───────
CREATE OR REPLACE FUNCTION public.generate_form_abbreviation(form_title text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  words text[];
  abbr text := '';
  word text;
BEGIN
  -- Remove special characters and split into words
  form_title := regexp_replace(form_title, '[^a-zA-Z0-9 ]', '', 'g');
  words := string_to_array(upper(form_title), ' ');
  
  -- Take first letter of each word, max 5 letters
  FOR word IN SELECT unnest(words) LOOP
    IF length(word) > 0 AND length(abbr) < 5 THEN
      abbr := abbr || left(word, 1);
    END IF;
  END LOOP;
  
  -- If empty or too short, use first 3-5 chars of title
  IF length(abbr) < 2 THEN
    abbr := upper(left(regexp_replace(form_title, '[^a-zA-Z0-9]', '', 'g'), 5));
  END IF;
  
  -- Ensure minimum length
  IF length(abbr) < 2 THEN
    abbr := 'FORM';
  END IF;
  
  RETURN abbr;
END;
$$;

-- ─── 3. Function to get next reference ID for a form ────────────
CREATE OR REPLACE FUNCTION public.next_form_reference_id(p_form_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form_title text;
  v_abbr text;
  v_sequence integer;
  v_form_id_short text;
BEGIN
  -- Get form title
  SELECT title INTO v_form_title 
  FROM public.forms 
  WHERE id = p_form_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'form_not_found';
  END IF;
  
  -- Generate abbreviation
  v_abbr := public.generate_form_abbreviation(v_form_title);
  
  -- Get short form ID (first 8 chars of UUID)
  v_form_id_short := left(p_form_id::text, 8);
  
  -- Get and increment sequence for this form (atomic, race-safe)
  INSERT INTO public.form_submission_sequences (form_id, current_value)
  VALUES (p_form_id, 1)
  ON CONFLICT (form_id) DO UPDATE 
    SET current_value = form_submission_sequences.current_value + 1,
        updated_at = now()
  RETURNING current_value INTO v_sequence;
  
  -- Format: ABBR-formIdShort-sequence
  -- Example: NXG-1a166cde-00001
  RETURN v_abbr || '-' || v_form_id_short || '-' || lpad(v_sequence::text, 5, '0');
END;
$$;

-- ─── 4. Update the trigger to use per-form reference IDs ────────
CREATE OR REPLACE FUNCTION public.assign_reference_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use the new per-form reference ID function
  NEW.reference_id := public.next_form_reference_id(NEW.form_id);
  RETURN NEW;
END;
$$;

-- Trigger already exists, just need to ensure it's active
DROP TRIGGER IF EXISTS before_submission_insert ON public.submissions;
CREATE TRIGGER before_submission_insert
  BEFORE INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.assign_reference_id();

-- ─── 5. Grant permissions ────────────────────────────────────────
GRANT SELECT ON public.form_submission_sequences TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_form_abbreviation(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.next_form_reference_id(uuid) TO authenticated;

-- ─── 6. Initialize sequences for existing forms ──────────────────
-- Optional: Create initial sequence entries for existing forms
INSERT INTO public.form_submission_sequences (form_id, current_value)
SELECT id, 0 
FROM public.forms
WHERE deleted_at IS NULL
ON CONFLICT (form_id) DO NOTHING;

-- ───VERIFICATION QUERIES ─────────────────────────────────────────
-- Test abbreviation generation:
-- SELECT title, generate_form_abbreviation(title) as abbr FROM forms;

-- Test reference ID generation (will actually increment sequence):
-- SELECT next_form_reference_id('<form-id-here>'::uuid);

-- View current sequences:
-- SELECT f.title, f.id, fss.current_value
-- FROM forms f
-- LEFT JOIN form_submission_sequences fss ON fss.form_id = f.id
-- ORDER BY f.created_at;

COMMENT ON TABLE public.form_submission_sequences IS 'Per-form submission reference ID sequences';
COMMENT ON FUNCTION public.generate_form_abbreviation(text) IS 'Generates 2-5 letter abbreviation from form title';
COMMENT ON FUNCTION public.next_form_reference_id(uuid) IS 'Generates next reference ID for a specific form: ABBR-formIdShort-sequence';
