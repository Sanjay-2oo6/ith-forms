#!/usr/bin/env node
/**
 * Script to create "DataScience Nexus: Building with AI" workshop registration form
 * Run: node scripts/create-datascience-nexus-form.mjs
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createForm() {
  console.log('🚀 Creating DataScience Nexus: Building with AI registration form...\n');

  try {
    // Generate a unique slug
    const slug = 'datascience-nexus-building-with-ai';
    
    // Step 1: Create the form
    const { data: form, error: formError } = await supabase
      .from('forms')
      .insert({
        title: 'DataScience Nexus: Building with AI - Workshop Registration',
        slug: slug,
        description: `DataScience Nexus: Building with AI
Hands-On Workshop by Snehith Allamraju
Organized by InnoTech Hub

Explore practical applications of AI in Data Science. Learn hands-on techniques, tools, and real-world use cases.

📅 Date: 14 October 2026
🕐 Time: 10:00 AM – 4:00 PM
📍 Venue: St. Peter's Engineering College, Hyderabad
👨‍🏫 Speaker: Snehith Allamraju
🎯 Theme: Practical Applications of AI in Data Science

Please fill in the details below to register for the workshop.
✨ Bring your laptop if available!`,
        status: 'draft',
        allow_anonymous: false,
        confirmation_title: 'Thank You for Registering — DataScience Nexus! 🚀',
        confirmation_message: `Your registration for DataScience Nexus: Building with AI has been received successfully.

📅 Date: 14 October 2026
⏰ Time: 10:00 AM – 4:00 PM
📍 Venue: St. Peter's Engineering College, Hyderabad

Please bring your laptop if available and stay updated through your registered email and WhatsApp number for workshop instructions and technical prerequisites.

Learn. Experiment. Build with AI.

Team InnoTech Hub`,
        consent_text: null,
        opens_at: null,
        closes_at: null,
        max_responses: null,
        responses_per_email_limit: 1,
      })
      .select()
      .single();

    if (formError) throw formError;

    console.log('✅ Form created:', form.title);
    console.log('   Form ID:', form.id);
    console.log('   Slug:', form.slug, '\n');

    // Step 2: Create sections and questions
    let sectionPosition = 1;
    let questionPosition = 1;

    // SECTION 1: Participant Details
    const { data: section1, error: section1Error } = await supabase
      .from('form_sections')
      .insert({
        form_id: form.id,
        title: 'Participant Details',
        description: null,
        position: sectionPosition++,
      })
      .select()
      .single();

    if (section1Error) throw section1Error;

    const section1Questions = [
      {
        section_id: section1.id,
        type: 'short_text',
        label: 'Full Name',
        description: null,
        placeholder: 'Enter your full name',
        required: true,
        options: [],
        config: null,
        position: questionPosition++,
      },
      {
        section_id: section1.id,
        type: 'email',
        label: 'Email Address',
        description: null,
        placeholder: 'your.email@example.com',
        required: true,
        options: [],
        config: null,
        position: questionPosition++,
      },
      {
        section_id: section1.id,
        type: 'phone',
        label: 'Mobile / WhatsApp Number',
        description: null,
        placeholder: '+91 XXXXX XXXXX',
        required: true,
        options: [],
        config: null,
        position: questionPosition++,
      },
      {
        section_id: section1.id,
        type: 'short_text',
        label: 'College / University Name',
        description: null,
        placeholder: 'Enter your college or university name',
        required: true,
        options: [],
        config: null,
        position: questionPosition++,
      },
      {
        section_id: section1.id,
        type: 'short_text',
        label: 'Roll Number / Student ID',
        description: null,
        placeholder: 'Enter your roll number or student ID',
        required: true,
        options: [],
        config: null,
        position: questionPosition++,
      },
      {
        section_id: section1.id,
        type: 'dropdown',
        label: 'Department / Branch',
        description: null,
        placeholder: 'Select your department',
        required: true,
        options: [
          { label: 'CSE', value: 'cse' },
          { label: 'CSE (AI & ML)', value: 'cse_ai_ml' },
          { label: 'CSE (Data Science)', value: 'cse_ds' },
          { label: 'IT', value: 'it' },
          { label: 'ECE', value: 'ece' },
          { label: 'EEE', value: 'eee' },
          { label: 'Mechanical', value: 'mechanical' },
          { label: 'Civil', value: 'civil' },
          { label: 'Other', value: 'other' },
        ],
        config: null,
        position: questionPosition++,
      },
      {
        section_id: section1.id,
        type: 'dropdown',
        label: 'Year of Study',
        description: null,
        placeholder: 'Select your year',
        required: true,
        options: [
          { label: '1st Year', value: '1st_year' },
          { label: '2nd Year', value: '2nd_year' },
          { label: '3rd Year', value: '3rd_year' },
          { label: '4th Year', value: '4th_year' },
          { label: 'Postgraduate', value: 'postgraduate' },
          { label: 'Other', value: 'other' },
        ],
        config: null,
        position: questionPosition++,
      },
      {
        section_id: section1.id,
        type: 'dropdown',
        label: 'Course / Degree',
        description: null,
        placeholder: 'Select your course',
        required: true,
        options: [
          { label: 'B.Tech', value: 'b_tech' },
          { label: 'B.Tech (Honours)', value: 'b_tech_honours' },
          { label: 'M.Tech', value: 'm_tech' },
          { label: 'BCA', value: 'bca' },
          { label: 'MCA', value: 'mca' },
          { label: 'Diploma', value: 'diploma' },
          { label: 'Other', value: 'other' },
        ],
        config: null,
        position: questionPosition++,
      },
    ];

    // Reset position counter for next section
    questionPosition = 1;

    // SECTION 2: Technical Requirements
    const { data: section2, error: section2Error } = await supabase
      .from('form_sections')
      .insert({
        form_id: form.id,
        title: 'Technical Requirements',
        description: 'Help us understand your technical setup and experience',
        position: sectionPosition++,
      })
      .select()
      .single();

    if (section2Error) throw section2Error;

    const section2Questions = [
      {
        section_id: section2.id,
        type: 'checkbox',
        label: 'Will you bring your own laptop?',
        description: null,
        placeholder: null,
        required: true,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' },
        ],
        config: null,
        position: questionPosition++,
      },
      {
        section_id: section2.id,
        type: 'dropdown',
        label: 'What is your current Python proficiency?',
        description: null,
        placeholder: 'Select your proficiency level',
        required: true,
        options: [
          { label: 'Beginner', value: 'beginner' },
          { label: 'Basic', value: 'basic' },
          { label: 'Intermediate', value: 'intermediate' },
          { label: 'Advanced', value: 'advanced' },
        ],
        config: null,
        position: questionPosition++,
      },
      {
        section_id: section2.id,
        type: 'dropdown',
        label: 'What is your familiarity with Data Science?',
        description: null,
        placeholder: 'Select your familiarity level',
        required: true,
        options: [
          { label: 'Beginner', value: 'beginner' },
          { label: 'Basic', value: 'basic' },
          { label: 'Intermediate', value: 'intermediate' },
          { label: 'Advanced', value: 'advanced' },
        ],
        config: null,
        position: questionPosition++,
      },
      {
        section_id: section2.id,
        type: 'checkbox',
        label: 'Have you previously worked with AI tools?',
        description: null,
        placeholder: null,
        required: true,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' },
        ],
        config: null,
        position: questionPosition++,
      },
      {
        section_id: section2.id,
        type: 'checkbox',
        label: 'Have you used Google Colab or Jupyter Notebook?',
        description: null,
        placeholder: null,
        required: false,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' },
        ],
        config: null,
        position: questionPosition++,
      },
      {
        section_id: section2.id,
        type: 'checkbox',
        label: 'Do you have a Google account for accessing tools, if required?',
        description: null,
        placeholder: null,
        required: false,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' },
        ],
        config: null,
        position: questionPosition++,
      },
    ];

    // Reset position counter for next section
    questionPosition = 1;

    // SECTION 3: Workshop Participation
    const { data: section3, error: section3Error } = await supabase
      .from('form_sections')
      .insert({
        form_id: form.id,
        title: 'Workshop Participation',
        description: 'Tell us about your workshop expectations and availability',
        position: sectionPosition++,
      })
      .select()
      .single();

    if (section3Error) throw section3Error;

    const section3Questions = [
      {
        section_id: section3.id,
        type: 'checkbox',
        label: 'Have you previously attended a hands-on AI/Data Science workshop?',
        description: null,
        placeholder: null,
        required: false,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' },
        ],
        config: null,
        position: questionPosition++,
      },
      {
        section_id: section3.id,
        type: 'long_text',
        label: 'What do you expect to learn from this workshop?',
        description: null,
        placeholder: 'Share your expectations and learning goals...',
        required: false,
        options: [],
        config: null,
        position: questionPosition++,
      },
      {
        section_id: section3.id,
        type: 'checkbox',
        label: 'Will you be available for the complete session (10 AM – 4 PM)?',
        description: null,
        placeholder: null,
        required: true,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' },
        ],
        config: null,
        position: questionPosition++,
      },
      {
        section_id: section3.id,
        type: 'long_text',
        label: 'Do you require any accessibility arrangements?',
        description: 'Please specify if you have any accessibility needs',
        placeholder: 'Describe your accessibility requirements...',
        required: false,
        options: [],
        config: null,
        position: questionPosition++,
      },
    ];

    // Reset position counter for next section
    questionPosition = 1;

    // SECTION 4: Registration Declaration
    const { data: section4, error: section4Error } = await supabase
      .from('form_sections')
      .insert({
        form_id: form.id,
        title: 'Registration Declaration',
        description: null,
        position: sectionPosition++,
      })
      .select()
      .single();

    if (section4Error) throw section4Error;

    const section4Questions = [
      {
        section_id: section4.id,
        type: 'consent',
        label: 'I confirm that the information provided is accurate and agree to participate in DataScience Nexus: Building with AI on 14 October 2026. I understand that this is a hands-on workshop and agree to follow the instructions, technical requirements, and event guidelines communicated by InnoTech Hub.',
        description: null,
        placeholder: null,
        required: true,
        options: [],
        config: null,
        position: questionPosition++,
      },
    ];

    // Combine all questions
    const allQuestions = [
      ...section1Questions.map(q => ({ ...q, form_id: form.id })),
      ...section2Questions.map(q => ({ ...q, form_id: form.id })),
      ...section3Questions.map(q => ({ ...q, form_id: form.id })),
      ...section4Questions.map(q => ({ ...q, form_id: form.id })),
    ];

    const { data: insertedQuestions, error: questionsError } = await supabase
      .from('form_questions')
      .insert(allQuestions)
      .select();

    if (questionsError) throw questionsError;

    console.log('✅ Section 1 created: Participant Details (9 questions)');
    console.log('✅ Section 2 created: Technical Requirements (6 questions)');
    console.log('✅ Section 3 created: Workshop Participation (4 questions)');
    console.log('✅ Section 4 created: Registration Declaration (1 question)');
    console.log('✅ Questions created:', insertedQuestions.length, 'questions total\n');

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Form creation completed successfully!\n');
    console.log('📋 Form Details:');
    console.log('   Title:', form.title);
    console.log('   Status:', form.status, '(draft - ready to publish)');
    console.log('   Slug:', form.slug);
    console.log('   Form ID:', form.id);
    console.log('\n📝 Questions:', insertedQuestions.length);
    console.log('   • Participant Details: 9 questions');
    console.log('   • Technical Requirements: 6 questions');
    console.log('   • Workshop Participation: 4 questions');
    console.log('   • Registration Declaration: 1 question');
    console.log('\n📅 Workshop Details:');
    console.log('   Date: 14 October 2026');
    console.log('   Time: 10:00 AM – 4:00 PM');
    console.log('   Venue: St. Peter\'s Engineering College, Hyderabad');
    console.log('   Speaker: Snehith Allamraju');
    console.log('\n🔗 Admin Edit URL:');
    console.log('   https://ithforms.innotechhub.in/admin/forms/' + form.id + '/edit');
    console.log('\n🔗 Public Form URL (after publishing):');
    console.log('   https://ithforms.innotechhub.in/forms/' + form.slug);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('💡 Next steps:');
    console.log('   1. Visit the admin edit URL above');
    console.log('   2. Review and adjust the form as needed');
    console.log('   3. Publish the form when ready');
    console.log('   4. Share the public form URL with participants\n');

  } catch (error) {
    console.error('❌ Error creating form:', error.message);
    if (error.details) console.error('   Details:', error.details);
    if (error.hint) console.error('   Hint:', error.hint);
    process.exit(1);
  }
}

createForm();
