-- Migration 036: Clean up invalid test submissions without required files
-- These were created by the load test which bypassed file upload validation

-- Count submissions missing required files for job-applications form
WITH job_form AS (
  SELECT id FROM forms WHERE slug = 'job-applications' LIMIT 1
),
missing_files AS (
  SELECT s.id as submission_id
  FROM submissions s
  WHERE s.form_id = (SELECT id FROM job_form)
    AND s.respondent_email LIKE 'load.test.%@test.com'
    AND NOT EXISTS (
      SELECT 1 FROM submission_files sf
      WHERE sf.submission_id = s.id
    )
    AND s.status = 'new'
)
-- Delete the invalid submissions
DELETE FROM submission_answers
WHERE submission_id IN (SELECT submission_id FROM missing_files);

DELETE FROM submissions
WHERE id IN (
  SELECT s.id
  FROM submissions s
  WHERE s.form_id = (SELECT id FROM forms WHERE slug = 'job-applications' LIMIT 1)
    AND s.respondent_email LIKE 'load.test.%@test.com'
    AND NOT EXISTS (
      SELECT 1 FROM submission_files sf
      WHERE sf.submission_id = s.id
    )
    AND s.status = 'new'
);

-- Reset the form response count to match actual valid submissions
UPDATE forms
SET response_count = (
  SELECT COUNT(*)
  FROM submissions
  WHERE form_id = forms.id
)
WHERE slug = 'job-applications';

-- Report what was cleaned
SELECT COUNT(*) as invalid_submissions_removed
FROM submission_answers
WHERE submission_id NOT IN (SELECT id FROM submissions)
LIMIT 1;

SELECT 'Invalid test submissions cleaned up' as status;
