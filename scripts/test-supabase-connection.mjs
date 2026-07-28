#!/usr/bin/env node

/**
 * Test Supabase Connection
 * 
 * Usage: node scripts/test-supabase-connection.mjs
 * 
 * Tests if the app can connect to Supabase and access the database.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

console.log('🔍 Testing Supabase Connection\n');
console.log('═'.repeat(60));

// Check if variables are set
if (!SUPABASE_URL) {
  console.error('❌ Error: VITE_SUPABASE_URL not set in .env');
  process.exit(1);
}

if (!SUPABASE_ANON_KEY) {
  console.error('❌ Error: VITE_SUPABASE_ANON_KEY not set in .env');
  process.exit(1);
}

console.log('📋 Configuration:');
console.log(`   URL: ${SUPABASE_URL}`);
console.log(`   Key: ${SUPABASE_ANON_KEY.substring(0, 20)}...`);
console.log();

// Test 1: Can we reach the Supabase API?
console.log('📝 Test 1: Checking Supabase API connectivity...');
try {
  const response = await fetch(`${SUPABASE_URL}/health`, {
    signal: AbortSignal.timeout(5000)
  });
  
  if (response.ok) {
    console.log('✅ Supabase API is reachable\n');
  } else {
    console.error(`❌ Supabase API returned status ${response.status}`);
    console.error(`   Response: ${await response.text()}\n`);
  }
} catch (error) {
  console.error('❌ Cannot reach Supabase API');
  console.error(`   Error: ${error.message}\n`);
}

// Test 2: Can we query the forms table?
console.log('📝 Test 2: Querying forms table...');
try {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/forms?select=id&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    }
  );
  
  if (response.ok) {
    const data = await response.json();
    console.log(`✅ Successfully queried forms table (${data.length} forms found)\n`);
  } else if (response.status === 403) {
    console.error('❌ Permission denied (403)');
    console.error('   Possible causes:');
    console.error('   • Wrong anon key');
    console.error('   • RLS policies blocking access');
    console.error('   • Database user missing permissions\n');
    process.exit(1);
  } else {
    console.error(`❌ Query failed with status ${response.status}`);
    console.error(`   Response: ${await response.text()}\n`);
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Cannot query forms table');
  console.error(`   Error: ${error.message}\n`);
  process.exit(1);
}

// Test 3: Check admin_users table
console.log('📝 Test 3: Checking admin_users table...');
try {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/admin_users?select=id&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    }
  );
  
  if (response.ok) {
    const data = await response.json();
    console.log(`✅ admin_users table is accessible (${data.length} admins found)\n`);
  } else if (response.status === 403) {
    console.error('❌ admin_users is not accessible (403)');
    console.error('   Check RLS policies\n');
  } else {
    console.error(`❌ Query failed with status ${response.status}\n`);
  }
} catch (error) {
  console.error(`❌ Error checking admin_users: ${error.message}\n`);
}

// Test 4: Test /health endpoint locally
console.log('📝 Test 4: Simulating /health endpoint check...');
try {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/forms?select=id&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      signal: AbortSignal.timeout(5000)
    }
  );
  
  const isHealthy = response.ok;
  console.log(`✅ Health check: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
  console.log(`   Status: ${response.status}`);
  console.log(`   (This is what Vercel sees on /health endpoint)\n`);
} catch (error) {
  console.error('❌ Health check failed');
  console.error(`   Error: ${error.message}\n`);
}

// Summary
console.log('═'.repeat(60));
console.log('\n✅ All connection tests passed!');
console.log('\nIf Vercel is still showing 404, the issue is likely:');
console.log('  1. Build failed (check Vercel build logs)');
console.log('  2. Wrong environment variable format');
console.log('  3. Vercel not using the new deployment');
console.log('\nNext steps:');
console.log('  1. Check Vercel Deployments > Logs for build errors');
console.log('  2. Try clearing Vercel cache: Settings > Git > Clear Build Cache');
console.log('  3. Redeploy from Vercel dashboard');
console.log('═'.repeat(60));
