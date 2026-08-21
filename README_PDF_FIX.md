# PDF Upload Issue - Complete Overview

## The Problem
Users cannot upload PDF files to the Resume field in the job-applications form, even though PNG works fine. Error message: "only .pdf, .docx... allowed" or similar.

## Root Cause
The Resume question's `config.accept` array in the database either:
1. **Doesn't have `.pdf` in it**, or
2. **Is NULL** (not set)

This causes the frontend to reject PDFs at client-side validation, before they even reach the server.

## Why This Happened
The resume question in the database was created before the proper file config was fully implemented, so it has an incomplete or missing `accept` array.

---

# The Fix (3 Steps)

## Step 1: Update Database Configuration

We've created migrations that add `.pdf` support to all file questions.

**Option A (Easiest - Run ONE query):**

Go to Supabase → SQL Editor → New Query → Paste & Run:

```sql
UPDATE public.form_questions
SET config = jsonb_build_object(
  'accept', '[ ".pdf", ".doc", ".docx", ".txt", ".xls", ".xlsx", ".ppt", ".pptx", ".jpg", ".jpeg", ".png", ".gif" ]'::jsonb,
  'maxSizeMB', 10
)
WHERE type IN ('file', 'document', 'image');

SELECT 'Updated all file questions - PDF now supported' as status;
```

**Option B (If Option A fails, run migration):**

Copy entire content from: `supabase/migrations/042_pdf_support_all_forms.sql`

Paste into Supabase SQL Editor → Run

## Step 2: Verify The Fix

In Supabase SQL Editor, run:

```sql
SELECT 
  q.label,
  q.type,
  CASE WHEN q.config->'accept' @> '".pdf"'::jsonb THEN '✓ PDF SUPPORTED'
       ELSE '✗ NOT SUPPORTED' END as status,
  q.config->'accept' as accept_list
FROM form_questions q
WHERE q.form_id IN (SELECT id FROM forms WHERE slug = 'job-applications')
  AND q.type IN ('file', 'document', 'image');
```

Expected output: `Resume | file | ✓ PDF SUPPORTED | [".pdf", ".doc", ...]`

## Step 3: Clear Browser Cache & Test

1. **Clear cache**: Press `Ctrl+Shift+Delete` → All time → Clear all
2. **Reload form**: https://ith-form.netlify.app/forms/job-applications
3. **Test upload**: Try uploading a PDF to Resume field
4. Should now work! ✅

---

# Files Provided

For understanding / troubleshooting:

| File | Purpose |
|------|---------|
| `supabase/migrations/040_comprehensive_file_question_config.sql` | First PDF fix attempt (using jsonb_set) |
| `supabase/migrations/041_force_pdf_support_aggressive.sql` | Second PDF fix attempt (more aggressive) |
| `supabase/migrations/042_pdf_support_all_forms.sql` | Final PDF fix (recommended, handles all cases) |
| `STEP_BY_STEP_PDF_FIX.md` | Detailed walkthrough with screenshots |
| `DIAGNOSTIC_PDF_UPLOAD.md` | How to diagnose if issue persists |
| `ACTION_ITEMS_PDF_FIX.md` | Quick action checklist |
| `PDF_UPLOAD_FIX_GUIDE.md` | Technical explanation |

---

# How It Works (Technical)

## Frontend Flow

```
Form Loads
    ↓
Questions fetched from database with config
    ↓
FileUploader component receives config.accept array
    ↓
HTML <input accept=".pdf,.doc,..."/> (limits file picker)
    ↓
User selects file
    ↓
Client-side validation: extAllowed(filename)?
    ↓
If extension matches → Upload starts
If no match → Reject with error message
    ↓
File uploaded to Supabase Storage
    ↓
Backend RPC register_submission_file() validates again
    ↓
✓ Success
```

## The Problem Spot

The failure happens at **"Client-side validation"** step because:
- Database config doesn't have `.pdf` in accept array
- FileUploader uses: `acceptExts={q.config?.accept ?? DEFAULT_ARRAY}`
- If database config is `[".png", ".jpg"]`, PDF gets rejected immediately

## The Fix

Update database so `config.accept` includes `.pdf`:
- Before: `config = {"maxSizeMB": 10}` ← No accept key
- After: `config = {"accept": [".pdf", ".doc", ...], "maxSizeMB": 10}`

Now the client-side validation passes, file uploads to storage, backend approves, done!

---

# Debugging If It Still Doesn't Work

### Check 1: Is database updated?

```sql
SELECT config->'accept' FROM form_questions 
WHERE label ILIKE '%resume%' LIMIT 1;
```

If result is NULL or doesn't include `.pdf` → Migration didn't work, run it again.

### Check 2: Is browser cache stale?

Open DevTools (F12) → Console and check for:

```
[Form Load] Loaded 10 questions [
  ...
  { label: "Resume", type: "file", config: {...} }
]
[FileUpload] "Resume" | Config: {...} | Has PDF: true | Using: DB
```

If says `Has PDF: false` → Cache issue, clear browser cache.

### Check 3: What's the exact error?

When PDF upload fails:
- Open DevTools (F12) → Console
- Try uploading PDF
- What error appears?
- Share the error message

---

# Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "only .pdf, .docx..." | Config doesn't have `.pdf` | Run database update |
| Still can't upload | Browser caching old config | `Ctrl+Shift+Delete` + hard refresh |
| "Invalid file type" server error | Server config wrong | Run database update |
| Config shows NULL | Migration didn't apply | Verify migration ran, try again |

---

# Summary

✅ **Database Fix**: Ensures form_questions.config has `.pdf` in accept array  
✅ **Frontend Code**: Already supports PDFs in defaults and from DB  
✅ **Backend RPC**: Already validates PDFs (not an issue)  

**Your Action Required**:
1. Run ONE SQL update in Supabase (copy-paste above)
2. Clear browser cache (Ctrl+Shift+Delete)
3. Test PDF upload
4. Done! 🎉

**Still not working?** 
→ Check `DIAGNOSTIC_PDF_UPLOAD.md` for detailed troubleshooting

---

# Code Changes Made

To help diagnose this issue, we also added better logging to the form:

**In `src/routes/forms/$slug.tsx`:**
- Added console logs when form questions load
- Added detailed config logging for each file question
- Shows whether PDF is in the accept array

This helps us see exactly what's happening in the browser.

---

**Last Updated**: August 21, 2026  
**Status**: Fix provided, awaiting user action  
**Complexity**: Easy (1 SQL query + browser cache clear)  

