#!/usr/bin/env node
/**
 * Script to create minimal Razorpay payment test form
 * Run: node scripts/create-razorpay-test-form.mjs
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
  console.log('🚀 Creating Razorpay test form...\n');

  try {
    // Generate a unique slug
    const slug = 'razorpay-payment-test';
    
    // Step 1: Create the form
    const { data: form, error: formError } = await supabase
      .from('forms')
      .insert({
        title: 'Razorpay Payment Test Form',
        slug: slug,
        description: `Test Form for Razorpay Payment Integration

This is a minimal form to test the native Razorpay checkout flow.

📝 Instructions:
1. Fill in your name and email
2. Click "Pay Now"
3. Use test card: 4111 1111 1111 1111
4. Any future expiry date and any CVV
5. Complete the payment
6. Submit the form

🎯 Purpose: Verify payment integration works end-to-end`,
        status: 'draft',
        allow_anonymous: false,
        confirmation_title: 'Payment Test Successful! ✅',
        confirmation_message: `Thank you for testing the Razorpay payment integration!

Your payment has been recorded and the form submission was successful.

If you see this message, the integration is working correctly.`,
        consent_text: null,
        opens_at: null,
        closes_at: null,
        max_responses: null,
        responses_per_email_limit: null,
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
        title: 'Payment Information',
        description: 'Enter your details and proceed to payment',
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
        type: 'payment',
        label: 'Test Payment Amount',
        description: 'Click "Pay Now" to proceed with Razorpay checkout',
        placeholder: null,
        required: true,
        options: [],
        config: {
          razorpayAmount: 5000,  // ₹50.00
          razorpayCurrency: 'INR',
          razorpayDescription: 'Test Payment - ₹50.00'
        },
        position: 3,
      },
    ];

    const { data: insertedQuestions, error: questionsError} = await supabase
      .from('form_questions')
      .insert(questions.map(q => ({ ...q, form_id: form.id })))
      .select();

    if (questionsError) throw questionsError;

    console.log('✅ Questions created:', insertedQuestions.length, 'questions\n');

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Test form created successfully!\n');
    console.log('📋 Form Details:');
    console.log('   Title:', form.title);
    console.log('   Status:', form.status, '(ready to publish)');
    console.log('   Slug:', form.slug);
    console.log('   Form ID:', form.id);
    console.log('\n📝 Questions:');
    console.log('   1. Full Name (text)');
    console.log('   2. Email Address (email)');
    console.log('   3. Test Payment Amount (payment - ₹50.00)');
    console.log('\n💳 Payment Details:');
    console.log('   Amount: ₹50.00 (5000 paise)');
    console.log('   Currency: INR');
    console.log('   Mode: Test (no real charges)');
    console.log('\n🔗 Admin Edit URL:');
    console.log('   https://ithforms.innotechhub.in/admin/forms/' + form.id + '/edit');
    console.log('\n🔗 Public Form URL (after publishing):');
    console.log('   https://ithforms.innotechhub.in/forms/' + form.slug);
    console.log('\n🔗 Local Dev URL:');
    console.log('   http://localhost:3000/forms/' + form.slug);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('💡 Test Instructions:');
    console.log('   1. Go to the local dev URL above');
    console.log('   2. Fill in Name and Email');
    console.log('   3. Click "Pay Now" button');
    console.log('   4. In Razorpay modal, enter:');
    console.log('      - Card: 4111 1111 1111 1111');
    console.log('      - Expiry: Any future date (e.g., 12/25)');
    console.log('      - CVV: Any 3 digits (e.g., 123)');
    console.log('   5. Click "Pay"');
    console.log('   6. Should see "Payment Completed ✓"');
    console.log('   7. Submit the form');
    console.log('   8. Check Admin Responses to verify payment recorded\n');

  } catch (error) {
    console.error('❌ Error creating form:', error.message);
    if (error.details) console.error('   Details:', error.details);
    if (error.hint) console.error('   Hint:', error.hint);
    process.exit(1);
  }
}

createForm();
