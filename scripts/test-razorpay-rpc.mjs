#!/usr/bin/env node
/**
 * Test the create_razorpay_order RPC directly
 * Run: node scripts/test-razorpay-rpc.mjs
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testRpc() {
  console.log('🧪 Testing create_razorpay_order RPC...\n');

  try {
    // Use service role to test (which has auth context)
    // In reality, this would be called from authenticated client
    
    const testFormId = '3c87af3b-3735-4c01-899f-d573868daa78'; // DataScience Nexus form ID
    const testQuestionId = 'b5c0076b-c16e-4c7b-b379-fa0375d5b708'; // Test form question ID
    
    console.log('📋 Test Parameters:');
    console.log('   Form ID:', testFormId);
    console.log('   Question ID:', testQuestionId);
    console.log('   Amount: 5000 paise (₹50.00)');
    console.log('   Currency: INR\n');

    console.log('🚀 Calling create_razorpay_order RPC...\n');

    const { data, error } = await supabase.rpc('create_razorpay_order', {
      p_form_id: testFormId,
      p_question_id: testQuestionId,
      p_amount: 5000,
      p_currency: 'INR',
    });

    if (error) {
      console.error('❌ RPC Error:', error);
      console.error('   Code:', error.code);
      console.error('   Message:', error.message);
      console.error('   Details:', error.details);
      process.exit(1);
    }

    console.log('✅ RPC Response:', JSON.stringify(data, null, 2));

    if (data.ok) {
      console.log('\n✨ Success! Order created:');
      console.log('   Order ID:', data.order_id);
      console.log('   Amount:', data.amount, 'paise');
      console.log('   Currency:', data.currency);
    } else {
      console.log('\n❌ RPC returned ok: false');
      console.log('   Error:', data.error);
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.response) {
      console.error('   HTTP Status:', err.response.status);
      console.error('   Response:', err.response);
    }
    process.exit(1);
  }
}

testRpc();
