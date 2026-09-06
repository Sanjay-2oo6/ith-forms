-- Migration 055: Fix File Path Traversal Vulnerability in register_submission_file
-- Issue: Path validation using string position matching is insufficient
--        Attacker could bypass with crafted paths:
--        - /uuid/../../admin/config.json
--        - /uuid//sensitive.txt
--        - /uuid/file.txt%00.js
--
-- Solution:
-- 1. Strict path normalization: remove .. and . patterns
-- 2. Verify path contains ONLY submission_id/{filename}
-- 3. Deny paths with double slashes, null bytes, special chars
-- 4. Whitelist allowed path separators
-- 5. Validate filename length and characters

-- ─── 1. Create helper function for strict path validation ──────────────────────
DROP FUNCTION IF EXISTS public.validate_submission_file_path(uuid, text) CASCADE;

CREATE OR REPLACE FUNCTION public.validate_submission_file_path(
  p_submission_id uuid,
  p_file_path     text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_expected_prefix text;
  v_path_after_id text;
  v_parts text[];
BEGIN
  -- Null check
  IF p_file_path IS NULL OR p_file_path = '' THEN
    RETURN false;
  END IF;

  -- Build expected prefix: "uuid/"
  v_expected_prefix := p_submission_id::text || '/';

  -- Check if path starts with expected prefix (case-sensitive)
  IF substring(p_file_path, 1, length(v_expected_prefix)) != v_expected_prefix THEN
    RETURN false;
  END IF;

  -- Extract part after the ID
  v_path_after_id := substring(p_file_path, length(v_expected_prefix) + 1);

  -- Deny empty filename
  IF v_path_after_id = '' OR v_path_after_id IS NULL THEN
    RETURN false;
  END IF;

  -- Deny paths with directory separators (no subdirectories allowed)
  -- Only format allowed: uuid/filename
  IF position('/' IN v_path_after_id) > 0 THEN
    RETURN false;
  END IF;

  -- Deny double slashes (already caught above, but explicit for clarity)
  IF position('//' IN p_file_path) > 0 THEN
    RETURN false;
  END IF;

  -- Deny null bytes (can cause truncation)
  IF position(chr(0) IN p_file_path) > 0 THEN
    RETURN false;
  END IF;

  -- Deny parent directory references (..)
  IF position('..' IN p_file_path) > 0 THEN
    RETURN false;
  END IF;

  -- Deny current directory references (.) - but allow in filenames like "file.txt"
  -- Only reject "./" patterns which indicate directory traversal
  IF position('./' IN p_file_path) > 0 THEN
    RETURN false;
  END IF;

  -- Deny paths starting with dot (hidden files)
  IF substring(v_path_after_id, 1, 1) = '.' THEN
    RETURN false;
  END IF;

  -- Deny control characters (ASCII 0-31, 127)
  IF p_file_path ~ '[[:cntrl:]]' THEN
    RETURN false;
  END IF;

  -- Filename length check (255 is typical file system limit)
  IF length(v_path_after_id) > 255 THEN
    RETURN false;
  END IF;

  -- Total path length check
  IF length(p_file_path) > 512 THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_submission_file_path(uuid, text) TO anon, authenticated;

-- ─── 2. UPDATE register_submission_file with strict validation ──────────────────
DROP FUNCTION IF EXISTS public.register_submission_file(uuid, uuid, text, text, bigint, text) CASCADE;

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
  v_form_id   uuid;
  v_question  public.form_questions%ROWTYPE;
  v_max_mb    numeric;
  v_max_bytes bigint;
  v_ext       text;
  v_allowed   boolean;
BEGIN
  -- ─── 1. Verify submission exists and is recent ────────────────────────────
  SELECT s.form_id INTO v_form_id
  FROM public.submissions s
  JOIN public.forms f ON f.id = s.form_id
  WHERE s.id = p_submission_id
    AND f.status = 'published' AND f.deleted_at IS NULL
    AND s.submitted_at > now() - interval '1 hour';
  IF NOT FOUND THEN RAISE EXCEPTION 'submission_not_found'; END IF;

  -- ─── 2. Verify question exists and belongs to form ──────────────────────────
  SELECT * INTO v_question
  FROM public.form_questions
  WHERE id = p_question_id AND form_id = v_form_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_question'; END IF;

  -- ─── 3. STRICT PATH VALIDATION ────────────────────────────────────────────
  -- Use new validation function that prevents path traversal
  IF NOT public.validate_submission_file_path(p_submission_id, p_file_path) THEN
    -- Log attempted traversal
    INSERT INTO public.audit_logs (action, entity, entity_id, metadata)
    VALUES (
      'file_upload_path_traversal_attempt',
      'submission_file',
      p_submission_id::text,
      jsonb_build_object(
        'attempted_path', p_file_path,
        'form_id', v_form_id,
        'timestamp', now()
      )
    );
    RAISE EXCEPTION 'invalid_path';
  END IF;

  -- ─── 4. File size validation ──────────────────────────────────────────────
  v_max_mb := COALESCE((v_question.config->>'maxSizeMB')::numeric, 10);
  v_max_mb := LEAST(50, GREATEST(1, v_max_mb));
  v_max_bytes := (v_max_mb * 1024 * 1024)::bigint;

  IF p_file_size IS NOT NULL AND p_file_size > v_max_bytes THEN
    RAISE EXCEPTION 'file_too_large';
  END IF;

  -- ─── 5. File type validation (extension-based on config) ──────────────────
  IF v_question.config ? 'accept'
     AND jsonb_typeof(v_question.config->'accept') = 'array'
     AND jsonb_array_length(v_question.config->'accept') > 0 THEN
    v_ext := lower(coalesce(substring(p_file_name from '\.[^.]*$'), ''));
    SELECT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(v_question.config->'accept') AS e(val)
      WHERE lower(e.val) = v_ext
    ) INTO v_allowed;
    IF NOT v_allowed THEN RAISE EXCEPTION 'invalid_file_type'; END IF;
  END IF;

  -- ─── 6. Sanitize filename: limit length, remove problematic chars ────────
  -- Store filename with max 300 chars, remove any path separators
  p_file_name := left(replace(replace(p_file_name, '/', '_'), '\', '_'), 300);

  -- ─── 7. Register file in database ─────────────────────────────────────────
  INSERT INTO public.submission_files
    (submission_id, form_id, question_id, file_path, file_name, file_size, mime_type)
  VALUES
    (p_submission_id, v_form_id, p_question_id,
     p_file_path, p_file_name, p_file_size, left(p_mime_type, 100));

EXCEPTION WHEN OTHERS THEN
  -- Re-raise with original exception message
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.register_submission_file(uuid,uuid,text,text,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_submission_file(uuid,uuid,text,text,bigint,text) TO anon, authenticated;

COMMENT ON FUNCTION public.register_submission_file(uuid,uuid,text,text,bigint,text) IS 'Register file metadata with strict path traversal validation. Prevents directory escape attempts and normalizes paths.';

-- ─── 3. Add index for audit log queries ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_logs_file_traversal 
  ON public.audit_logs(action) 
  WHERE action = 'file_upload_path_traversal_attempt';

-- ─── 4. Verification queries ──────────────────────────────────────────────────
SELECT 'Migration 055: File path traversal protection implemented' as status;

-- Test the validation function:
-- SELECT public.validate_submission_file_path(
--   '550e8400-e29b-41d4-a716-446655440000'::uuid,
--   '550e8400-e29b-41d4-a716-446655440000/document.pdf'
-- );  -- Should return true
--
-- SELECT public.validate_submission_file_path(
--   '550e8400-e29b-41d4-a716-446655440000'::uuid,
--   '550e8400-e29b-41d4-a716-446655440000/../../../etc/passwd'
-- );  -- Should return false
--
-- SELECT public.validate_submission_file_path(
--   '550e8400-e29b-41d4-a716-446655440000'::uuid,
--   '550e8400-e29b-41d4-a716-446655440000//double.pdf'
-- );  -- Should return false
