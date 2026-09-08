-- Check table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name='submissions' 
ORDER BY ordinal_position;

-- Check latest submissions
SELECT 
  id,
  reference_id,
  reference_token,
  respondent_email,
  submitted_at,
  status
FROM public.submissions
ORDER BY submitted_at DESC
LIMIT 5;
