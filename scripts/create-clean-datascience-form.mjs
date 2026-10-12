#!/usr/bin/env node
/**
 * Script to create clean DataScience Nexus form (WITHOUT payment)
 * Run: node scripts/create-clean-datascience-form.mjs
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
  console.error('   Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create admin client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Helper function to create questions for a form
async function createQuestions(formId, sectionId, questions, supabase) {
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const { error: qError } = await supabase
      .from('form_questions')
      .insert({
        form_id: formId,
        section_id: sectionId,
        type: q.type,
        label: q.label,
        required: q.required,
        config: q.config || {},
        position: i + 1
      });

    if (qError) {
      console.error(`   ❌ Failed to create "${q.label}": ${qError.message}`);
    } else {
      const extra = q.type === 'dropdown' ? ` (${q.config.options?.length || 0} options)` : 
                   q.type === 'consent' ? ' (Checkbox)' : 
                   q.type === 'long_text' ? ' (Paragraph)' :
                   q.type === 'yes_no' ? ' (Yes/No)' : '';
      console.log(`   ✅ ${q.label} (${q.type}${extra})`);
    }
  }
  console.log('');
}

async function createCleanDataScienceForm() {
  console.log('🧹 Creating Clean DataScience Nexus: Building with AI Form...\n');

  try {
    // Step 1: Delete ALL existing DataScience forms
    console.log('🗑️  Deleting existing DataScience forms...');
    const { data: existingForms } = await supabase
      .from('forms')
      .select('id, title, slug')
      .or('slug.eq.datascience-nexus-building-with-ai,title.ilike.%datascience%,title.ilike.%DataScience%');

    if (existingForms && existingForms.length > 0) {
      console.log(`   Found ${existingForms.length} existing form(s) to delete:`);
      for (const form of existingForms) {
        console.log(`   - ${form.title} (${form.slug})`);
      }
      
      const formIds = existingForms.map(f => f.id);
      const { error: deleteError } = await supabase
        .from('forms')
        .delete()
        .in('id', formIds);
      
      if (deleteError) {
        console.warn('   Warning: Could not delete some forms:', deleteError.message);
      } else {
        console.log('   ✅ All existing DataScience forms deleted');
      }
    } else {
      console.log('   No existing forms found to delete');
    }
    console.log('');

    // Step 2: Create the main form
    console.log('📝 Creating form: DataScience Nexus: Building with AI...');
    const { data: form, error: formError } = await supabase
      .from('forms')
      .insert({
        title: 'DataScience Nexus: Building with AI',
        slug: 'datascience-nexus-2026',
        description: 'Participant Registration Form — InnoTech Hub\n\nHands-On Workshop by Snehith Allamraju\n📅 14 October 2026 | ⏰ 10:00 AM – 4:00 PM\n📍 St. Peter\'s Engineering College, Hyderabad\n\n🎯 Theme: Practical Applications of AI in Data Science',
        status: 'published',
        allow_anonymous: false, // Require Google login
        confirmation_title: 'Thank You for Registering — DataScience Nexus! 🚀',
        confirmation_message: 'Your registration for *DataScience Nexus: Building with AI* has been received successfully.\n\n📅 **Date:** 14 October 2026\n⏰ **Time:** 10:00 AM – 4:00 PM\n📍 **Venue:** St. Peter\'s Engineering College, Hyderabad\n\nPlease bring your laptop if available and stay updated through your registered email and WhatsApp number for workshop instructions and technical prerequisites.\n\n**Learn. Experiment. Build with AI.**\n\n*Team InnoTech Hub*'
      })
      .select()
      .single();

    if (formError) throw new Error(`Failed to create form: ${formError.message}`);
    console.log(`✅ Form created: "${form.title}" (ID: ${form.id})\n`);

    // Step 2.5: Create a default section (since section_id is required)
    console.log('📋 Creating default form section...');
    const { data: defaultSection, error: sectionError } = await supabase
      .from('form_sections')
      .insert({
        form_id: form.id,
        title: 'Form Questions',
        description: 'Registration form questions',
        position: 1
      })
      .select()
      .single();

    if (sectionError) throw new Error(`Failed to create section: ${sectionError.message}`);
    console.log(`✅ Default section created (ID: ${defaultSection.id})\n`);

    // Step 3: Create all questions
    console.log('❓ Creating form questions...\n');

    // All questions in order as specified
    const allQuestions = [
      // 1. Participant Details
      {
        type: 'name',
        label: 'Full Name',
        required: true,
        config: {}
      },
      {
        type: 'email',
        label: 'Email Address',
        required: true,
        config: {}
      },
      {
        type: 'phone',
        label: 'Mobile / WhatsApp Number',
        required: true,
        config: {}
      },
      {
        type: 'short_text',
        label: 'College / University Name',
        required: true,
        config: {}
      },
      {
        type: 'short_text',
        label: 'Roll Number / Student ID',
        required: true,
        config: {}
      },
      {
        type: 'dropdown',
        label: 'Department / Branch',
        required: true,
        config: {
          options: [
            { value: 'cse', label: 'CSE' },
            { value: 'cse_ai_ml', label: 'CSE (AI & ML)' },
            { value: 'cse_data_science', label: 'CSE (Data Science)' },
            { value: 'it', label: 'IT' },
            { value: 'ece', label: 'ECE' },
            { value: 'eee', label: 'EEE' },
            { value: 'mechanical', label: 'Mechanical' },
            { value: 'civil', label: 'Civil' },
            { value: 'other', label: 'Other' }
          ]
        }
      },
      {
        type: 'dropdown',
        label: 'Year of Study',
        required: true,
        config: {
          options: [
            { value: 'first_year', label: '1st Year' },
            { value: 'second_year', label: '2nd Year' },
            { value: 'third_year', label: '3rd Year' },
            { value: 'fourth_year', label: '4th Year' },
            { value: 'postgraduate', label: 'Postgraduate' },
            { value: 'other', label: 'Other' }
          ]
        }
      },
      {
        type: 'dropdown',
        label: 'Course / Degree',
        required: true,
        config: {
          options: [
            { value: 'btech', label: 'B.Tech (Bachelor of Technology)' },
            { value: 'be', label: 'B.E. (Bachelor of Engineering)' },
            { value: 'bsc', label: 'B.Sc (Bachelor of Science)' },
            { value: 'bca', label: 'BCA (Bachelor of Computer Applications)' },
            { value: 'mtech', label: 'M.Tech (Master of Technology)' },
            { value: 'me', label: 'M.E. (Master of Engineering)' },
            { value: 'msc', label: 'M.Sc (Master of Science)' },
            { value: 'mca', label: 'MCA (Master of Computer Applications)' },
            { value: 'phd', label: 'PhD (Doctor of Philosophy)' },
            { value: 'other', label: 'Other' }
          ]
        }
      },
      
      // 2. Technical Requirements
      {
        type: 'yes_no',
        label: 'Will you bring your own laptop?',
        required: true,
        config: {}
      },
      {
        type: 'dropdown',
        label: 'What is your current Python proficiency?',
        required: true,
        config: {
          options: [
            { value: 'beginner', label: 'Beginner' },
            { value: 'basic', label: 'Basic' },
            { value: 'intermediate', label: 'Intermediate' },
            { value: 'advanced', label: 'Advanced' }
          ]
        }
      },
      {
        type: 'dropdown',
        label: 'What is your familiarity with Data Science?',
        required: true,
        config: {
          options: [
            { value: 'beginner', label: 'Beginner' },
            { value: 'basic', label: 'Basic' },
            { value: 'intermediate', label: 'Intermediate' },
            { value: 'advanced', label: 'Advanced' }
          ]
        }
      },
      {
        type: 'yes_no',
        label: 'Have you previously worked with AI tools?',
        required: true,
        config: {}
      },
      {
        type: 'yes_no',
        label: 'Have you used Google Colab or Jupyter Notebook?',
        required: false,
        config: {}
      },
      {
        type: 'yes_no',
        label: 'Do you have a Google account for accessing tools, if required?',
        required: false,
        config: {}
      },

      // 3. Workshop Participation
      {
        type: 'yes_no',
        label: 'Have you previously attended a hands-on AI/Data Science workshop?',
        required: false,
        config: {}
      },
      {
        type: 'long_text',
        label: 'What do you expect to learn from this workshop?',
        required: false,
        config: {}
      },
      {
        type: 'yes_no',
        label: 'Will you be available for the complete session (10 AM – 4 PM)?',
        required: true,
        config: {}
      },
      {
        type: 'long_text',
        label: 'Do you require any accessibility arrangements?',
        required: false,
        config: {}
      },

      // 4. Registration Declaration
      {
        type: 'consent',
        label: 'Registration Declaration',
        required: true,
        config: {
          consentText: 'I confirm that the information provided is accurate and agree to participate in *DataScience Nexus: Building with AI* on 14 October 2026. I understand that this is a hands-on workshop and agree to follow the instructions, technical requirements, and event guidelines communicated by InnoTech Hub.'
        }
      }
    ];

    console.log('📋 Participant Details:');
    await createQuestions(form.id, defaultSection.id, allQuestions.slice(0, 8), supabase);

    console.log('💻 Technical Requirements:');
    await createQuestions(form.id, defaultSection.id, allQuestions.slice(8, 14), supabase);

    console.log('🎯 Workshop Participation:');
    await createQuestions(form.id, defaultSection.id, allQuestions.slice(14, 18), supabase);

    console.log('📝 Registration Declaration:');
    await createQuestions(form.id, defaultSection.id, allQuestions.slice(18, 19), supabase);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ DataScience Nexus form created successfully!\n');
    console.log('📋 Event Details:');
    console.log('   🎓 Event: DataScience Nexus: Building with AI');
    console.log('   👨‍🏫 Speaker: Snehith Allamraju');
    console.log('   📅 Date: 14 October 2026');
    console.log('   ⏰ Time: 10:00 AM – 4:00 PM');
    console.log('   📍 Venue: St. Peter\'s Engineering College, Hyderabad');
    console.log('   🏢 Organizer: InnoTech Hub');
    console.log('   🎯 Theme: Practical Applications of AI in Data Science');
    console.log('\n📊 Form Structure:');
    console.log('   📝 Participant Details: 8 questions');
    console.log('   💻 Technical Requirements: 6 questions');
    console.log('   🎯 Workshop Participation: 4 questions');
    console.log('   📋 Registration Declaration: 1 question');
    console.log('   📋 Total: 19 questions (NO PAYMENT)');
    console.log('\n🔗 Links:');
    console.log('   Public Form:', `https://ithforms.innotechhub.in/forms/${form.slug}`);
    console.log('   Edit Form:', `https://ithforms.innotechhub.in/_admin/forms/${form.id}/edit`);
    console.log('   Admin Dashboard:', 'https://ithforms.innotechhub.in/_admin/dashboard');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🎉 Key Features:');
    console.log('   ✅ Clean, organized form structure');
    console.log('   ✅ Comprehensive dropdown options');
    console.log('   ✅ Department: 9 options (CSE, AI&ML, Data Science, etc.)');
    console.log('   ✅ Year of Study: 6 options (1st-4th Year, Postgraduate)');
    console.log('   ✅ Course/Degree: 10 options (B.Tech, M.Tech, PhD, etc.)');
    console.log('   ✅ Python & Data Science proficiency levels');
    console.log('   ✅ Technical requirements assessment');
    console.log('   ✅ Workshop expectations and availability');
    console.log('   ✅ Registration declaration with consent');
    console.log('   ✅ Google login required');
    console.log('   ✅ Custom event-specific thank you message');
    console.log('   ✅ NO PAYMENT (as requested)');
    console.log('');

    return form;

  } catch (error) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Error:', error.message);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(1);
  }
}

createCleanDataScienceForm();