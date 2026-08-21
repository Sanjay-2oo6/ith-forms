#!/usr/bin/env node
/**
 * Create admin account in Supabase
 * Usage: node scripts/create-admin.mjs
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const ADMIN_EMAIL = "ith_forms@gmail.com";
const ADMIN_PASSWORD = "Admin123!";

async function createAdmin() {
  try {
    console.log(`Creating admin account: ${ADMIN_EMAIL}`);

    // First, try to find existing user
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u) => u.email === ADMIN_EMAIL);

    let userId;

    if (existingUser) {
      userId = existingUser.id;
      console.log(`✓ User already exists: ${ADMIN_EMAIL} (${userId})`);
    } else {
      // Create new auth user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
      });

      if (createError) {
        console.error("❌ Error creating user:", createError);
        process.exit(1);
      }

      userId = newUser.user.id;
      console.log(`✓ Created new user: ${ADMIN_EMAIL} (${userId})`);
    }

    // Check if already admin
    const { data: existingAdmin, error: checkError } = await supabase
      .from("admin_users")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      console.error("❌ Error checking admin status:", checkError);
      process.exit(1);
    }

    if (existingAdmin) {
      console.log("✓ User is already an admin");
    } else {
      // Create admin record with email
      const { error: createAdminError } = await supabase
        .from("admin_users")
        .insert([{ user_id: userId, email: ADMIN_EMAIL, is_active: true }]);

      if (createAdminError) {
        console.error("❌ Error creating admin record:", createAdminError);
        process.exit(1);
      }

      console.log("✓ Created admin record");
    }

    console.log("\n✅ Admin account setup complete!");
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log(`   You can now log in at your app`);
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
  }
}

createAdmin();
