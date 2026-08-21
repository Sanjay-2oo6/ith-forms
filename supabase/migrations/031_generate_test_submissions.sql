-- Migration 031: Generate 50 test submissions for job-applications form
-- This creates test data for the job-applications form to verify the system works

DO $$
DECLARE
  v_form_id uuid;
  v_section_id uuid;
  v_questions uuid[] := ARRAY[]::uuid[];
  v_question_record RECORD;
  v_sub_id uuid;
  v_ref_id text;
  v_token text;
  v_name text;
  v_email text;
  v_count int := 0;
  
  -- Test data
  v_first_names text[] := ARRAY[
    'John', 'Jane', 'Michael', 'Sarah', 'David', 'Emma', 'Robert', 'Lisa', 'James', 'Maria',
    'William', 'Jennifer', 'Richard', 'Linda', 'Joseph', 'Patricia', 'Thomas', 'Barbara', 'Charles', 'Susan',
    'Christopher', 'Jessica', 'Daniel', 'Nancy', 'Matthew', 'Karen', 'Anthony', 'Anna', 'Donald', 'Betty',
    'Mark', 'Margaret', 'Steven', 'Sandra', 'Paul', 'Ashley', 'Andrew', 'Kimberly', 'Joshua', 'Donna',
    'Kenneth', 'Carol', 'Kevin', 'Michelle', 'Brian', 'Dorothy', 'George', 'Melissa', 'Edward', 'Deborah'
  ];
  
  v_last_names text[] := ARRAY[
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
    'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
    'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
    'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Peterson', 'Phillips', 'Campbell', 'Parker',
    'Evans', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers'
  ];
  
  v_fit_reasons text[] := ARRAY[
    'I have strong technical skills and passion for development',
    'My experience aligns perfectly with the role requirements',
    'I am committed to continuous learning and growth',
    'I bring innovation and problem-solving skills',
    'My background demonstrates leadership and collaboration',
    'I have proven expertise in this field',
    'I am eager to contribute to your team',
    'My skills match your company culture',
    'I have successful track record in similar roles',
    'I am motivated by challenging projects'
  ];
  
  v_experience_levels int[] := ARRAY[0, 1, 2, 3, 5, 7, 10, 15, 20];
BEGIN
  -- Get the job-applications form ID
  SELECT id INTO v_form_id FROM public.forms WHERE slug = 'job-applications' LIMIT 1;
  
  IF v_form_id IS NULL THEN
    RAISE NOTICE 'Form job-applications not found';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Starting test submission generation for form: %', v_form_id;
  
  -- Get all questions for this form
  FOR v_question_record IN 
    SELECT id, label, type FROM public.form_questions 
    WHERE form_id = v_form_id 
    ORDER BY position
  LOOP
    v_questions := array_append(v_questions, v_question_record.id);
  END LOOP;
  
  RAISE NOTICE 'Found % questions', array_length(v_questions, 1);
  
  -- Generate 50 test submissions
  FOR i IN 1..50 LOOP
    BEGIN
      -- Generate random name and email
      v_name := v_first_names[((i-1) % 50) + 1] || ' ' || v_last_names[((i-1) % 50) + 1];
      v_email := lower(v_first_names[((i-1) % 50) + 1]) || '.' || lower(v_last_names[((i-1) % 50) + 1]) || i || '@test.com';
      
      -- Generate secure token
      v_token := md5(now()::text || random()::text || i::text);
      
      -- Create submission
      INSERT INTO public.submissions (
        form_id,
        reference_token,
        reference_id,
        respondent_name,
        respondent_email,
        status,
        idempotency_key,
        submitted_at
      ) VALUES (
        v_form_id,
        v_token,
        'TEMP_' || i,
        v_name,
        v_email,
        'new',
        gen_random_uuid(),
        now() - interval '1 day' * random()
      )
      RETURNING id INTO v_sub_id;
      
      -- Generate reference ID
      v_ref_id := 'JOB-APP-' || LPAD(i::text, 5, '0');
      
      UPDATE public.submissions SET reference_id = v_ref_id WHERE id = v_sub_id;
      
      -- Insert answers for each question
      FOR j IN 1..array_length(v_questions, 1) LOOP
        INSERT INTO public.submission_answers (
          submission_id,
          form_id,
          question_id,
          value
        ) VALUES (
          v_sub_id,
          v_form_id,
          v_questions[j],
          CASE
            -- Years of Experience
            WHEN j = 1 THEN v_experience_levels[(i % 9) + 1]::text
            -- Why are you a good fit
            WHEN j = 2 THEN v_fit_reasons[(i % 10) + 1]
            -- Resume/CV - skip or put placeholder
            WHEN j = 3 THEN ''
            -- Other text fields
            ELSE 'Test response ' || i || ' for question ' || j
          END
        );
      END LOOP;
      
      v_count := v_count + 1;
      
      IF v_count % 10 = 0 THEN
        RAISE NOTICE 'Created % submissions...', v_count;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error creating submission %: %', i, SQLERRM;
    END;
  END LOOP;
  
  -- Update form response count
  UPDATE public.forms SET response_count = v_count WHERE id = v_form_id;
  
  RAISE NOTICE 'Successfully created % test submissions', v_count;
  
END $$;

-- Verify the submissions were created
SELECT COUNT(*) as total_submissions, 
       COUNT(DISTINCT respondent_email) as unique_respondents,
       MIN(submitted_at) as oldest_submission,
       MAX(submitted_at) as newest_submission
FROM public.submissions 
WHERE form_id = (SELECT id FROM public.forms WHERE slug = 'job-applications');

SELECT 'Test data generation complete!' as status;
