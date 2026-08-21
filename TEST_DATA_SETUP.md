# 📊 Test Data Setup Guide - 50 Job Applications

This guide will help you generate 50 test submissions for your job-applications form.

---

## Prerequisites

Before generating test data, you need to:

1. ✅ Apply the database schema fix (Migration 030)
2. ✅ Apply the test data generation migration (Migration 031)

---

## Step 1: Apply Database Fixes

### Option A: Via Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to: https://app.supabase.com/
   - Select your project

2. **Apply Migration 030 (Schema Fix)**
   - Click **SQL Editor** → **New Query**
   - Copy contents from: `supabase/migrations/030_fix_submit_response_schema.sql`
   - Click **Run** (or Ctrl+Enter)
   - You should see: "submit_response schema fixed - removed non-existent answers column"

3. **Apply Migration 031 (Test Data)**
   - Click **SQL Editor** → **New Query**
   - Copy contents from: `supabase/migrations/031_generate_test_submissions.sql`
   - Click **Run**
   - You should see a summary like:
     ```
     total_submissions | unique_respondents | oldest_submission | newest_submission
     50               | 50                 | [timestamp]      | [timestamp]
     ```

### Option B: Via Supabase CLI

```bash
# Make sure you have Supabase CLI installed
supabase migration list          # Check current state
supabase db push                # Apply all pending migrations
```

---

## Step 2: Generate Test Data

### Method 1: Using the SQL Migration (Simplest)

The migration `031_generate_test_submissions.sql` creates the data directly when applied.

**What it does:**
- Creates 50 unique submissions
- Generates realistic test data (names, emails, answers)
- Assigns sequential reference IDs (JOB-APP-00001 to JOB-APP-00050)
- Updates form response count
- Randomizes submission timestamps

### Method 2: Using the Node.js Script

First, ensure the `submit_response()` RPC function exists (Apply Migration 030), then:

```bash
cd d:\ITHub\ith-forms
node scripts/generate-test-submissions.mjs
```

This will:
- Submit 50 forms programmatically
- Show real-time progress
- Return success/failure rate
- Display sample reference IDs

---

## Step 3: Verify Test Data

### Via Supabase Dashboard

1. Go to **SQL Editor** → **New Query**
2. Run:
   ```sql
   SELECT 
     COUNT(*) as total_submissions,
     COUNT(DISTINCT respondent_email) as unique_respondents,
     MIN(submitted_at) as oldest,
     MAX(submitted_at) as newest
   FROM public.submissions
   WHERE form_id = (SELECT id FROM public.forms WHERE slug = 'job-applications');
   ```
3. Should show: 50 submissions from 50 unique respondents

### Via Admin Dashboard

1. Open your app: https://ith-form.netlify.app/admin/login
2. Log in with your admin credentials
3. Click **Dashboard** or **Forms**
4. Find "Job Application" form
5. Click **View Responses**
6. You should see all 50 submissions

---

## Test Data Details

### Sample Submissions Include:

**Names:** 50 unique names from combined first/last name lists
- Examples: John Smith, Jane Johnson, Michael Williams, etc.

**Emails:** Unique test emails
- Format: firstname.lastname{number}@test.com
- Examples: john.smith1@test.com, jane.johnson2@test.com

**Answers:**
- **Years of Experience:** 0, 1, 2, 3, 5, 7, 10, 15, or 20 years
- **Why are you a good fit:** 10 different realistic reasons
- **Resume/CV:** Placeholder (ready for actual file uploads)
- **Other fields:** Generic test responses

**Timestamps:** Random dates within the last 7 days

---

## Troubleshooting

### Error: "Function submit_response does not exist" (HTTP 404)
**Solution:** Migration 030 hasn't been applied yet. Apply it first.

### Error: "Column answers does not exist"
**Solution:** This is the bug! Apply Migration 030 to fix it.

### Error: "Form job-applications not found"
**Solution:** Make sure the form slug is exactly "job-applications" (lowercase with hyphen)

### No data appears in admin dashboard
**Solution:**
1. Clear browser cache (Ctrl+Shift+Delete)
2. Refresh the page
3. Try logging out and back in
4. Check Supabase dashboard directly with SQL query

### Script shows 0% success rate
**Solution:**
1. Verify Migration 030 is applied
2. Check your form ID is correct
3. Ensure form status is "published"
4. Check Supabase quota/limits

---

## What Gets Created

### Database Records

```
submissions table:
├── 50 submission records
├── Each with unique reference_id (JOB-APP-00001 to JOB-APP-00050)
├── Each with reference_token for secure lookup
└── Distributed timestamps

submission_answers table:
├── 50 submissions × 10 questions = 500 answer records
├── Each answer linked to a question
└── Realistic test values
```

### File Structure

```
Job Application Form
├── Personal Info
│  ├── Name (pre-filled)
│  └── Email (pre-filled)
├── Experience (Step 1)
│  └── Years of Experience (0-20)
├── Experience (Step 2)
│  └── Why are you a good fit? (descriptive text)
├── Experience (Step 3)
│  ├── Resume / CV (file upload)
│  └── [Other questions]
```

---

## Next Steps

### 1. Review Submissions
- Log in to admin dashboard
- Check responses are displaying correctly
- Verify all form fields show up

### 2. Test Features
- Try filtering by status
- Test bulk actions (approve/reject)
- Export submissions to XLSX
- Check individual response details

### 3. Test Workflows
- Change submission status
- Add notes/comments
- Export for reporting
- Test email notifications

### 4. Performance Testing
- Check response time with 50 records
- Test search/filter performance
- Verify pagination works
- Test bulk export

---

## Clean Up Test Data (If Needed)

### Delete All Test Submissions

```sql
DELETE FROM public.submission_answers
WHERE submission_id IN (
  SELECT id FROM public.submissions
  WHERE form_id = (SELECT id FROM public.forms WHERE slug = 'job-applications')
);

DELETE FROM public.submissions
WHERE form_id = (SELECT id FROM public.forms WHERE slug = 'job-applications')
  AND respondent_email LIKE '%@test.com';

UPDATE public.forms SET response_count = 0
WHERE slug = 'job-applications';
```

---

## FAQ

**Q: Can I add more than 50 submissions?**
A: Yes! Edit the migration or run it multiple times with different counts.

**Q: Can I customize the test data?**
A: Yes! Edit `031_generate_test_submissions.sql` and modify the arrays or values.

**Q: Will this affect production data?**
A: No, this only creates new records. All existing data is preserved.

**Q: How long does it take?**
A: SQL migration: ~5 seconds
   Node script: ~10-20 seconds (for 50 submissions)

**Q: Can I delete the test data later?**
A: Yes! Use the SQL cleanup commands in the "Clean Up" section above.

---

## Support

If you encounter issues:

1. Check **Supabase Logs** → SQL Editor
2. Review error messages in browser console (F12)
3. Verify all migrations applied successfully
4. Check form is published (status = 'published')
5. Ensure email is not duplicated

---

## Summary

✅ **Quick Start:**
1. Open Supabase SQL Editor
2. Run Migration 030 (schema fix)
3. Run Migration 031 (test data)
4. Refresh admin dashboard
5. See 50 test submissions

🎉 **Done!** You now have 50 test job applications ready for testing.

---

**Last Updated:** 2026-08-21
**Status:** Ready for deployment ✅
