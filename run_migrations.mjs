#!/usr/bin/env node

/**
 * Migration Runner for ITH Forms
 * Runs all migrations in canonical order against Supabase
 * Usage: node run_migrations.mjs
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

// Canonical order from docs/migrations.md
const CANONICAL_ORDER = [
  "001_init.sql",
  "002_audit_actor.sql",
  "003_fixes.sql",
  "004_solutions_migration.sql",
  "005_security_hardening.sql",
  "006_dashboard_aggregates.sql",
  "007_response_view_and_fixes.sql",
  "008_complete_fixes.sql",
  "009_fix_audit_actor.sql",
  "010_per_form_reference_ids.sql",
  "011_public_view_response.sql",
  "012_fix_audit_log_actions.sql",
  "013_fix_dashboard_functions.sql",
  "014_add_your_admin_user.sql",
  // Config track (015-018)
  "015_file_upload_configuration.sql",
  "016_linear_scale_configuration.sql",
  "017_question_config.sql",
  "018_reset_reference_sequences.sql",
  // Fix track (015-018)
  "015_expand_audit_actions.sql",
  "016_fix_double_increment.sql",
  "017_fix_checkbox_delimiter.sql",
  "018_validate_scale_values.sql",
  // Modern (019-023)
  "019_normalize_yes_no_values.sql",
  "020_production_readiness.sql",
  "021_responses_date_filter.sql",
  "022_save_form_builder.sql",
  "023_audit_actions_canonical.sql",
  // Optional: Additional security/features
  "024_app_settings.sql",
  "025_performance_indexes.sql",
  "026_cryptographic_reference_tokens.sql",
  "027_export_cursor_pagination.sql",
  "028_audit_log_pagination.sql",
  "029_critical_fixes.sql",
  "030_fix_submit_response_schema.sql",
  "031_generate_test_submissions.sql",
  "032_fix_responses_function.sql",
  "033_fix_token_generation.sql",
  "034_fix_reference_id_race_condition.sql",
  "035_fix_required_file_validation.sql",
  "036_cleanup_invalid_test_submissions.sql",
  "037_fix_resume_field_config.sql",
  "038_comprehensive_pdf_fix.sql",
  "039_final_pdf_fix_with_diagnostics.sql",
  "040_comprehensive_file_question_config.sql",
  "041_force_pdf_support_aggressive.sql",
  "042_pdf_support_all_forms.sql",
  "043_fix_submission_view_and_response_count.sql",
  "044_google_oauth_schema.sql",
  "045_google_oauth_rpcs.sql",
  "046_auto_provision_admin_on_login.sql",
  "047_fix_form_schedule_and_limits_save.sql",
  "048_fix_form_availability_rls.sql",
  "049_fix_closes_at_timezone.sql",
  "050_fix_reference_id_enumeration.sql",
  "051_fix_verified_emails_rls.sql",
  "052_fix_auto_admin_provisioning.sql",
  "053_add_email_validation_to_submit_response.sql",
  "054_add_rate_limiting_to_submit_response.sql",
  "055_fix_file_path_traversal.sql",
];

async function runMigration(filename) {
  try {
    const filepath = join("supabase/migrations", filename);
    const sql = readFileSync(filepath, "utf-8");

    // Skip empty files or comments-only files
    const trimmed = sql.replace(/^\s*--.*$/gm, "").trim();
    if (!trimmed) {
      console.log(`⏭️  ${filename} (empty, skipped)`);
      return true;
    }

    // Execute query
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({ sql }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ ${filename}`);
      console.error(`   Error: ${error}`);
      return false;
    }

    console.log(`✅ ${filename}`);
    return true;
  } catch (err) {
    console.error(`❌ ${filename}`);
    console.error(`   Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log("🚀 Running migrations...\n");
  console.log(`📍 Supabase URL: ${SUPABASE_URL}\n`);

  let successful = 0;
  let failed = 0;

  for (const filename of CANONICAL_ORDER) {
    const result = await runMigration(filename);
    if (result) {
      successful++;
    } else {
      failed++;
    }
    // Small delay between requests
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\n📊 Results: ${successful} successful, ${failed} failed\n`);

  if (failed > 0) {
    console.error(`❌ Some migrations failed. Check errors above.`);
    process.exit(1);
  } else {
    console.log(`✅ All migrations completed successfully!`);
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
