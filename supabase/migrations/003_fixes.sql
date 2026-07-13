-- Fix 1: Allow submission_files to have null submission_id (for admin exports)
ALTER TABLE public.submission_files ALTER COLUMN submission_id DROP NOT NULL;

-- Fix 2: RLS — ensure admin can SELECT all submissions
-- (if your policy only allows anon INSERT, admin reads will be empty)
-- Drop existing select policy if any, then re-create
DROP POLICY IF EXISTS "admin_select_submissions" ON public.submissions;
CREATE POLICY "admin_select_submissions" ON public.submissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Fix 3: Also allow admin to SELECT submission_files
DROP POLICY IF EXISTS "admin_select_submission_files" ON public.submission_files;
CREATE POLICY "admin_select_submission_files" ON public.submission_files
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Fix 4: Allow admin to INSERT submission_files (for export tracking)
DROP POLICY IF EXISTS "admin_insert_submission_files" ON public.submission_files;
CREATE POLICY "admin_insert_submission_files" ON public.submission_files
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
