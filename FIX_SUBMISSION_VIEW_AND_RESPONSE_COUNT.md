# Fix: Submission View Error & Response Count Double-Increment

## Issues

### Issue 1: "Error Loading Submission" - Function Not Found
When users try to view their submission using the reference ID URL, they get:
```
Error Loading Submission
Could not find the function public.get_submission_by_reference(p_reference_id)
in the schema cache
```

**Cause**: The `get_submission_by_reference()` function either:
- Wasn't applied during initial migrations, or
- Got dropped somehow, or
- Isn't showing up in Supabase's schema cache

### Issue 2: Response Count Increasing by 2
Response count is incrementing by 2 for each submission instead of 1.

**Cause**: Duplicate logic in response count trigger or function.

---

## The Fix

### Step 1: Apply Migration 043

This migration:
1. Recreates the `get_submission_by_reference()` function
2. Fixes the `increment_response_count()` trigger
3. Reconciles all response counts to be accurate

**In Supabase SQL Editor:**
1. Go to https://app.supabase.com → Your project → SQL Editor
2. New Query
3. Copy entire content from: `supabase/migrations/043_fix_submission_view_and_response_count.sql`
4. Click Run

### Step 2: Verify Both Fixes

After migration runs, you should see output showing:
- All forms listed with response counts
- Status showing `✓ CORRECT` for each form
- Test confirmation that `get_submission_by_reference` is available

### Step 3: Test

**Test 1: Verify submission view works**
1. Open a form link (e.g., https://ith-form.netlify.app/forms/job-applications)
2. Fill and submit the form
3. Note the reference ID (e.g., JAP-1a166-00042)
4. Open the submission details URL
5. Should now load successfully ✓

**Test 2: Check response count**
1. Go to admin dashboard
2. View responses for a form
3. Count should now increment by 1 per submission (not 2)

---

## What the Migration Does

### Part 1: Fix get_submission_by_reference()

```sql
DROP FUNCTION IF EXISTS public.get_submission_by_reference(text) CASCADE;

CREATE OR REPLACE FUNCTION public.get_submission_by_reference(p_reference_id text)
RETURNS json
...
```

This function:
- Takes a reference ID (e.g., "JAP-1a166-00042")
- Returns JSON with submission data, form details, and answers
- Allows public (anon) access for transparency
- Used by submission detail page

### Part 2: Fix increment_response_count()

**Before** (had duplicates):
```sql
UPDATE public.forms SET response_count = response_count + 1 WHERE id = p_form_id;
UPDATE public.forms SET response_count = response_count + 1 WHERE id = p_form_id; -- DUPLICATE!
```

**After** (single update):
```sql
UPDATE public.forms 
SET response_count = COALESCE(response_count, 0) + 1 
WHERE id = NEW.form_id;
```

### Part 3: Reconcile Counts

```sql
UPDATE public.forms f
SET response_count = (
  SELECT COUNT(*) FROM public.submissions s WHERE s.form_id = f.id
);
```

This fixes all response counts to match actual submission counts.

---

## How Submission Details Work

### Flow:

1. **User submits form**
   - `submit_response()` RPC creates submission
   - Reference ID generated: `JAP-1a166-00042`
   - Reference token generated (secret URL token)
   - Response count incremented by 1

2. **User receives submission URL**
   - URL format: `https://ith-form.netlify.app/responses/{reference_id}`
   - Or with token: `https://ith-form.netlify.app/responses/{reference_id}?token={token}`

3. **User opens URL**
   - Frontend calls `get_submission_by_reference(reference_id)`
   - Function returns JSON with:
     - Submission details (name, email, timestamp)
     - Form details (title, description)
     - All answers (question + value pairs)
     - File uploads (if any)

4. **Frontend displays the data**
   - Shows all answered questions with values
   - Shows uploaded files
   - Formatted nicely for viewing

---

## Verification Query

To verify the fixes were applied correctly:

```sql
-- Check 1: Function exists
SELECT 'get_submission_by_reference' as function_name, 'EXISTS' as status
FROM pg_proc 
WHERE proname = 'get_submission_by_reference'
UNION ALL
SELECT 'get_submission_by_reference', 'MISSING'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_proc WHERE proname = 'get_submission_by_reference'
);

-- Check 2: Response counts are correct
SELECT 
  f.slug,
  f.response_count as reported,
  (SELECT COUNT(*) FROM submissions WHERE form_id = f.id) as actual,
  CASE WHEN f.response_count = (SELECT COUNT(*) FROM submissions WHERE form_id = f.id)
    THEN 'CORRECT' ELSE 'MISMATCH' END as status
FROM forms f;

-- Check 3: Trigger exists and is single
SELECT tgname, tgfoid::regprocedure 
FROM pg_trigger 
WHERE tgrelid = 'submissions'::regclass 
AND tgname LIKE '%response%' OR tgname = 'on_submission_inserted';
```

---

## If It Still Doesn't Work

### Symptom: Submission view still shows error

**Check 1**: Did you run migration 043?
- Go to Supabase → Migrations list
- Look for "043_fix_submission_view"
- Should be at the top (most recent)

**Check 2**: Try in browser console (F12):
```javascript
// Test calling the function directly
const result = await supabase.rpc('get_submission_by_reference', {
  p_reference_id: 'JAP-1a166-00042' // Replace with actual reference ID
});
console.log(result);
```

If this returns an error, the function wasn't created properly. Run migration 043 again.

### Symptom: Response count still incrementing by 2

**Check 1**: Are there multiple triggers?
```sql
SELECT tgname FROM pg_trigger 
WHERE tgrelid = 'public.submissions'::regclass 
AND tgfoid IN (
  SELECT oid FROM pg_proc WHERE proname = 'increment_response_count'
);
```

Should return only ONE row.

**Check 2**: Did you reconcile counts?
```sql
UPDATE public.forms f
SET response_count = (
  SELECT COUNT(*) FROM public.submissions s WHERE s.form_id = f.id
);
```

Run this manually if the migration's reconcile didn't work.

---

## Related Files

- Migration: `supabase/migrations/043_fix_submission_view_and_response_count.sql`
- Frontend: `src/routes/responses/[referenceId].tsx` (uses this function)
- Database: `submissions` table + `forms.response_count` field

---

## Summary

| Issue | Fix | Status |
|-------|-----|--------|
| Submission view error | Recreate function | Migration 043 |
| Response count +2 | Fix trigger | Migration 043 |
| Inaccurate counts | Reconcile | Migration 043 |

**Action**: Run migration 043 in Supabase → Test submission view + count → Done ✓

