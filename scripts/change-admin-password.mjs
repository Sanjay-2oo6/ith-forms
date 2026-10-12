#!/usr/bin/env node
/**
 * Script to change admin user password
 * Run: node scripts/change-admin-password.mjs
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

// Create admin client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function changeAdminPassword() {
  const adminEmail = 'innotechhub.edu@gmail.com';
  const userId = 'd2728dd0-ab98-49a3-8330-9be77fdd3574';
  const newPassword = 'InnoTechHub@2o26';

  console.log('🔐 Changing password for admin account...\n');
  console.log('   Email:', adminEmail);
  console.log('   User ID:', userId);
  console.log('   New Password:', newPassword);
  console.log('');

  try {
    console.log('🔄 Updating password...');

    // Update the user's password using the Admin API
    console.log('🔄 Updating password...');
    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (updateError) {
      throw new Error(`Failed to update password: ${updateError.message}`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Password changed successfully!\n');
    console.log('📧 Email:', adminEmail);
    console.log('🔑 New Password:', newPassword);
    console.log('');
    console.log('🔗 Login at: https://ithforms.innotechhub.in/admin/login');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('💡 You can now log in with the new password!');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\n💡 Tip: If the user doesn\'t exist, you may need to:');
    console.error('   1. Go to Supabase Dashboard → Authentication → Users');
    console.error('   2. Find or create the user: innotechhub.edu@gmail.com');
    console.error('   3. Update the password manually in the dashboard\n');
    process.exit(1);
  }
}

changeAdminPassword();
