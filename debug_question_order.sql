-- Debug: Check the question order returned by RPC
-- Form ID: d58d237b-6330-4e2f-bd02-80d0ae0d94bb

SELECT 
  q.id,
  q.label,
  q.type,
  q.position as q_position,
  sec.id as section_id,
  sec.title as section_title,
  sec.position as sec_position
FROM form_questions q
LEFT JOIN form_sections sec ON sec.id = q.section_id
WHERE q.form_id = 'd58d237b-6330-4e2f-bd02-80d0ae0d94bb'::uuid
ORDER BY sec.position, q.position
LIMIT 25;
