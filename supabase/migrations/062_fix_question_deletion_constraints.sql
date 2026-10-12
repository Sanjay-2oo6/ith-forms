-- Migration 062: Fix foreign key constraints to CASCADE on question deletion
-- 
-- Problem: Cannot delete/edit questions that have submissions because the constraints
-- are ON DELETE RESTRICT, which prevents deletion when answers/files exist.
--
-- Solution: Change to ON DELETE CASCADE so that deleting a question also removes
-- its associated answers and files.

-- Fix submission_answers constraint
ALTER TABLE public.submission_answers
  DROP CONSTRAINT IF EXISTS submission_answers_question_id_fkey;

ALTER TABLE public.submission_answers
  ADD CONSTRAINT submission_answers_question_id_fkey
    FOREIGN KEY (question_id)
    REFERENCES public.form_questions(id)
    ON DELETE CASCADE;

-- Fix submission_files constraint
ALTER TABLE public.submission_files
  DROP CONSTRAINT IF EXISTS submission_files_question_id_fkey;

ALTER TABLE public.submission_files
  ADD CONSTRAINT submission_files_question_id_fkey
    FOREIGN KEY (question_id)
    REFERENCES public.form_questions(id)
    ON DELETE CASCADE;

-- Note: This allows form editing even after responses are received.
-- When a question is deleted:
-- 1. All answers to that question are removed from submission_answers
-- 2. All file records for that question are removed from submission_files
-- 3. The actual files in storage remain (manual cleanup may be needed)
