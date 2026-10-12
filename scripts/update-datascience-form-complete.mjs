#!/usr/bin/env node
/**
 * Script to update Data Science Workshop form with complete detailed questions
 * Run: node scripts/update-datascience-form-complete.mjs
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

async function updateDataScienceForm() {
  console.log('🎓 Updating DataScience Nexus: Building with AI - Complete Form...\n');

  try {
    // Step 1: Find the existing form
    console.log('🔍 Finding existing Data Science Workshop form...');
    const { data: forms, error: formError } = await supabase
      .from('forms')
      .select('id, title, slug')
      .eq('slug', 'data-science-workshop-registration')
      .single();

    if (formError || !forms) {
      throw new Error('Data Science Workshop form not found. Please create it first.');
    }

    console.log(`✅ Found form: "${forms.title}" (ID: ${forms.id})\n`);

    // Step 2: Update form details
    console.log('📝 Updating form details...');
    const { error: updateFormError } = await supabase
      .from('forms')
      .update({
        title: 'DataScience Nexus: Building with AI',
        description: 'Participant Registration Form — InnoTech Hub. Hands-On Workshop by Snehith Allamraju on 14 October 2026, 10:00 AM – 4:00 PM at St. Peter\'s Engineering College, Hyderabad. Theme: Practical Applications of AI in Data Science.',
        confirmation_title: 'Thank You for Registering — DataScience Nexus! 🚀',
        confirmation_message: 'Your registration for *DataScience Nexus: Building with AI* has been received successfully.\n\n📅 **Date:** 14 October 2026\n⏰ **Time:** 10:00 AM – 4:00 PM\n📍 **Venue:** St. Peter\'s Engineering College, Hyderabad\n\nPlease bring your laptop if available and stay updated through your registered email and WhatsApp number for workshop instructions and technical prerequisites.\n\n**Learn. Experiment. Build with AI.**\n\n*Team InnoTech Hub*'
      })
      .eq('id', forms.id);

    if (updateFormError) throw new Error(`Failed to update form: ${updateFormError.message}`);
    console.log('✅ Form details updated\n');

    // Step 3: Clear existing questions
    console.log('🗑️  Removing existing questions...');
    const { error: deleteError } = await supabase
      .from('form_questions')
      .delete()
      .eq('form_id', forms.id);

    if (deleteError) throw new Error(`Failed to delete existing questions: ${deleteError.message}`);
    console.log('✅ Existing questions cleared\n');

    // Step 4: Get section ID
    console.log('📋 Finding form section...');
    const { data: sections, error: sectionError } = await supabase
      .from('form_sections')
      .select('id, title')
      .eq('form_id', forms.id)
      .limit(1);

    if (sectionError || !sections || sections.length === 0) {
      throw new Error('No section found in the form.');
    }

    const section = sections[0];
    console.log(`✅ Using section: "${section.title}" (ID: ${section.id})\n`);

    // Step 5: Create all questions
    console.log('❓ Creating detailed questions...\n');
    
    const questions = [
      // Section 1: Participant Details
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
            { value: 'btech', label: 'B.Tech' },
            { value: 'be', label: 'B.E.' },
            { value: 'bsc', label: 'B.Sc' },
            { value: 'bca', label: 'BCA' },
            { value: 'mtech', label: 'M.Tech' },
            { value: 'me', label: 'M.E.' },
            { value: 'msc', label: 'M.Sc' },
            { value: 'mca', label: 'MCA' },
            { value: 'phd', label: 'PhD' },
            { value: 'other', label: 'Other' }
          ]
        }
      },

      // Section 2: Technical Requirements
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

      // Section 3: Workshop Participation
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
          maxLength: 1000
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
      },

      // Section 4: Registration Declaration
      {
        type: 'consent',
        label: 'Registration Declaration',
        required: true,
        config: {
          consentText: 'I confirm that the information provided is accurate and agree to participate in *DataScience Nexus: Building with AI* on 14 October 2026. I understand that this is a hands-on workshop and agree to follow the instructions, technical requirements, and event guidelines communicated by InnoTech Hub.'
        }
      },

      // Section 5: Payment
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

    let successCount = 0;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const { error: qError } = await supabase
        .from('form_questions')
        .insert({
          form_id: forms.id,
          section_id: section.id,
          type: q.type,
          label: q.label,
          required: q.required,
          config: q.config
        });

      if (qError) {
        console.error(`   ❌ Failed to create "${q.label}": ${qError.message}`);
      } else {
        successCount++;
        const extra = q.type === 'payment' ? ' - ₹80.00' : 
                     q.type === 'dropdown' ? ` (${q.config.options?.length || 0} options)` : 
                     q.type === 'consent' ? ' (Declaration)' : '';
        console.log(`   ✅ ${q.label} (${q.type}${extra})`);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ DataScience Nexus form updated successfully!\n');
    console.log('📋 Form Details:');
    console.log('   Title: DataScience Nexus: Building with AI');
    console.log('   Event: Hands-On Workshop by Snehith Allamraju');
    console.log('   Date: 14 October 2026, 10:00 AM – 4:00 PM');
    console.log('   Venue: St. Peter\'s Engineering College, Hyderabad');
    console.log('   Organizer: InnoTech Hub');
    console.log('   Questions Created:', `${successCount}/${questions.length}`);
    console.log('   Payment: ₹80.00 (Production Razorpay)');
    console.log('\n🔗 Links:');
    console.log('   Public Form:', `https://ithforms.innotechhub.in/forms/${forms.slug}`);
    console.log('   Edit Form:', `https://ithforms.innotechhub.in/_admin/forms/${forms.id}/edit`);
    console.log('   Admin Dashboard:', 'https://ithforms.innotechhub.in/_admin/dashboard');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('💡 Key Features Included:');
    console.log('   • Complete participant details collection');
    console.log('   • Technical requirements assessment');
    console.log('   • Workshop participation expectations');
    console.log('   • Registration declaration with consent');
    console.log('   • ₹80 payment integration with production Razorpay');
    console.log('   • Custom confirmation message with event details');
    console.log('   • Google login required for registration\n');

    return forms;

  } catch (error) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Error:', error.message);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(1);
  }
}

updateDataScienceForm();