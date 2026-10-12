-- Add Payment Question to Data Science Workshop Form
-- Run this in Supabase SQL Editor

-- Step 1: Find the Data Science Workshop form
-- (Replace the WHERE clause if the form title is different)
DO $$
DECLARE
  v_form_id UUID;
  v_section_id UUID;
  v_max_order INTEGER;
  v_question_id UUID;
BEGIN
  -- Find the Data Science Workshop form
  SELECT id INTO v_form_id
  FROM forms
  WHERE title ILIKE '%data%science%workshop%'
     OR title ILIKE '%data science%'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_form_id IS NULL THEN
    RAISE EXCEPTION 'Data Science Workshop form not found. Please check the form title.';
  END IF;

  RAISE NOTICE 'Found form ID: %', v_form_id;

  -- Find the first (or only) section
  SELECT id INTO v_section_id
  FROM form_sections
  WHERE form_id = v_form_id
  ORDER BY display_order
  LIMIT 1;

  IF v_section_id IS NULL THEN
    RAISE EXCEPTION 'No section found in the form. Please create a section first.';
  END IF;

  RAISE NOTICE 'Using section ID: %', v_section_id;

  -- Get the max display_order to append the question at the end
  SELECT COALESCE(MAX(display_order), 0) INTO v_max_order
  FROM form_questions
  WHERE section_id = v_section_id;

  RAISE NOTICE 'Current max order: %, new question will be order: %', v_max_order, v_max_order + 1;

  -- Check if a payment question already exists
  SELECT id INTO v_question_id
  FROM form_questions
  WHERE section_id = v_section_id
    AND type = 'payment';

  IF v_question_id IS NOT NULL THEN
    RAISE NOTICE 'Payment question already exists with ID: %. Updating it...', v_question_id;
    
    -- Update existing payment question
    UPDATE form_questions
    SET
      label = 'Workshop Registration Fee',
      config = jsonb_build_object(
        'razorpayAmount', 8000,  -- 80 rupees in paise (80 * 100)
        'currency', 'INR',
        'description', 'Data Science Workshop Registration Fee'
      ),
      required = true,
      updated_at = now()
    WHERE id = v_question_id;

    RAISE NOTICE 'Payment question updated successfully!';
  ELSE
    -- Insert new payment question
    INSERT INTO form_questions (
      form_id,
      section_id,
      type,
      label,
      config,
      required,
      display_order
    ) VALUES (
      v_form_id,
      v_section_id,
      'payment',
      'Workshop Registration Fee',
      jsonb_build_object(
        'razorpayAmount', 8000,  -- 80 rupees in paise (80 * 100)
        'currency', 'INR',
        'description', 'Data Science Workshop Registration Fee'
      ),
      true,  -- Make it required
      v_max_order + 1
    )
    RETURNING id INTO v_question_id;

    RAISE NOTICE 'Payment question created successfully with ID: %', v_question_id;
  END IF;

  -- Show summary
  RAISE NOTICE '================================';
  RAISE NOTICE 'SUMMARY:';
  RAISE NOTICE 'Form ID: %', v_form_id;
  RAISE NOTICE 'Section ID: %', v_section_id;
  RAISE NOTICE 'Payment Question ID: %', v_question_id;
  RAISE NOTICE 'Amount: ₹80.00 (8000 paise)';
  RAISE NOTICE 'Required: Yes';
  RAISE NOTICE '================================';

END $$;

-- Verify the payment question was added
SELECT 
  f.title as form_title,
  fs.title as section_title,
  fq.id as question_id,
  fq.label as question_label,
  fq.type as question_type,
  fq.required,
  fq.config->>'razorpayAmount' as amount_paise,
  fq.config->>'currency' as currency,
  fq.config->>'description' as description,
  fq.display_order
FROM forms f
JOIN form_sections fs ON fs.form_id = f.id
JOIN form_questions fq ON fq.section_id = fs.id
WHERE f.title ILIKE '%data%science%workshop%'
  AND fq.type = 'payment'
ORDER BY f.created_at DESC, fs.display_order, fq.display_order;
