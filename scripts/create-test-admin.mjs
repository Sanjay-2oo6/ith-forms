#!/usr/bin/env node

/**
 * Create Test Admin User
 * 
 * Usage: node scripts/create-test-admin.mjs
 * 
 * This script:
 * 1. Creates an auth user in Supabase
 * 2. Gets the UUID
 * 3. Updates the migration file with the real UUID
 * 4. Prints credentials for login
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: Missing environment variables');
  console.error('   VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY required in .env');
  process.exit(1);
}

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Get this from: Settings > API > Service role key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createTestAdmin() {
  console.log('🚀 Creating test admin user...\n');

  const testEmail = 'admin@test.local';
  const testPassword = 'TestAdmin123!@#';

  try {
    // Create auth user
    console.log(`📝 Creating auth user: ${testEmail}`);
    const { data: user, error: createError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true, // Auto-confirm the email
    });

    if (createError) {
      console.error('❌ Error creating user:', createError.message);
      process.exit(1);
    }

    const userId = user.user.id;
    console.log(`✅ User created with ID: ${userId}\n`);

    // Add to admin_users table
    console.log(`📝 Adding to admin_users table...`);
    const { error: insertError } = await supabase
      .from('admin_users')
      .insert({
        user_id: userId,
        email: testEmail,
        display_name: 'Test Admin',
        is_active: true,
      });

    if (insertError) {
      console.error('❌ Error adding to admin_users:', insertError.message);
      process.exit(1);
    }

    console.log(`✅ Admin record created\n`);

    // Update migration file with real UUID
    console.log(`📝 Updating migration file with real UUID...`);
    const migrationPath = path.join(__dirname, '../supabase/migrations/004_create_test_admin.sql');
    let migrationContent = fs.readFileSync(migrationPath, 'utf-8');
    
    migrationContent = migrationContent.replace(
      "'a0000000-0000-0000-0000-000000000001'",
      `'${userId}'`
    );
    
    fs.writeFileSync(migrationPath, migrationContent);
    console.log(`✅ Migration file updated\n`);

    // Print summary
    console.log('═'.repeat(60));
    console.log('🎉 Test Admin Account Created Successfully!\n');
    console.log('📋 Login Credentials:');
    console.log(`   Email:    ${testEmail}`);
    console.log(`   Password: ${testPassword}\n`);
    console.log('🔑 User ID (for records):');
    console.log(`   ${userId}\n`);
    console.log('⚠️  IMPORTANT:');
    console.log('   • Change these credentials before production deployment');
    console.log('   • Do NOT commit credentials to version control');
    console.log('   • Use strong passwords in production\n');
    console.log('🚀 Next Steps:');
    console.log('   1. Run: npm install');
    console.log('   2. Run: npm run dev');
    console.log('   3. Go to http://localhost:3000');
    console.log('   4. Click Login and use credentials above');
    console.log('═'.repeat(60));

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

createTestAdmin();
