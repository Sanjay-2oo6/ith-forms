# ⚠️ ACTION ITEMS - PDF Upload Fix

## Current Situation
- ✅ Code is correct - form builder creates file questions with `.pdf` support
- ❌ **Database issue** - The existing Resume question in job-applications form has wrong or missing config
- ⏳ **Waiting** - Migration 040 is ready to apply, just needs to be run in Supabase

## What You Need To Do (3 Steps, 5 minutes total)

### STEP 1: Run Migration 040 in Supabase (2 minutes)

1. Go to: **https://app.supabase.com**
2. Select your **ith-forms** project
3. Click **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy everything from this file:
   ```
   supabase/migrations/040_comprehensive_file_question_config.sql
   ```
6. Paste into the query editor
7. Click **Run** (or press Ctrl+Enter)
8. You should see results showing the file questions updated

### STEP 2: Clear Browser Cache (2 minutes)

**Option A: Hard Refresh**
- Press: **Ctrl+Shift+Delete** (Windows) or **Cmd+Shift+Delete** (Mac)
- Select **All time** or **Everything**
- Check: ☑️ Cookies and other site data
- Click **Clear data**
- Wait 10 seconds

**Option B: Incognito/Private Window (Faster)**
- Open new Incognito/Private window
- Go to your form
- This always uses fresh data

**Option C: DevTools (If above not available)**
- Press **F12**
- Right-click the refresh button
- Click **Empty cache and hard refresh**

### STEP 3: Test PDF Upload (1 minute)

1. Open form: **https://ith-form.netlify.app/forms/job-applications**
2. Scroll to **Resume** field
3. Click **Upload file** button
4. Select a PDF from your computer
5. Should now show: ✅ File accepted
6. Complete form submission to verify it works

## Success Indicators

After running the migration and clearing cache, you should see:

✅ File picker accepts PDFs  
✅ PNG files still work  
✅ Other document types (docx, txt, etc.) work  
✅ File uploads complete without errors  
✅ Files appear in responses list  

## If It Still Doesn't Work

Check this in order:

### Debug Step 1: Verify Migration Ran
**In Supabase SQL Editor**, run:
```sql
SELECT id, label, config->'accept' as accept_extensions
FROM form_questions 
WHERE label ILIKE '%resume%'
LIMIT 1;
```

Should show: `[".pdf", ".doc", ".docx", ...]`

If you see `NULL` or empty, migration didn't run correctly. Try again.

### Debug Step 2: Check Browser Cache
**In browser console** (F12 → Console), run:
```javascript
// Clear TanStack Query cache
window.localStorage.clear();
window.sessionStorage.clear();
```

Then reload page: **F5** or **Ctrl+R**

### Debug Step 3: Check Network
**If PDF upload still fails:**
1. Open DevTools: **F12**
2. Go to **Network** tab
3. Try uploading PDF
4. Look for request called `upload` or `storage`
5. Check response - what's the error?
6. Share the error message

### Debug Step 4: Check Form Config
**In browser console** (F12 → Console), run:
```javascript
// After form loads, this shows the config:
console.log(JSON.stringify(window.formConfig, null, 2));
```

Look for the Resume question and check if `config.accept` includes `.pdf`

## Technical Summary

**Problem**: Resume question config doesn't include `.pdf`  
**Cause**: Old question created before proper config was set  
**Solution**: Migration 040 rebuilds config with all file types  
**Result**: Frontend can now accept PDFs  

**Files Involved**:
- Frontend form reader: `src/routes/forms/$slug.tsx` (line 1090)
- Admin builder: `src/routes/_admin/forms/$formId/edit.tsx` (line 343)
- Backend file validator: `supabase/migrations/029_critical_fixes.sql`
- Database fix: `supabase/migrations/040_comprehensive_file_question_config.sql` ← **RUN THIS**

## Questions?

If you need help:
1. Share the output from **Debug Step 1** above
2. Share the browser console error from **Debug Step 3**
3. Take a screenshot of the error message you see

---

**Time to fix**: ~5 minutes  
**Risk level**: Very low (only updates JSON config in database)  
**Rollback**: Can re-run migration if needed  

**You've got this! 🚀**

