# ⚡ QUICK START - 50 Test Job Applications

## 3-Step Setup

### Step 1: Apply Database Fix
```
1. Open: https://app.supabase.com/
2. Select your project
3. Click: SQL Editor → New Query
4. Copy & paste: supabase/migrations/030_fix_submit_response_schema.sql
5. Click: RUN ✅
```

### Step 2: Generate Test Data
```
1. Click: SQL Editor → New Query (again)
2. Copy & paste: supabase/migrations/031_generate_test_submissions.sql
3. Click: RUN ✅
4. Wait for success message
```

### Step 3: Verify in Admin Dashboard
```
1. Open: https://ith-form.netlify.app/admin/login
2. Log in with your admin email/password
3. Click: Dashboard or Forms
4. Find: "Job Application" form
5. Click: View Responses
6. See: 50 test submissions ✅
```

---

## What You'll See

- **50 unique names** (John Smith, Jane Johnson, etc.)
- **50 unique emails** (firstname.lastname@test.com)
- **Reference IDs** (JOB-APP-00001 to JOB-APP-00050)
- **Years of Experience** (0 to 20 years, randomized)
- **Why good fit** (10 different realistic answers)
- **Realistic timestamps** (spread across dates)

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Script errors | Apply Migration 030 first |
| No data shows | Refresh browser, check form is published |
| 0% success rate | Verify Migration 030 applied |
| Can't find responses | Clear browser cache (Ctrl+Shift+Del) |

---

## Files Used

- `supabase/migrations/030_fix_submit_response_schema.sql` — Database fix
- `supabase/migrations/031_generate_test_submissions.sql` — Test data generator

---

## Done! 🎉

You now have 50 test job applications in your system ready for testing responses, filters, exports, and admin workflows.

**Next:** Check admin dashboard at https://ith-form.netlify.app/admin/login
