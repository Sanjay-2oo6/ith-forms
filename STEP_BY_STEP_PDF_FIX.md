# Step-by-Step PDF Upload Fix - Complete Walkthrough

## The Problem
PDFs are being rejected on the job-applications form, but PNGs work fine.

## Root Cause
The resume question in the database has config without `.pdf` in the accept array.

---

## STEP 1: Verify Migrations Haven't Been Applied Yet

**In Supabase Dashboard:**

1. Go to: https://app.supabase.com
2. Select your project: **ith-forms**
3. Click **Migrations** (left sidebar → Settings → Migrations)
4. Look for migrations 040, 041, or 042
5. If you see them ✓ → Skip to STEP 2
6. If you DON'T see them ✗ → Go to STEP 1B

### STEP 1B: Check if Migrations Exist (Alternative)

In **SQL Editor**, run:
```sql
SELECT schema, name FROM information_schema.schemata WHERE schema LIKE 'supabase_migrations' LIMIT 1;
```

If no results, migrations table hasn't been used - migrations need to be applied manually.

---

## STEP 2: Apply the PDF Fix Migration (Choose ONE)

### Option A: Use the Most Reliable Fix (RECOMMENDED)

1. Go to Supabase: https://app.supabase.com → Your project → **SQL Editor**
2. Click **New Query**
3. Copy-paste the ENTIRE content from:
   ```
   supabase/migrations/042_pdf_support_all_forms.sql
   ```
4. Click **Run** (or Ctrl+Enter)
5. **Wait for completion** - you should see output showing:
   - List of all file questions
   - PDF support status
   - Count of updated questions

### Option B: If Option A Fails

Try migration 041 instead:
```
supabase/migrations/041_force_pdf_support_aggressive.sql
```

### Option C: If Both Fail (Nuclear Option)

Run this simpler query directly:

```sql
-- Simple direct fix
UPDATE public.form_questions
SET config = jsonb_build_object(
  'accept', '[ ".pdf", ".doc", ".docx", ".txt", ".xls", ".xlsx", ".ppt", ".pptx", ".jpg", ".jpeg", ".png", ".gif" ]'::jsonb,
  'maxSizeMB', 10,
  'maxFiles', 1
)
WHERE type IN ('file', 'document', 'image');

-- Verify it worked
SELECT id, label, config->'accept' as accept_list 
FROM form_questions 
WHERE type IN ('file', 'document', 'image')
LIMIT 5;
```

---

## STEP 3: Verify the Fix Was Applied

**Still in SQL Editor**, run this verification query:

```sql
SELECT 
  f.slug as form_name,
  q.label as question_label,
  q.type,
  CASE 
    WHEN q.config->'accept' @> '".pdf"'::jsonb THEN '✓ PDF SUPPORT ENABLED'
    ELSE '✗ PDF NOT SUPPORTED'
  END as status,
  q.config->'accept' as accept_list
FROM public.form_questions q
JOIN public.forms f ON f.id = q.form_id
WHERE f.slug = 'job-applications'
  AND q.type IN ('file', 'document', 'image');
```

**Expected Result:**
```
form_name           | question_label | type     | status                    | accept_list
job-applications    | Resume         | file     | ✓ PDF SUPPORT ENABLED     | [".pdf", ".doc", ".docx", ...]
```

If you see **✓ PDF SUPPORT ENABLED**, the database fix worked!

---

## STEP 4: Clear Browser Cache (CRITICAL!)

This ensures the form loads fresh data, not cached data.

### Method 1: Hard Refresh (Recommended)
1. Go to your form: https://ith-form.netlify.app/forms/job-applications
2. Press: **Ctrl+Shift+Delete** (Windows) or **Cmd+Shift+Delete** (Mac)
3. Select **All time** / **Everything**
4. Check ☑️: **Cookies and other site data**
5. Click **Clear data**
6. Close and reopen the browser tab
7. Refresh: **F5**

### Method 2: Private/Incognito Window (Faster)
1. Open new **Private** window (Ctrl+Shift+N) or **Incognito** (Ctrl+Shift+i)
2. Go to: https://ith-form.netlify.app/forms/job-applications
3. This always uses fresh data

### Method 3: DevTools
1. Press **F12**
2. Right-click the reload button (↻)
3. Click **"Empty cache and hard reload"**

---

## STEP 5: Test PDF Upload

1. Open form: https://ith-form.netlify.app/forms/job-applications
2. Scroll to **Resume** field
3. Click **Upload file** button
4. **Select a PDF** from your computer
5. You should see: ✓ File accepted (NOT rejected)
6. Upload progress bar should appear
7. File should show with green checkmark
8. **Submit** the form
9. Check **Responses** - PDF should appear

---

## STEP 6: Troubleshooting (If Still Not Working)

### Issue: Still says "only .pdf, .docx... allowed"

**Check #1: Verify DB Update (Run in SQL Editor)**
```sql
SELECT id, label, config 
FROM form_questions 
WHERE label ILIKE '%resume%' 
LIMIT 1;
```

If `config` is `NULL` or missing `accept` key → Migration didn't apply correctly, try again.

**Check #2: Clear ALL Browser Data**
```
Ctrl+Shift+Delete → All time → Clear all
```

Then completely close browser and reopen.

**Check #3: Check Console Error (F12)**
1. Press **F12** → **Console** tab
2. Try uploading PDF again
3. Look for error messages
4. Copy any errors and share them

### Issue: Upload starts but then fails

**The server is rejecting it.** The RPC function is checking the database config and rejecting because the config doesn't have `.pdf`.

Run verification query above to confirm config has `.pdf`.

### Issue: "Invalid file type" or "upload failed"

**Server-side error.** This means:
- Database fix didn't apply correctly
- Or the RPC function has an issue

Check in SQL Editor:
```sql
SELECT 
  label,
  config->>'maxSizeMB' as max_size,
  config->'accept' as accepted_extensions
FROM form_questions
WHERE form_id IN (SELECT id FROM forms WHERE slug = 'job-applications')
AND type IN ('file', 'document', 'image');
```

Every row should have `accept` array with `.pdf`.

---

## STEP 7: Final Verification (All Green?)

After testing, confirm:

☐ Database has `.pdf` in accept array  
☐ Browser cache cleared  
☐ Can select PDF file without "only .pdf, .docx..." error  
☐ File uploads shows progress bar  
☐ File appears in responses  
☐ Admin can download PDF  

---

## Still Having Issues?

### Debug Info to Collect:

1. **Database Status** (from SQL Editor):
```sql
SELECT count(*) as file_questions, 
       sum(case when config->'accept' @> '".pdf"'::jsonb then 1 else 0 end) as with_pdf
FROM form_questions WHERE type IN ('file', 'document', 'image');
```

2. **Form Config** (from browser console F12):
```javascript
// After form loads
const questions = window.formQuestions || [];
const resume = questions.find(q => q.label.includes('Resume'));
console.log('Resume config:', resume?.config);
```

3. **Error Message** (when PDF fails):
   - Open DevTools (F12)
   - Go to Console tab
   - Try uploading PDF
   - Copy the full error message

### Share These for Help:
- Output from Database Status query above
- Screenshot of form config from console
- Full error message text
- Browser and OS (Windows/Mac/Linux)

---

## Summary

| Step | What to Do | Check |
|------|-----------|-------|
| 1 | Check if migrations applied | Supabase Migrations list |
| 2 | Run migration 042 | SQL editor output |
| 3 | Verify database | ✓ PDF in accept array |
| 4 | Clear cache | Ctrl+Shift+Delete |
| 5 | Test upload | Upload PDF successfully |
| 6 | Troubleshoot if needed | Use debug queries above |

---

**Time Estimate**: 10 minutes  
**Difficulty**: Easy  
**Risk**: None (only updates JSON config)

