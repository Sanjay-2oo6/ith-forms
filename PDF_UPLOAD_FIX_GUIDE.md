# PDF Upload Fix - Complete Guide

## Problem
Users cannot upload PDF files to the form's Resume/CV field, but PNG files work fine. This is a **client-side validation issue** where the form field's `config.accept` array doesn't include `.pdf`.

## Root Cause
The `config` column in `form_questions` table for Resume/CV field doesn't include `.pdf` in the `accept` array. The frontend FileUploader component reads this config and rejects PDFs before even attempting upload.

## Solution

### Step 1: Apply Migration 040 to Supabase
This migration fixes ALL file upload questions in the job-applications form.

**Action**: Run migration 040 in your Supabase SQL editor:
- Go to Supabase Dashboard → Project → SQL Editor
- Create a new query
- Copy-paste the contents of `supabase/migrations/040_comprehensive_file_question_config.sql`
- Click **Run**

### Step 2: Verify the Fix
After running the migration, you should see output like:

```
question_id  | label    | type  | required | accept_extensions                                    | pdf_support
-------------|----------|-------|----------|------------------------------------------------------|---------------------------
uuid-123...  | Resume   | file  | true     | [".pdf",".doc",".docx",...,".jpg",".png"]           | ✓ PDF supported
```

The `accept_extensions` should include `.pdf` and all other document types.

### Step 3: Clear Browser Cache
The form data is cached by TanStack Query on the client-side.

1. Hard refresh your browser:
   - **Windows/Linux**: `Ctrl + Shift + Delete` → Clear all → Clear
   - **Mac**: `Cmd + Shift + Delete` → Clear all → Clear
2. Or use browser DevTools:
   - Open DevTools (`F12`)
   - Right-click refresh button → Empty cache and hard refresh

### Step 4: Test PDF Upload
1. Open your form: https://ith-form.netlify.app/forms/job-applications
2. Try uploading a PDF to the Resume field
3. The file picker should now accept PDFs (no longer blocked)
4. Submit the form

## How It Works

### Frontend (Form Rendering)
File: `src/routes/forms/$slug.tsx` (line 1090)
```tsx
// Gets config from form_questions table
accept={q.config?.accept ?? [".pdf", ".docx", ".jpg", ".jpeg", ".png"]}
acceptExts={q.config?.accept ?? [".pdf", ".docx", ".jpg", ".jpeg", ".png"]}
```

The FileUploader uses `acceptExts` to:
1. Filter file picker via HTML5 `accept` attribute
2. Validate file extension client-side before uploading
3. Show user-friendly error: "only .pdf, .doc, .docx allowed"

### Backend (File Storage)
File: `supabase/migrations/029_critical_fixes.sql`

The `register_submission_file()` RPC already accepts PDFs:
```sql
IF v_ext NOT IN ('pdf', 'doc', 'docx', 'xls', 'xlsx', ...) THEN
  RETURN error
END IF;
```

So the backend is ready - we just need the frontend config fixed.

## Troubleshooting

### Still not working?
1. **Clear all cache** (browser + CDN):
   - Ctrl+Shift+Delete → Clear all
   - Or use Incognito/Private window
   
2. **Check the config in Supabase**:
   - Run this query in Supabase SQL Editor:
   ```sql
   SELECT id, label, config->'accept' 
   FROM form_questions 
   WHERE label ILIKE '%resume%';
   ```
   - Confirm `.pdf` is in the array

3. **Check console errors** (F12 → Console):
   - Look for upload errors
   - Check if form is loading fresh config

4. **Verify migrations were applied**:
   - In Supabase, go to Migrations list
   - Check that migrations 039 and 040 appear
   - Or manually run migration 040 again

### Migration Already Applied?
If the form field config already includes `.pdf` but upload still fails:
- Problem is elsewhere (network, storage quota, permissions)
- Check browser console for detailed error logs
- Check Supabase storage permissions in RLS policies

## Related Files
- Migration: `supabase/migrations/040_comprehensive_file_question_config.sql`
- Form rendering: `src/routes/forms/$slug.tsx` (FileUploader component)
- RPC validation: `supabase/migrations/029_critical_fixes.sql` (register_submission_file)

## Summary
✅ Backend: Already accepts PDFs  
❌ Frontend config: Missing `.pdf` in accept array  
🔧 Fix: Apply migration 040 to update config  
🔄 Refresh: Hard refresh browser cache  
✓ Test: Upload PDF to Resume field

