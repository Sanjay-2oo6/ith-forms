#!/usr/bin/env node
/**
 * Script to create "AI Essentials – Expert Talk" registration form
 * Run: node scripts/create-ai-essentials-form.mjs
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
  console.log('🚀 Creating AI Essentials – Expert Talk registration form...\n');

  try {
    // Generate a unique slug
    const slug = 'ai-essentials-expert-talk';
    
    // Step 1: Create the form
    const { data: form, error: formError } = await supabase
      .from('forms')
      .insert({
        title: 'AI Essentials – Expert Talk Registration',
        slug: slug,
        description: `AI Essentials – Expert Talk
Organized by InnoTech Hub

Join us for an interactive expert session exploring Artificial Intelligence, Generative AI, Prompt Engineering, AI tools, real-world applications, responsible AI, and emerging opportunities in the AI ecosystem.

No prior AI or programming knowledge is required.

📅 Date: [Date]
🕐 Time: [Time]
📍 Venue: [Venue]

Please fill in the details below to register for the session.`,
        status: 'draft',
        allow_anonymous: false,
        confirmation_title: 'Registration Successful!',
        confirmation_message: 'Thank you for registering for the AI Essentials – Expert Talk. We look forward to seeing you at the event!',
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

    // Step 2: Create a section
    const { data: section, error: sectionError } = await supabase
      .from('form_sections')
      .insert({
        form_id: form.id,
        title: 'Registration Details',
        description: null,
        position: 1,
      })
      .select()
      .single();

    if (sectionError) throw sectionError;

    console.log('✅ Section created:', section.title, '\n');

    // Step 3: Create questions
    const questions = [
      {
        section_id: section.id,
        type: 'short_text',
        label: 'Full Name',
        description: null,
        placeholder: 'Enter your full name',
        required: true,
        options: [],
        config: null,
        position: 1,
      },
      {
        section_id: section.id,
        type: 'email',
        label: 'Email Address',
        description: null,
        placeholder: 'your.email@example.com',
        required: true,
        options: [],
        config: null,
        position: 2,
      },
      {
        section_id: section.id,
        type: 'phone',
        label: 'Phone Number',
        description: null,
        placeholder: '+91 XXXXX XXXXX',
        required: true,
        options: [],
        config: null,
        position: 3,
      },
      {
        section_id: section.id,
        type: 'short_text',
        label: 'College / Institution Name',
        description: null,
        placeholder: 'Enter your college or institution name',
        required: true,
        options: [],
        config: null,
        position: 4,
      },
      {
        section_id: section.id,
        type: 'dropdown',
        label: 'Branch / Course',
        description: null,
        placeholder: 'Select your branch',
        required: true,
        options: [
          { label: 'CSE', value: 'cse' },
          { label: 'CSE (AI & ML)', value: 'cse_ai_ml' },
          { label: 'CSE (Data Science)', value: 'cse_ds' },
          { label: 'CSE (Cyber Security)', value: 'cse_cyber' },
          { label: 'ECE', value: 'ece' },
          { label: 'EEE', value: 'eee' },
          { label: 'Mechanical', value: 'mechanical' },
          { label: 'Civil', value: 'civil' },
          { label: 'IT', value: 'it' },
          { label: 'BCA', value: 'bca' },
          { label: 'MCA', value: 'mca' },
          { label: 'Other', value: 'other' },
        ],
        config: null,
        position: 5,
      },
      {
        section_id: section.id,
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
        position: 6,
      },
      {
        section_id: section.id,
        type: 'radio',
        label: 'How familiar are you with AI?',
        description: null,
        placeholder: null,
        required: true,
        options: [
          { label: 'Beginner', value: 'beginner' },
          { label: 'Basic Understanding', value: 'basic' },
          { label: 'Intermediate', value: 'intermediate' },
          { label: 'Advanced', value: 'advanced' },
        ],
        config: null,
        position: 7,
      },
      {
        section_id: section.id,
        type: 'checkbox',
        label: 'What are you most interested in learning?',
        description: 'Select all that apply',
        placeholder: null,
        required: false,
        options: [
          { label: 'Generative AI', value: 'generative_ai' },
          { label: 'Prompt Engineering', value: 'prompt_engineering' },
          { label: 'AI Tools & Productivity', value: 'ai_tools' },
          { label: 'AI for Coding', value: 'ai_coding' },
          { label: 'Real-World AI Applications', value: 'ai_applications' },
          { label: 'Responsible AI', value: 'responsible_ai' },
          { label: 'AI Careers & Future Trends', value: 'ai_careers' },
        ],
        config: null,
        position: 8,
      },
      {
        section_id: section.id,
        type: 'long_text',
        label: 'Do you have any questions for the expert?',
        description: null,
        placeholder: 'Share your questions here...',
        required: false,
        options: [],
        config: null,
        position: 9,
      },
      {
        section_id: section.id,
        type: 'dropdown',
        label: 'How did you hear about this event?',
        description: null,
        placeholder: 'Select an option',
        required: false,
        options: [
          { label: 'Social Media', value: 'social_media' },
          { label: 'College Notice Board', value: 'notice_board' },
          { label: 'Friend/Colleague', value: 'friend' },
          { label: 'Email', value: 'email' },
          { label: 'WhatsApp', value: 'whatsapp' },
          { label: 'Website', value: 'website' },
          { label: 'Other', value: 'other' },
        ],
        config: null,
        position: 10,
      },
    ];

    const { data: insertedQuestions, error: questionsError} = await supabase
      .from('form_questions')
      .insert(questions.map(q => ({ ...q, form_id: form.id })))
      .select();

    if (questionsError) throw questionsError;

    console.log('✅ Questions created:', insertedQuestions.length, 'questions\n');

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Form creation completed successfully!\n');
    console.log('📋 Form Details:');
    console.log('   Title:', form.title);
    console.log('   Status:', form.status, '(draft - ready to publish)');
    console.log('   Slug:', form.slug);
    console.log('   Form ID:', form.id);
    console.log('\n📝 Questions:', insertedQuestions.length);
    console.log('\n🔗 Admin Edit URL:');
    console.log('   https://ithforms.innotechhub.in/admin/forms/' + form.id + '/edit');
    console.log('\n🔗 Public Form URL (after publishing):');
    console.log('   https://ithforms.innotechhub.in/forms/' + form.slug);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('💡 Next steps:');
    console.log('   1. Visit the admin edit URL above');
    console.log('   2. Review and adjust the form as needed');
    console.log('   3. Update [Date], [Time], and [Venue] placeholders');
    console.log('   4. Publish the form when ready\n');

  } catch (error) {
    console.error('❌ Error creating form:', error.message);
    if (error.details) console.error('   Details:', error.details);
    if (error.hint) console.error('   Hint:', error.hint);
    process.exit(1);
  }
}

createForm();
