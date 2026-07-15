# 🔧 Data Logic Fixes - Deployment Guide

## Overview

This deployment fixes **8 critical data-logic bugs** where the UI appeared correct but underlying data handling was broken. All fixes are **pixel-identical** - no visual changes, only functional improvements.

---

## 📦 What's Been Fixed

### CRITICAL
- **B3:** File upload now has per-question configuration (accepted types, max files, size limits)

### HIGH  
- **B1:** Linear scale supports configurable ranges (not hardcoded 1-10)
- **B4:** Checkbox answers use `||` delimiter (fixes comma-in-label corruption)

### MEDIUM
- **B2:** Server validates rating/scale values (rejects "99" for 1-5 scale)
- **B6:** Yes/no stored as "yes"/"no" (lowercase, consistent)
- **B7:** Phone validation accepts common formats (+1-555-1234, (555) 123-4567)
- **B9:** File MIME type validated (not just extension - prevents spoofing)

### LOW
- **B8:** Email validation requires TLD (rejects user@domain without .com)

---

## 🚀 Deployment Steps

### Step 1: Run Database Migrations (REQUIRED)

**In order, run these 5 migrations in Supabase SQL Editor:**

#### Migration 015 - File Upload Configuration
```
File: supabase/migrations/015_file_upload_configuration.sql
```
- Adds `file_config` jsonb column to `form_questions`
- Sets default configurations for existing file upload questions
- Updates `register_submission_file` RPC to validate MIME types

#### Migration 016 - Linear Scale Configuration  
```
File: supabase/migrations/016_linear_scale_configuration.sql
```
- Adds `scale_min` and `scale_max` columns to `form_questions`
- Sets defaults: rating (1-5), linear_scale (1-10)
- Adds check constraints for valid ranges

#### Migration 017 - Fix Checkbox Delimiter
```
File: supabase/migrations/017_fix_checkbox_delimiter.sql
```
- Converts existing checkbox answers from `,` to `||` delimiter
- Prevents corruption when option labels contain commas
- Adds `parse_checkbox_value()` helper function

#### Migration 018 - Validate Scale Values
```
File: supabase/migrations/018_validate_scale_values.sql
```
- Updates `submit_response` RPC to validate rating/scale values
- Rejects values outside configured min/max range
- Prevents data corruption from invalid inputs

#### Migration 019 - Normalize Yes/No Values
```
File: supabase/migrations/019_normalize_yes_no_values.sql
```
- Converts existing "Yes"/"No" to "yes"/"no" (lowercase)
- Ensures consistent querying and reporting
- No functional change, just standardization

**How to run:**
1. Open Supabase Dashboard → SQL Editor
2. Open migration file (015, 016, 017, 018, 019)
3. Copy entire contents
4. Paste into SQL Editor
5. Click "Run"
6. Wait for "Success" message
7. Repeat for next migration

---

### Step 2: Deploy Frontend Changes

The following files have been updated:

#### Modified Files:
1. `src/lib/validation.ts`
   - Updated `fileCheck()` with config support
   - MIME type validation for documents
   - Rejects generic/missing MIME types

2. `src/routes/forms/$slug.tsx`
   - Added `file_config`, `scale_min`, `scale_max` to Question type
   - Updated field rendering for all question types
   - Enhanced validation for email, phone, rating, scale
   - Fixed checkbox delimiter (`,` → `||`)
   - Fixed yes/no values (uppercase → lowercase)
   - File uploader enforces max files limit

**Deploy:**
```bash
# Build production bundle
npm run build

# Deploy to your hosting (Cloudflare Pages, Vercel, etc.)
# Example for Cloudflare:
npm run deploy

# Or if using Nitro directly:
npm run preview  # test locally first
```

---

## ✅ Post-Deployment Verification

### Test 1: File Upload (B3, B9)
- [ ] Create form with document upload question
- [ ] Upload valid PDF → succeeds
- [ ] Upload .exe renamed to .pdf → rejected (MIME type check)
- [ ] Upload 6th file when max is 5 → rejected
- [ ] See error message about file limit

**Expected:** File type and count limits enforced

---

### Test 2: Linear Scale (B1)
- [ ] Edit form with linear_scale question
- [ ] Check database: `scale_min=1`, `scale_max=10` (existing forms)
- [ ] Public form shows buttons 1,2,3...10
- [ ] Submit and verify stored value is in range

**Expected:** Dynamic button range based on config

---

### Test 3: Rating Validation (B2)
- [ ] Open form with rating question (1-5)
- [ ] Open DevTools console
- [ ] Try to manipulate submission: set rating value to "99"
- [ ] Submit form
- [ ] See error: "A rating or scale value is invalid"

**Expected:** Server rejects out-of-range values

---

### Test 4: Checkbox with Commas (B4)
- [ ] Create checkbox question
- [ ] Add options: "Apples", "Bananas, Plantains", "Oranges"
- [ ] Select "Bananas, Plantains" and "Oranges"
- [ ] Submit form
- [ ] Check database: `value = "Bananas, Plantains||Oranges"`
- [ ] View response in admin → both options shown correctly

**Expected:** Comma in label doesn't break parsing

---

### Test 5: Yes/No Storage (B6)
- [ ] Submit form with yes/no question
- [ ] Select "Yes"
- [ ] Check database: `submission_answers.value = "yes"` (lowercase)
- [ ] Old submissions also show lowercase after migration 019

**Expected:** All yes/no values are lowercase

---

### Test 6: Phone Validation (B7)
- [ ] Open form with phone field
- [ ] Try these formats:
  - `+1-555-123-4567` → valid ✓
  - `(555) 123-4567` → valid ✓
  - `555.123.4567` → valid ✓
  - `+1 555 123 4567` → valid ✓
  - `abc` → invalid ✗

**Expected:** Common phone formats accepted

---

### Test 7: Email Validation (B8)
- [ ] Open form with email field
- [ ] Try: `user@domain.com` → valid ✓
- [ ] Try: `user@domain` → invalid ✗ (no TLD)
- [ ] Try: `user@` → invalid ✗
- [ ] Try: `@domain.com` → invalid ✗

**Expected:** Requires proper email with TLD

---

## 🔍 Verification Queries

Run these in Supabase SQL Editor to verify migrations:

```sql
-- Check file_config column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'form_questions' 
AND column_name IN ('file_config', 'scale_min', 'scale_max');

-- Check existing file configs
SELECT id, label, type, file_config 
FROM form_questions 
WHERE type IN ('file', 'document', 'image')
LIMIT 5;

-- Check scale configurations
SELECT id, label, type, scale_min, scale_max 
FROM form_questions 
WHERE type IN ('rating', 'linear_scale')
LIMIT 5;

-- Check checkbox delimiter conversion
SELECT sa.value, fq.label
FROM submission_answers sa
JOIN form_questions fq ON fq.id = sa.question_id
WHERE fq.type = 'checkbox'
AND sa.value LIKE '%||%'
LIMIT 5;

-- Check yes/no normalization (should be lowercase)
SELECT DISTINCT sa.value, COUNT(*) as count
FROM submission_answers sa
JOIN form_questions fq ON fq.id = sa.question_id
WHERE fq.type = 'yes_no'
GROUP BY sa.value;
-- Should only see "yes" and "no" (lowercase)

-- Test scale validation (should fail)
SELECT submit_response(
  (SELECT id FROM forms WHERE status = 'published' LIMIT 1),
  'Test',
  'test@example.com',
  gen_random_uuid(),
  jsonb_build_array(
    jsonb_build_object(
      'question_id', (SELECT id FROM form_questions WHERE type = 'rating' LIMIT 1),
      'value', '99'
    )
  )
);
-- Expected: ERROR - scale_value_out_of_range
```

---

## 🚨 Rollback Plan

If issues arise, rollback in reverse order:

### Rollback Migrations
```sql
-- Rollback 019 (yes/no normalization)
UPDATE submission_answers sa
SET value = initcap(value)  -- Capitalize first letter
FROM form_questions fq
WHERE fq.id = sa.question_id AND fq.type = 'yes_no';

-- Rollback 018 (scale validation) - revert function
-- Re-run migration 005_security_hardening.sql to restore original submit_response

-- Rollback 017 (checkbox delimiter)
UPDATE submission_answers sa
SET value = replace(value, '||', ',')
FROM form_questions fq
WHERE fq.id = sa.question_id AND fq.type = 'checkbox';

-- Rollback 016 (scale config)
ALTER TABLE form_questions DROP COLUMN IF EXISTS scale_min;
ALTER TABLE form_questions DROP COLUMN IF EXISTS scale_max;

-- Rollback 015 (file config)
ALTER TABLE form_questions DROP COLUMN IF EXISTS file_config;
-- Re-run migration 005 to restore original register_submission_file
```

### Rollback Frontend
```bash
# Revert to previous commit
git revert HEAD
npm run build
npm run deploy
```

---

## 📊 Impact Assessment

### Data Changes
- **Existing data modified:** Only formatting (checkbox delimiter, yes/no case)
- **Data meaning preserved:** ✅ No data loss
- **Queries affected:** Yes/no queries should use lowercase now
- **Reports affected:** Checkbox parsing logic needs `||` instead of `,`

### Breaking Changes
- ⚠️ If you have custom scripts parsing checkbox answers with `,` split, update to `||`
- ⚠️ If you have reports filtering on `"Yes"` or `"No"` (capitalized), update to lowercase

### Non-Breaking Changes
- ✅ All frontend fixes are backward compatible
- ✅ New validation doesn't affect existing valid data
- ✅ File config is optional (defaults to current behavior)

---

## 🐛 Known Issues / Limitations

1. **File MIME type validation is client-side:** Browser reports MIME type, which can still be spoofed. Server validation added but relies on browser's MIME detection.

2. **Phone validation is format-only:** Doesn't verify if number is real/working. For that, integrate a phone verification API.

3. **Email validation doesn't check MX records:** Validates format only, not if domain accepts email. Add server-side MX lookup for stronger validation.

4. **Scale range can't be configured in UI yet:** You can set `scale_min`/`scale_max` in database, but form builder UI doesn't have input fields for this yet. (Future enhancement)

5. **File config can't be set in form builder UI yet:** You can set `file_config` in database, but form builder doesn't have UI for this yet. (Future enhancement)

---

## 🔮 Future Enhancements

These bugs are fixed, but here are related improvements to consider:

1. **Form Builder UI for File Config:** Add UI to configure accepted file types, max files, and size per question

2. **Form Builder UI for Scale Range:** Add min/max inputs when creating rating/linear_scale questions

3. **Real-time File Size Check:** Show upload progress and size before submitting

4. **Phone Number Library:** Integrate `libphonenumber-js` for international format validation

5. **Email MX Verification:** Server-side DNS lookup to verify domain accepts email

6. **File Magic Number Validation:** Server-side binary analysis to truly verify file type (not just MIME)

---

## ✅ Deployment Checklist

Before deploying:
- [ ] All 5 migrations tested in staging environment
- [ ] Frontend builds without errors
- [ ] Existing forms still render correctly
- [ ] New forms with various question types tested
- [ ] File upload tested with multiple file types
- [ ] Scale questions tested with custom ranges
- [ ] Checkbox questions with comma-containing labels tested
- [ ] Yes/no questions submit and display correctly
- [ ] Phone/email validation tested with edge cases
- [ ] Database backup taken before migrations

After deploying:
- [ ] All verification tests passed
- [ ] User-facing forms load correctly
- [ ] Admin dashboard shows correct data
- [ ] No console errors in browser
- [ ] Server logs show no new errors
- [ ] Performance metrics unchanged

---

## 📞 Support

If you encounter issues:

1. **Check browser console** for client-side errors
2. **Check server logs** for database/RPC errors
3. **Run verification queries** to check data integrity
4. **Review migration output** for any failed steps
5. **Test in incognito mode** to rule out cache issues

**All bugs fixed! Ready for production deployment.** 🚀

---

**Deployment Date:** _____________  
**Deployed By:** _____________  
**Version:** 1.1.0-data-fixes  
**Status:** ✅ Ready
