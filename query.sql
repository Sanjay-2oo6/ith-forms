-- Check the submission with this reference_id
SELECT 
  id,
  reference_id,
  reference_token,
  form_id,
  respondent_email,
  created_at
FROM public.submissions
WHERE reference_id = 'IHIA2-d58d237b-00008'
LIMIT 1;
