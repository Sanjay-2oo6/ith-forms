#!/usr/bin/env node
/**
 * Script to create Data Science Workshop form with ₹80 payment question
 * Run: node scripts/create-datascience-form.mjs
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

async function createDataScienceForm() {
  console.log('🎓 Creating Data Science Workshop Registration Form...\n');

  try {
    // Step 1: Create the form
    console.log('📝 Creating form...');
    const { data: form, error: formError } = await supabase
      .from('forms')
      .insert({
        title: 'Data Science Workshop - Registration',
        slug: 'data-science-workshop-registration',
        description: 'Register for our comprehensive Data Science workshop. Learn AI, ML, and data analysis with hands-on projects.',
        status: 'published',
        allow_anonymous: false // Require Google login
      })
      .select()
      .single();

    if (formError) {
      if (formError.code === '23505') { // Unique constraint violation
        console.log('⚠️  Form with this slug already exists. Finding it...');
        const { data: existingForm } = await supabase
          .from('forms')
          .select('id, title, slug')
          .eq('slug', 'data-science-workshop-registration')
          .single();
        
        if (existingForm) {
          console.log(`✅ Using existing form: "${existingForm.title}"`);
          console.log(`   ID: ${existingForm.id}\n`);
          return existingForm;
        }
      }
      throw new Error(`Failed to create form: ${formError.message}`);
    }

    console.log(`✅ Form created: "${form.title}"`);
    console.log(`   ID: ${form.id}`);
    console.log(`   Slug: ${form.slug}\n`);

    // Step 2: Create section
    console.log('📋 Creating form section...');
    const { data: section, error: sectionError } = await supabase
      .from('form_sections')
      .insert({
        form_id: form.id,
        title: 'Participant Information'
      })
      .select()
      .single();

    if (sectionError) throw new Error(`Failed to create section: ${sectionError.message}`);
    
    console.log(`✅ Section created: "${section.title}"`);
    console.log(`   ID: ${section.id}\n`);

    // Step 3: Create questions
    console.log('❓ Creating questions...\n');
    
    const questions = [
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
        label: 'Phone Number',
        required: true,
        config: {}
      },
      {
        type: 'dropdown',
        label: 'Educational Background',
        required: true,
        config: {
          options: [
            { value: 'high_school', label: 'High School' },
            { value: 'undergraduate', label: 'Undergraduate' },
            { value: 'graduate', label: 'Graduate' },
            { value: 'postgraduate', label: 'Postgraduate' },
            { value: 'working_professional', label: 'Working Professional' }
          ]
        }
      },
      {
        type: 'radio',
        label: 'Prior Programming Experience',
        required: true,
        config: {
          options: [
            { value: 'none', label: 'None - Complete Beginner' },
            { value: 'basic', label: 'Basic - Some coding knowledge' },
            { value: 'intermediate', label: 'Intermediate - Comfortable with programming' },
            { value: 'advanced', label: 'Advanced - Experienced programmer' }
          ]
        }
      },
      {
        type: 'long_text',
        label: 'Why do you want to attend this workshop?',
        required: true,
        config: {
          minLength: 50,
          maxLength: 500
        }
      },
      {
        type: 'payment',
        label: 'Workshop Registration Fee',
        required: true,
        config: {
          razorpayAmount: 8000, // ₹80.00 in paise
          currency: 'INR',
          description: 'Data Science Workshop Registration Fee (₹80)'
        }
      }
    ];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const { error: qError } = await supabase
        .from('form_questions')
        .insert({
          form_id: form.id,
          section_id: section.id,
          type: q.type,
          label: q.label,
          required: q.required,
          config: q.config
        });

      if (qError) {
        console.error(`❌ Failed to create question "${q.label}":`, qError.message);
      } else {
        console.log(`   ✅ ${q.label} (${q.type}${q.type === 'payment' ? ' - ₹80.00' : ''})`);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Data Science Workshop form created successfully!\n');
    console.log('📋 Form Details:');
    console.log('   Title:', form.title);
    console.log('   ID:', form.id);
    console.log('   Slug:', form.slug);
    console.log('   Questions:', questions.length);
    console.log('   Payment:', '₹80.00 (Razorpay native checkout)');
    console.log('\n🔗 Links:');
    console.log('   Public Form:', `https://ithforms.innotechhub.in/forms/${form.slug}`);
    console.log('   Edit Form:', `https://ithforms.innotechhub.in/_admin/forms/${form.id}/edit`);
    console.log('   Admin Dashboard:', 'https://ithforms.innotechhub.in/_admin/dashboard');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return form;

  } catch (error) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Error:', error.message);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(1);
  }
}

createDataScienceForm();
