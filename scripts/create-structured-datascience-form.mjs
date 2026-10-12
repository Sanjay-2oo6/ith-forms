#!/usr/bin/env node
/**
 * Script to create structured DataScience Nexus form with multiple sections and proper dropdowns
 * Run: node scripts/create-structured-datascience-form.mjs
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

// Helper function to create questions for a section
async function createQuestionsForSection(section, questions, formId, supabase) {
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const { error: qError } = await supabase
      .from('form_questions')
      .insert({
        form_id: formId,
        section_id: section.id,
        type: q.type,
        label: q.label,
        required: q.required,
        config: q.config
      });

    if (qError) {
      console.error(`   ❌ Failed to create "${q.label}": ${qError.message}`);
    } else {
      const extra = q.type === 'payment' ? ' - ₹80.00' : 
                   q.type === 'dropdown' ? ` (${q.config.options?.length || 0} options)` : 
                   q.type === 'consent' ? ' (Declaration)' : 
                   q.type === 'long_text' ? ' (Paragraph)' :
                   q.type === 'yes_no' ? ' (Yes/No)' : '';
      console.log(`   ✅ ${q.label} (${q.type}${extra})`);
    }
  }
  console.log('');
}

async function createStructuredDataScienceForm() {
  console.log('🎓 Creating Structured DataScience Nexus: Building with AI Form...\n');

  try {
    // Step 1: Delete existing form if it exists
    console.log('🗑️  Checking for existing form...');
    const { data: existingForm } = await supabase
      .from('forms')
      .select('id, title')
      .eq('slug', 'datascience-nexus-building-with-ai');

    if (existingForm && existingForm.length > 0) {
      console.log('   Found existing form, deleting...');
      const { error: deleteError } = await supabase
        .from('forms')
        .delete()
        .eq('slug', 'datascience-nexus-building-with-ai');
      
      if (deleteError) console.warn('   Warning: Could not delete existing form');
      else console.log('   ✅ Existing form deleted');
    }

    // Step 2: Create the main form
    console.log('📝 Creating form: DataScience Nexus: Building with AI...');
    const { data: form, error: formError } = await supabase
      .from('forms')
      .insert({
        title: 'DataScience Nexus: Building with AI',
        slug: 'datascience-nexus-building-with-ai',
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

    // Step 3: Create sections
    console.log('📋 Creating form sections...');
    const sections = [
      { title: 'Participant Details', description: 'Basic information about the participant' },
      { title: 'Technical Requirements', description: 'Your technical background and requirements' },
      { title: 'Workshop Participation', description: 'Workshop expectations and availability' },
      { title: 'Registration & Payment', description: 'Declaration and payment for the workshop' }
    ];

    const createdSections = [];
    for (let i = 0; i < sections.length; i++) {
      const { data: section, error: sectionError } = await supabase
        .from('form_sections')
        .insert({
          form_id: form.id,
          title: sections[i].title,
          description: sections[i].description,
          position: i + 1
        })
        .select()
        .single();

      if (sectionError) throw new Error(`Failed to create section "${sections[i].title}": ${sectionError.message}`);
      createdSections.push(section);
      console.log(`   ✅ Section ${i + 1}: ${section.title}`);
    }
    console.log('');

    // Step 4: Create questions for each section
    console.log('❓ Creating questions by section...\n');

    // Section 1: Participant Details
    console.log('📝 Section 1: Participant Details');
    const participantQuestions = [
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
      }
    ];

    await createQuestionsForSection(createdSections[0], participantQuestions, form.id, supabase);

    // Section 2: Technical Requirements
    console.log('💻 Section 2: Technical Requirements');
    const technicalQuestions = [
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
            { value: 'beginner', label: 'Beginner - No prior experience' },
            { value: 'basic', label: 'Basic - Some coding knowledge' },
            { value: 'intermediate', label: 'Intermediate - Comfortable with programming' },
            { value: 'advanced', label: 'Advanced - Experienced with Python' }
          ]
        }
      },
      {
        type: 'dropdown',
        label: 'What is your familiarity with Data Science?',
        required: true,
        config: {
          options: [
            { value: 'beginner', label: 'Beginner - New to Data Science' },
            { value: 'basic', label: 'Basic - Some theoretical knowledge' },
            { value: 'intermediate', label: 'Intermediate - Some hands-on experience' },
            { value: 'advanced', label: 'Advanced - Experienced with Data Science projects' }
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
      }
    ];

    await createQuestionsForSection(createdSections[1], technicalQuestions, form.id, supabase);

    // Section 3: Workshop Participation
    console.log('🎯 Section 3: Workshop Participation');
    const participationQuestions = [
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
        config: {
          maxLength: 1000,
          minLength: 20
        }
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
        config: {
          maxLength: 500
        }
      }
    ];

    await createQuestionsForSection(createdSections[2], participationQuestions, form.id, supabase);

    // Section 4: Registration & Payment
    console.log('💳 Section 4: Registration & Payment');
    const registrationQuestions = [
      {
        type: 'consent',
        label: 'Registration Declaration',
        required: true,
        config: {
          consentText: 'I confirm that the information provided is accurate and agree to participate in *DataScience Nexus: Building with AI* on 14 October 2026. I understand that this is a hands-on workshop and agree to follow the instructions, technical requirements, and event guidelines communicated by InnoTech Hub.'
        }
      },
      {
        type: 'payment',
        label: 'Workshop Registration Fee',
        required: true,
        config: {
          razorpayAmount: 8000, // ₹80.00 in paise
          currency: 'INR',
          description: 'DataScience Nexus: Building with AI - Registration Fee (₹80)'
        }
      }
    ];

    await createQuestionsForSection(createdSections[3], registrationQuestions, form.id, supabase);



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
    console.log('   📝 Section 1: Participant Details (8 questions)');
    console.log('   💻 Section 2: Technical Requirements (6 questions)');
    console.log('   🎯 Section 3: Workshop Participation (4 questions)');
    console.log('   💳 Section 4: Registration & Payment (2 questions)');
    console.log('   📋 Total: 20 questions across 4 sections');
    console.log('   💰 Payment: ₹80.00 (Production Razorpay)');
    console.log('\n🔗 Links:');
    console.log('   Public Form:', `https://ithforms.innotechhub.in/forms/${form.slug}`);
    console.log('   Edit Form:', `https://ithforms.innotechhub.in/_admin/forms/${form.id}/edit`);
    console.log('   Admin Dashboard:', 'https://ithforms.innotechhub.in/_admin/dashboard');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🎉 Key Features:');
    console.log('   ✅ Multi-section organized form');
    console.log('   ✅ Comprehensive dropdown options');
    console.log('   ✅ Department: 9 options (CSE, AI&ML, Data Science, etc.)');
    console.log('   ✅ Year of Study: 6 options (1st-4th Year, Postgraduate)');
    console.log('   ✅ Course/Degree: 10 options (B.Tech, M.Tech, PhD, etc.)');
    console.log('   ✅ Python & Data Science proficiency levels');
    console.log('   ✅ Technical requirements assessment');
    console.log('   ✅ Workshop expectations and availability');
    console.log('   ✅ Registration declaration with consent');
    console.log('   ✅ ₹80 payment integration (Production Razorpay)');
    console.log('   ✅ Google login required');
    console.log('   ✅ Custom event-specific thank you message\n');

    return form;

  } catch (error) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Error:', error.message);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(1);
  }
}

createStructuredDataScienceForm();