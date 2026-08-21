# Database Schema Fix - Form Submission Error

## Problem

**Error Message:**
```
Submission failed. Please try again.
(column "answers" of relation "submissions" does not exist)
```

**Root Cause:**
The `submit_response()` RPC function in migration 029 was trying to insert into a non-existent `answers` column when creating a new submission.

## Database Schema Design

The ITH Forms app uses **two separate tables** for storing submission data:

### `submissions` table
Stores metadata about each form submission:
- `id` (uuid) - Submission ID
- `form_id` (uuid) - Reference to the form
- `reference_id` (text) - Human-readable ID (e.g., "JOB-APP-00001")
- `reference_token` (text) - Lookup token
- `respondent_name` (text) - Submitter name
- `respondent_email` (text) - Submitter email
- `status` (enum) - Submission status
- `submitted_at` (timestamptz) - Submission timestamp
- `metadata` (jsonb) - Additional metadata
- `idempotency_key` (uuid) - For duplicate detection
- **NO `answers` column**

### `submission_answers` table
Stores individual answers for each question:
- `submission_id` (uuid) - References submissions
- `form_id` (uuid) - References forms (denormalized)
- `question_id` (uuid) - References form_questions
- `value` (text) - The answer value (up to 20,000 chars)

## The Fix

### Migration 029 - What Was Wrong
```sql
-- ❌ WRONG - trying to insert into non-existent "answers" column
INSERT INTO public.submissions (
  form_id, 
  reference_token, 
  reference_id, 
  respondent_name, 
  respondent_email, 
  answers,              -- ❌ THIS COLUMN DOESN'T EXIST
  status, 
  idempotency_key, 
  submitted_at
)
VALUES (...)
```

### Migration 030 - Corrected
```sql
-- ✅ CORRECT - only insert valid columns
INSERT INTO public.submissions (
  form_id,
  reference_token,
  reference_id,
  respondent_name,
  respondent_email,
  status,
  idempotency_key,
  submitted_at
)
VALUES (...)

-- Answers are inserted separately into submission_answers table
INSERT INTO public.submission_answers (submission_id, form_id, question_id, value)
SELECT v_sub_id, p_form_id, (a->>'question_id')::uuid, left(a->>'value', 20000)
FROM jsonb_array_elements(p_answers) a;
```

## Changes Made

1. **Modified:** `supabase/migrations/029_critical_fixes.sql`
   - Updated `submit_response()` function to remove `answers` column from INSERT
   - Now correctly inserts into `submission_answers` table

2. **Created:** `supabase/migrations/030_fix_submit_response_schema.sql`
   - New migration with full corrected function
   - Includes documentation and comment explanations
   - Adds response count increment to forms table

## Deployment Steps

### Option 1: Apply via Supabase Dashboard (Recommended)

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Create a new query
3. Copy the contents of `supabase/migrations/030_fix_submit_response_schema.sql`
4. Paste and execute
5. You should see: `"submit_response schema fixed - removed non-existent answers column"`

### Option 2: Apply via Migrations (if using migration system)

Run migrations in order:
```bash
# If your setup supports automatic migrations
npm run migrate
# or
supabase migration deploy
```

## Testing

After applying the migration:

1. Navigate to any published form
2. Fill out the form completely
3. Submit it
4. Should see success message with reference ID
5. Check admin responses page - new submission should appear

## Why This Happened

Migration 029 attempted to include answers in the submission record, but the actual database schema (migration 001) stores answers separately in `submission_answers` for:
- **Normalization** - Avoid storing repeated JSON arrays
- **Queryability** - Can query individual answers
- **Flexibility** - Answer format can change without migration
- **Performance** - Index on question_id for quick lookup

## Additional Notes

- This fix is **backwards compatible** - existing submissions are unaffected
- The `reference_token` is correctly returned for lookups
- Response count on forms is now properly incremented
- All answers are validated for length (max 20,000 chars)

---

**Applied by:** Database Schema Fix  
**Status:** ✅ Ready for deployment
