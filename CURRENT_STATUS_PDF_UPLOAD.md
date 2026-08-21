# PDF Upload Issue - Current Status & Resolution

## Issue Summary
PDF file uploads are being rejected on mobile and desktop, while PNG files work fine. Users receive an error when trying to upload PDF to the Resume/CV field on the job-applications form.

## Root Cause Identified ✓
**The Issue**: The form field's `config.accept` array in the database doesn't include `.pdf` extension.

**Why It Happens**:
- When the form loads, it fetches question configurations from `form_questions` table
- The Resume field's config has `accept: [".png", ".jpg", ".jpeg", ...]` but is missing `.pdf`
- The frontend FileUploader component uses this array to filter files
- PDF gets rejected at client-side validation before upload even starts

**Evidence**:
- PNG uploads work because `.png` is in the accept array
- PDF uploads fail because `.pdf` is NOT in the accept array
- The backend RPC (`register_submission_file`) already accepts PDFs - the problem is frontend config

## Solution Implemented ✓

### What Was Done:
1. **Migration 038**: Attempted fix using ILIKE pattern matching
2. **Migration 039**: Added diagnostics to identify the exact config state
3. **Migration 040**: Comprehensive fix using direct JSON building (most reliable)

### Migrations Created:
```
supabase/migrations/038_comprehensive_pdf_fix.sql
supabase/migrations/039_final_pdf_fix_with_diagnostics.sql
supabase/migrations/040_comprehensive_file_question_config.sql
```

### What Migration 040 Does:
- Gets all file questions in job-applications form
- Creates clean config with: `{ accept: [".pdf", ".doc", ".docx", ... ".png"], maxSizeMB: 10, maxFiles: 1 }`
- Replaces old config entirely with this new one
- Includes diagnostics to verify PDF is now in the accept array

## Next Steps for User

### IMMEDIATE ACTION REQUIRED:

**Step 1: Apply Migration 040 to Supabase**
1. Go to https://app.supabase.com
2. Select your "ith-forms" project
3. Go to SQL Editor (left sidebar)
4. Create new query
5. Copy entire content of `supabase/migrations/040_comprehensive_file_question_config.sql`
6. Click "Run"
7. Should see output showing file questions updated with `.pdf` support

**Step 2: Clear Browser Cache**
- Hard refresh: `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
- Or use Incognito/Private window to test

**Step 3: Test PDF Upload**
1. Open form: https://ith-form.netlify.app/forms/job-applications
2. Try uploading a PDF to Resume field
3. Should now accept the file

### How to Verify Fix Was Applied:

**Option 1: Check in Supabase SQL Editor**
```sql
SELECT 
  id, 
  label, 
  config->'accept' as accept_extensions
FROM form_questions 
WHERE label ILIKE '%resume%';
```

Should show: `[".pdf", ".doc", ".docx", ".txt", ...]`

**Option 2: Check in DevTools Console**
After loading the form, check if `config.accept` includes `.pdf`

## Technical Details

### File Upload Flow:
1. **Frontend**: User clicks "Upload" → FileUploader component
2. **Validation 1** (Client): Checks file extension against `q.config.accept` array
   - ❌ PDF fails here if `.pdf` not in config
3. **Upload**: If validation passes, sends file to Supabase Storage
4. **Validation 2** (Backend): RPC function `register_submission_file()` validates extension
   - ✓ Would accept PDF here (already in allowed list)

### Where Fix Was Needed:
**Validation 1** - Client-side config must include `.pdf`

### Files Modified:
- `supabase/migrations/040_comprehensive_file_question_config.sql` - **Apply this to Supabase**
- `PDF_UPLOAD_FIX_GUIDE.md` - User-facing guide
- `src/routes/forms/$slug.tsx` - Already has proper logic, just needs correct config from DB

## Why This Happened

The form questions were created with a partial `accept` array that didn't include all supported file types. Migrations 037 and 038 attempted to fix this but used pattern matching that may not have matched correctly.

Migration 040 uses a more direct approach: completely rebuild the config object with all supported types.

## Rollback Plan (If Needed)

If something breaks:
1. The change only affects the `config` column in form_questions
2. No data is deleted, only the JSON structure is updated
3. Can revert by running: `DELETE FROM supabase/migrations/040_...` (don't do this unless necessary)
4. Can manually reset config back to previous values

## Success Criteria

✅ Form loads without errors  
✅ File picker shows PDF as accepted type  
✅ PDF uploads complete successfully  
✅ File appears in responses list  
✅ Admin can download PDF from response detail  

## Additional Notes

- **No frontend deploy needed** - Backend config fix only
- **No code changes needed** - Frontend already supports PDFs
- **Browser cache may need clearing** - TanStack Query caches form data
- **Works on mobile too** - Once config is fixed

---

**Last Updated**: August 21, 2026  
**Status**: Fix ready to apply - waiting for user to run migration 040 in Supabase  
**GitHub**: Latest code pushed to `main` branch

