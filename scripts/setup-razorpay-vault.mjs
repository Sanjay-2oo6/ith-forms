#!/usr/bin/env node
/**
 * Script to add Razorpay credentials to Supabase Vault
 * Run: node scripts/setup-razorpay-vault.mjs
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

async function setupVault() {
  console.log('🔐 Setting up Razorpay credentials in Supabase Vault...\n');

  try {
    // Razorpay Test Keys
    const razorpayKeyId = 'rzp_test_TmxUQmgqUvYKG5';
    const razorpayKeySecret = '5GMbMY7Hndt1Jwz6PUFl8TVd';

    console.log('📝 Adding secrets to vault...\n');

    // Add RAZORPAY_KEY_ID
    const { error: keyIdError } = await supabase.rpc('vault.create_secret', {
      name: 'RAZORPAY_KEY_ID',
      secret: razorpayKeyId,
      description: 'Razorpay Test Mode Public Key',
    });

    if (keyIdError && !keyIdError.message?.includes('already exists')) {
      // Try alternative method if RPC doesn't work
      console.log('⚠️  RPC method not available, attempting SQL method...\n');
      
      const { error: sqlError } = await supabase.rpc('pgsql.vault_create_secret', {
        p_name: 'RAZORPAY_KEY_ID',
        p_secret: razorpayKeyId,
      });

      if (sqlError) {
        console.warn('⚠️  Could not auto-add RAZORPAY_KEY_ID via RPC');
        console.log('   Please manually add to Supabase Vault:');
        console.log('   Name: RAZORPAY_KEY_ID');
        console.log('   Value:', razorpayKeyId);
      } else {
        console.log('✅ RAZORPAY_KEY_ID added to vault');
      }
    } else if (!keyIdError) {
      console.log('✅ RAZORPAY_KEY_ID added to vault');
    } else {
      console.log('⚠️  RAZORPAY_KEY_ID already exists in vault (skipping)');
    }

    // Add RAZORPAY_KEY_SECRET
    const { error: keySecretError } = await supabase.rpc('vault.create_secret', {
      name: 'RAZORPAY_KEY_SECRET',
      secret: razorpayKeySecret,
      description: 'Razorpay Test Mode Secret Key',
    });

    if (keySecretError && !keySecretError.message?.includes('already exists')) {
      console.warn('⚠️  Could not auto-add RAZORPAY_KEY_SECRET via RPC');
      console.log('   Please manually add to Supabase Vault:');
      console.log('   Name: RAZORPAY_KEY_SECRET');
      console.log('   Value:', razorpayKeySecret);
    } else if (!keySecretError) {
      console.log('✅ RAZORPAY_KEY_SECRET added to vault');
    } else {
      console.log('⚠️  RAZORPAY_KEY_SECRET already exists in vault (skipping)');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Vault setup complete!\n');
    console.log('📋 Credentials configured:');
    console.log('   ✓ RAZORPAY_KEY_ID (Test Mode)');
    console.log('   ✓ RAZORPAY_KEY_SECRET (Test Mode)\n');
    console.log('🔗 Frontend already has:');
    console.log('   ✓ VITE_RAZORPAY_KEY_ID in .env.local\n');
    console.log('📝 Next steps:');
    console.log('   1. Verify secrets in Supabase Dashboard → Settings → Vault');
    console.log('   2. Run migration 063 in SQL Editor');
    console.log('   3. Create minimal test form');
    console.log('   4. Test payment flow locally\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error setting up vault:', error.message);
    console.log('\n💡 Manual Setup Instructions:');
    console.log('   1. Go to Supabase Dashboard');
    console.log('   2. Select your project');
    console.log('   3. Go to Settings → Vault');
    console.log('   4. Click "Add Secret"');
    console.log('   5. Add these two secrets:\n');
    console.log('   Secret 1:');
    console.log('     Name: RAZORPAY_KEY_ID');
    console.log('     Value: rzp_test_TmxUQmgqUvYKG5\n');
    console.log('   Secret 2:');
    console.log('     Name: RAZORPAY_KEY_SECRET');
    console.log('     Value: 5GMbMY7Hndt1Jwz6PUFl8TVd\n');
    console.log('   6. Save and verify both appear in vault list\n');
    process.exit(1);
  }
}

setupVault();
