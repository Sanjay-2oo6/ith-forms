# Diagnostic: PDF Upload Still Not Working

Since you're still having PDF upload issues, we need to diagnose where the problem is.

## Quick Diagnosis (5 minutes)

### Step 1: Open Browser Console

1. Go to form: https://ith-form.netlify.app/forms/job-applications
2. Press **F12** to open Developer Tools
3. Click **Console** tab

You should see logs like:
```
[Form Load] Loaded 10 questions [...]
[FileUpload] "Resume" | Config: {...} | Has PDF: true | Using: DB
```

### Step 2: Check the Console Output

Look for the line mentioning the Resume question. Example:

**Good (PDF is supported):**
```
[FileUpload] "Resume" | Config: {"accept":[".pdf",".doc",...]} | Has PDF: true | Using: DB
```

**Bad (PDF is NOT in config):**
```
[FileUpload] "Resume" | Config: {"accept":[".png",".jpg"]} | Has PDF: false | Using: DB
```

**Really Bad (config is NULL):**
```
[FileUpload] "Resume" | Config: null | Has PDF: false | Using: DEFAULTS
```

### Step 3: Take a Screenshot

Screenshot the console output and share with me. This will tell us:
- Is the database config being loaded?
- Does it have `.pdf`?
- Is it NULL?

---

## Full Diagnosis (10 minutes)

### Database Check

**In Supabase SQL Editor**, run:

```sql
-- Check what's in the database
SELECT 
  f.id as form_id,
  f.slug,
  q.id as question_id,
  q.label,
  q.type,
  q.config,
  q.config->'accept' as accept_array,
  CASE 
    WHEN q.config->'accept' @> '".pdf"'::jsonb THEN '✓ HAS PDF'
    WHEN q.config IS NULL THEN '✗ CONFIG NULL'
    ELSE '✗ NO PDF'
  END as pdf_status
FROM public.form_questions q
JOIN public.forms f ON f.id = q.form_id
WHERE f.slug = 'job-applications'
  AND q.type IN ('file', 'document', 'image');
```

**What to look for:**
- If you see `CONFIG NULL` → Database wasn't updated
- If you see `NO PDF` → Migration didn't include PDF
- If you see `HAS PDF` → Database is correct, but form isn't loading it

### Check Migrations Applied

```sql
-- See if migrations were applied
SELECT * FROM _supabase_migrations 
WHERE name LIKE '%pdf%' OR name LIKE '04%' 
ORDER BY executed_at DESC 
LIMIT 10;
```

**If nothing appears** → Migrations haven't been applied to Supabase yet!

### JavaScript Console Inspection

After loading the form, run in browser console (F12):

```javascript
// Get the resume question from the loaded form
const q = window.questions?.find(q => q.label.includes('Resume')) || 
          Object.values(window).find(v => v?.label?.includes?.('Resume'));
          
if (q) {
  console.log("Resume Question Full Config:", JSON.stringify(q, null, 2));
  console.log("Accept Array:", q.config?.accept);
  console.log("Has .pdf:", q.config?.accept?.includes('.pdf'));
} else {
  console.log("Resume question not found in window");
}
```

---

## Decision Tree

```
┌─ Is PDF upload failing?
│
├─ YES → Browser shows "only .pdf, .docx... allowed"?
│  │
│  ├─ YES → Console shows "Has PDF: false"?
│  │  │
│  │  ├─ YES → Database not updated
│  │  │  └─ ACTION: Run migration 042 in Supabase SQL Editor
│  │  │
│  │  └─ NO → Form loading wrong config
│  │     └─ ACTION: Clear cache (Ctrl+Shift+Delete)
│  │
│  └─ NO → Different error?
│     └─ ACTION: Check console for error message
│
└─ NO → It works! 🎉
   └─ Status: PDF upload fixed
```

---

## Common Scenarios & Solutions

### Scenario 1: Migration Wasn't Applied

**Evidence:**
```
[FileUpload] "Resume" | Config: null | Has PDF: false
-- AND --
Database query shows: CONFIG NULL
```

**Fix:**
1. Go to Supabase SQL Editor
2. Run migration 042
3. Hard refresh browser (Ctrl+Shift+Delete)
4. Try again

### Scenario 2: Config Exists But No .pdf

**Evidence:**
```
[FileUpload] "Resume" | Config: {"accept":[".png",".jpg"]...} | Has PDF: false
-- AND --
Database query shows: NO PDF
```

**Fix:**
1. Go to Supabase SQL Editor
2. Run this update:
```sql
UPDATE form_questions
SET config = jsonb_set(config, '{accept}', '[ ".pdf", ".doc", ".docx", ".txt", ".jpg", ".jpeg", ".png" ]'::jsonb)
WHERE label ILIKE '%resume%' AND form_id IN (SELECT id FROM forms WHERE slug = 'job-applications');
```
3. Hard refresh browser
4. Try again

### Scenario 3: Database OK But Browser Cache Wrong

**Evidence:**
```
[FileUpload] "Resume" | Config: null | Has PDF: false
-- BUT --
Database query shows: HAS PDF
```

**Fix:**
1. Hard cache clear: **Ctrl+Shift+Delete** → All time → Clear data
2. Or use Private window
3. Reload form
4. Check console again

### Scenario 4: Some Other Validation Layer

**Evidence:**
```
[FileUpload] "Resume" | Config: {"accept":[...".pdf"...]} | Has PDF: true
-- BUT --
Still can't upload PDF
```

**This means:**
- Client-side validation is OK
- Server is rejecting it
- Check browser Network tab when uploading:
  - What error does the server return?
  - Is it a 400 Bad Request?
  - Is it "invalid_file_type"?

---

## What to Share With Me

If you're still stuck, collect this info and share:

### 1. Browser Console Output
```
Screenshot of console showing:
- [Form Load] line
- [FileUpload] "Resume" line
```

### 2. Database Query Result
```
From SQL Editor, the output of the database check above
(especially the pdf_status column)
```

### 3. Error Message
```
If upload fails, what's the exact error shown?
E.g., "only .pdf, .docx... allowed" vs "Invalid file type" vs something else
```

### 4. Browser & OS
```
E.g., Chrome 124 on Windows 11
Or Safari on MacOS 14
```

### 5. Steps Taken
```
Did you:
- Run migration? (Which one?)
- Hard refresh? (How?)
- Clear cache?
- Use incognito window?
```

---

## FAQ

**Q: Why does PNG work but PDF doesn't?**
A: PNG is in the `accept` array, PDF is not. That's why PNG passes client-side validation but PDF is rejected.

**Q: I'm using the defaults, why no PDF?**
A: The hardcoded defaults DO include `.pdf`. If you're using defaults, PDF should work. If it doesn't, the config is probably from the database, and it's outdated.

**Q: Will clearing cache break anything?**
A: No, it just forces the browser to reload form data fresh. Completely safe.

**Q: Does this require deploying new code?**
A: No! This is purely a database fix. Just update the database, clear cache, done.

**Q: How do I know if the migration applied?**
A: Run the database query check above. If `pdf_status` shows `HAS PDF`, it worked.

**Q: What if the query returns nothing?**
A: The form or question doesn't exist, or has a different slug/label than expected.

---

## Next Steps

1. **Take screenshot of browser console** after loading the form
2. **Run database check query** in Supabase SQL Editor
3. **Share both** with exact output
4. I'll tell you exactly what to fix

No guessing - we'll have concrete data.

