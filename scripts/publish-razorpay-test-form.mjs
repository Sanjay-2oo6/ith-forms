#!/usr/bin/env node
/**
 * Script to publish the Razorpay test form
 * Run: node scripts/publish-razorpay-test-form.mjs
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

async function publishForm() {
  console.log('📢 Publishing Razorpay test form...\n');

  try {
    // Find the form by slug
    const { data: forms, error: findError } = await supabase
      .from('forms')
      .select('id, title, status')
      .eq('slug', 'razorpay-payment-test')
      .single();

    if (findError) {
      console.error('❌ Could not find form:', findError.message);
      process.exit(1);
    }

    if (!forms) {
      console.error('❌ Form not found with slug: razorpay-payment-test');
      process.exit(1);
    }

    console.log('📋 Found form:', forms.title);
    console.log('   Status:', forms.status);
    console.log('   Form ID:', forms.id, '\n');

    // Update status to published
    const { error: updateError } = await supabase
      .from('forms')
      .update({ status: 'published' })
      .eq('id', forms.id);

    if (updateError) {
      console.error('❌ Error publishing form:', updateError.message);
      process.exit(1);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Form published successfully!\n');
    console.log('🔗 Public URL:');
    console.log('   http://localhost:3000/forms/razorpay-payment-test\n');
    console.log('💡 Next steps:');
    console.log('   1. Open the link above');
    console.log('   2. Fill in Name and Email');
    console.log('   3. Click "Pay Now"');
    console.log('   4. Test with card: 4111 1111 1111 1111');
    console.log('   5. Submit and verify payment recorded\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

publishForm();
