-- Test the get_form_responses_tabular RPC to see what it returns
SELECT json_array_length(
  (SELECT public.get_form_responses_tabular('d58d237b-6330-4e2f-bd02-80d0ae0d94bb'::uuid)::json->'questions')
) as question_count;

-- Also show the actual questions returned
SELECT 
  json_array_length((public.get_form_responses_tabular('d58d237b-6330-4e2f-bd02-80d0ae0d94bb'::uuid)::json->'questions')) as total_questions,
  (public.get_form_responses_tabular('d58d237b-6330-4e2f-bd02-80d0ae0d94bb'::uuid)::json->'questions')::text as questions_array;
