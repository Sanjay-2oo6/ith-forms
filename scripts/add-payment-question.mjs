#!/usr/bin/env node
/**
 * Script to add ₹80 payment question to Data Science Workshop form
 * Run: node scripts/add-payment-question.mjs
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

async function addPaymentQuestion() {
  console.log('💳 Adding payment question to Data Science Workshop form...\n');

  try {
    // Step 1: Find the Data Science Workshop form
    console.log('🔍 Finding Data Science Workshop form...');
    const { data: forms, error: formError } = await supabase
      .from('forms')
      .select('id, title, slug')
      .or('title.ilike.%data%science%workshop%,title.ilike.%data science%')
      .order('created_at', { ascending: false })
      .limit(1);

    if (formError) throw new Error(`Failed to find form: ${formError.message}`);
    if (!forms || forms.length === 0) {
      throw new Error('Data Science Workshop form not found. Please create the form first.');
    }

    const form = forms[0];
    console.log(`✅ Found form: "${form.title}" (ID: ${form.id})`);
    console.log(`   Slug: ${form.slug}\n`);

    // Step 2: Find the first section
    console.log('🔍 Finding form section...');
    const { data: sections, error: sectionError } = await supabase
      .from('form_sections')
      .select('id, title')
      .eq('form_id', form.id)
      .limit(1);

    if (sectionError) throw new Error(`Failed to find section: ${sectionError.message}`);
    if (!sections || sections.length === 0) {
      throw new Error('No section found in the form. Please create a section first.');
    }

    const section = sections[0];
    console.log(`✅ Found section: "${section.title}" (ID: ${section.id})\n`);

    // Step 3: Get the max display_order
    console.log('🔍 Checking existing questions...');
    const { data: questions, error: questionsError } = await supabase
      .from('form_questions')
      .select('id, type, label, display_order')
      .eq('section_id', section.id)
      .order('display_order', { ascending: false });

    if (questionsError) throw new Error(`Failed to get questions: ${questionsError.message}`);

    const maxOrder = questions && questions.length > 0 ? questions[0].display_order : 0;
    const existingPayment = questions?.find(q => q.type === 'payment');

    if (existingPayment) {
      console.log(`⚠️  Payment question already exists: "${existingPayment.label}"`);
      console.log(`   Updating it to ₹80.00...\n`);

      // Update existing payment question
      const { error: updateError } = await supabase
        .from('form_questions')
        .update({
          label: 'Workshop Registration Fee',
          config: {
            razorpayAmount: 8000,  // 80 rupees in paise
            currency: 'INR',
            description: 'Data Science Workshop Registration Fee'
          },
          required: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingPayment.id);

      if (updateError) throw new Error(`Failed to update payment question: ${updateError.message}`);

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ Payment question updated successfully!\n');
      console.log('📋 Details:');
      console.log('   Question ID:', existingPayment.id);
      console.log('   Label: Workshop Registration Fee');
      console.log('   Amount: ₹80.00 (8000 paise)');
      console.log('   Currency: INR');
      console.log('   Required: Yes');
      console.log('   Order:', existingPayment.display_order);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } else {
      console.log(`✅ No existing payment question found.`);
      console.log(`   Creating new payment question at position ${maxOrder + 1}...\n`);

      // Insert new payment question
      const { data: newQuestion, error: insertError } = await supabase
        .from('form_questions')
        .insert({
          form_id: form.id,
          section_id: section.id,
          type: 'payment',
          label: 'Workshop Registration Fee',
          config: {
            razorpayAmount: 8000,  // 80 rupees in paise
            currency: 'INR',
            description: 'Data Science Workshop Registration Fee'
          },
          required: true,
          display_order: maxOrder + 1
        })
        .select()
        .single();

      if (insertError) throw new Error(`Failed to create payment question: ${insertError.message}`);

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ Payment question created successfully!\n');
      console.log('📋 Details:');
      console.log('   Question ID:', newQuestion.id);
      console.log('   Label: Workshop Registration Fee');
      console.log('   Amount: ₹80.00 (8000 paise)');
      console.log('   Currency: INR');
      console.log('   Required: Yes');
      console.log('   Order:', newQuestion.display_order);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }

    console.log('🔗 View form: https://ithforms.innotechhub.in/forms/' + form.slug);
    console.log('🔗 Edit form: https://ithforms.innotechhub.in/_admin/forms/' + form.id + '/edit\n');
    console.log('💡 The payment question is now ready to collect ₹80 via Razorpay!\n');

  } catch (error) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Error:', error.message);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(1);
  }
}

addPaymentQuestion();
