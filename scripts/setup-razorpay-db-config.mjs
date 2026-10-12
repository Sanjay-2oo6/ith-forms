#!/usr/bin/env node
/**
 * Script to configure Razorpay credentials in database settings
 * This allows the RPC to access vault secrets via current_setting()
 * Run: node scripts/setup-razorpay-db-config.mjs
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

async function setupDbConfig() {
  console.log('🔧 Setting up Razorpay database configuration...\n');

  try {
    // Get the vault secrets first
    const { data: secrets, error: secretsError } = await supabase
      .from('vault.decrypted_secrets')
      .select('name, secret')
      .in('name', ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET']);

    if (secretsError) {
      console.log('⚠️  Could not read vault secrets directly');
      console.log('   This is normal - we\'ll set up the config via SQL instead\n');
    } else if (secrets && secrets.length === 2) {
      console.log('✅ Found vault secrets');
      secrets.forEach(s => {
        console.log(`   ${s.name}: ${s.secret.substring(0, 10)}...`);
      });
      console.log();
    }

    // Set up database-level configuration
    // This SQL needs to be run in the Supabase SQL Editor manually
    const sqlCommands = `
-- Run these SQL commands in Supabase SQL Editor to configure Razorpay:

-- Option 1: Using vault secrets (recommended for production)
ALTER DATABASE postgres SET app.settings.razorpay_key_id = 'rzp_test_TmxUQmgqUvYKG5';
ALTER DATABASE postgres SET app.settings.razorpay_key_secret = '5GMbMY7Hndt1Jwz6PUFl8TVd';

-- Option 2: Or retrieve from vault (if vault access is configured):
-- SELECT vault.get_secret('RAZORPAY_KEY_ID')::text;
-- SELECT vault.get_secret('RAZORPAY_KEY_SECRET')::text;
    `;

    console.log('📝 SQL commands to run in Supabase SQL Editor:\n');
    console.log(sqlCommands);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  IMPORTANT: Manual Setup Required\n');
    console.log('The Razorpay credentials must be configured at the database level.');
    console.log('Follow these steps:\n');
    console.log('1. Go to Supabase Dashboard → SQL Editor');
    console.log('2. Create a NEW query');
    console.log('3. Copy and paste BOTH ALTER DATABASE commands above');
    console.log('4. Click RUN\n');
    console.log('After running, the RPC will be able to access the credentials.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

setupDbConfig();
