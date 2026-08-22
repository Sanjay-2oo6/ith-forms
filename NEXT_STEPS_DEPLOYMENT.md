# Google OAuth Implementation — Next Steps & Deployment Guide

## 📊 Current Status

✅ **Completed (5 Phases)**:
1. Database migrations (044 & 045 SQL files created)
2. RPC functions (get_submission_count_for_email, verify_google_email, modified submit_response)
3. Frontend auth routes (auth/callback.tsx)
4. Auth hooks (use-auth.ts with custom hooks)
5. Public form UI (auth header, submission status, per-email limit blocking)
6. Admin settings (per-email limit dropdown in SettingsTab)

⏳ **Pending**:
1. Run migrations in Supabase
2. Configure Google OAuth in Supabase
3. Local testing with `npm run dev`
4. Deploy to production

---

## 🚀 Deployment Steps

### Phase 1: Run Database Migrations (IN SUPABASE SQL EDITOR)

**Files to run (in order)**:
1. `supabase/migrations/044_google_oauth_schema.sql`
2. `supabase/migrations/045_google_oauth_rpcs.sql`

**Steps**:
1. Open Supabase Dashboard → Your Project → SQL Editor
2. Click "New Query"
3. Copy-paste the contents of `044_google_oauth_schema.sql`
4. Click "Run" (you should see "Success")
5. Create another query and paste `045_google_oauth_rpcs.sql`
6. Click "Run" (you should see "Success")

**Verify the migrations worked**:
```sql
-- Check verified_emails table exists
SELECT * FROM public.verified_emails LIMIT 1;

-- Check responses_per_email_limit column exists
SELECT responses_per_email_limit FROM public.forms LIMIT 1;

-- Test the new RPC (replace with a real form ID)
SELECT public.get_submission_count_for_email('YOUR_FORM_ID'::uuid, 'test@example.com');
```

---

### Phase 2: Configure Google OAuth in Supabase

**Steps**:

#### 2.1 Set up Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing one)
3. Enable "Google+ API"
4. Go to "Credentials" → Create OAuth 2.0 Client ID
   - Choose "Web application"
   - Add authorized redirect URIs:
     - Local: `http://localhost:3000/auth/callback`
     - Staging: `https://your-staging-domain.com/auth/callback`
     - Production: `https://your-production-domain.com/auth/callback`
   - Copy the **Client ID** and **Client Secret**

#### 2.2 Add Google to Supabase
1. Open Supabase Dashboard → Authentication → Providers
2. Find "Google" provider
3. Click "Enable"
4. Paste **Client ID** and **Client Secret** from Google Cloud
5. Make sure redirect URL template shows:
   ```
   https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback
   ```
6. Click "Save"

#### 2.3 Verify in Supabase
- You should see a green checkmark next to "Google"
- Test the OAuth flow locally before deploying

---

### Phase 3: Local Testing

**Prerequisites**:
- `.env` file has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` ✅ (already in place)
- Node.js and npm installed
- Google OAuth credentials configured in Supabase ✅ (from Phase 2)

**Steps**:

1. Install dependencies (if not already done):
   ```bash
   npm install
   ```

2. Start dev server:
   ```bash
   npm run dev
   ```

3. Open browser to `http://localhost:3000`

4. Test the flow:
   - ✅ Navigate to a published form URL (e.g., `/forms/my-form-slug`)
   - ✅ Click "Sign in with Google"
   - ✅ You should be redirected to Google login
   - ✅ After login, you should see your name/email in the form header
   - ✅ Fill out and submit the form
   - ✅ Check Supabase: 
     - `responses` table should have new row with your email
     - `verified_emails` table should show your email + submission_count = 1
   - ✅ Refresh the form page
   - ✅ You should see "You've already submitted" message
   - ✅ If form allows multiple submissions (per-email limit > 1), you should see "Submit Another Response" button

5. **Test the per-email limit**:
   - Create a test form with "Max responses per verified email" = 2
   - Submit twice with same Google account
   - On 3rd attempt, you should see "You've reached the limit"
   - `verified_emails.submission_count` should be 2
   - Check browser console for detailed logs (look for `[PublicForm]` messages)

6. **Test admin controls**:
   - Go to form settings
   - Change "Max responses per verified email" dropdown
   - Test that the limit is enforced properly

---

### Phase 4: Type Checking & Testing

**Run type checking**:
```bash
npm run typecheck
```
(Should pass with no errors)

**Run unit tests** (if applicable):
```bash
npm test
```

**Run E2E tests** (optional, requires E2E_ADMIN_EMAIL/PASSWORD):
```bash
npm run test:e2e
```

---

### Phase 5: Deploy to Staging

**Steps**:

1. **Update Google OAuth redirect URLs** (if using new staging domain):
   - Google Cloud Console → Credentials → OAuth Client
   - Add staging domain redirect URL
   - Supabase Dashboard → Authentication → Providers → Google
   - No changes needed (uses Supabase callback URL)

2. **Deploy frontend**:
   ```bash
   npm run build
   ```

3. **Verify build output**:
   - Check `.output/` folder has server & client files
   - No TypeScript errors in build

4. **Deploy to your hosting** (Netlify, Vercel, etc.):
   - Push to staging branch (if you use staging deployments)
   - CI/CD should run `npm run build` and deploy `.output/` folder
   - Verify `.env` variables are set in the hosting platform

5. **Test on staging**:
   - Navigate to your staging form URL
   - Test the full Google OAuth flow
   - Test submission and per-email limit enforcement
   - Check database (Supabase) for new rows

---

### Phase 6: Deploy to Production

**Steps**:

1. **Ensure everything works on staging** ✅

2. **Update production environment variables** (if domain changed):
   - No code changes needed (env vars auto-loaded from Supabase)

3. **Update Google OAuth redirect URL** (if production domain is different):
   - Google Cloud Console → Add production domain to authorized URIs

4. **Deploy to production**:
   ```bash
   npm run build
   # Then deploy .output/ to your production hosting
   ```

5. **Post-deployment verification**:
   - Test full Google OAuth flow on production
   - Check that submissions are recorded in Supabase
   - Monitor error logs for any issues
   - Test form with multiple different email accounts

---

## 🧪 Testing Checklist

Use this checklist to verify everything works before final deployment:

### Local Testing
- [ ] Dev server starts: `npm run dev`
- [ ] Form page loads at `/forms/$slug`
- [ ] "Sign in with Google" button appears
- [ ] Clicking button redirects to Google login
- [ ] After login, name/email appears in form header
- [ ] Form fields are auto-filled with Google data (if configured)
- [ ] Can submit form
- [ ] After submission, see "Already submitted" message
- [ ] `responses` table has new row
- [ ] `verified_emails` table has new row with submission_count = 1
- [ ] Page refresh keeps "Already submitted" message
- [ ] Can sign out (if "Sign out" button is present)
- [ ] Signing out hides "Already submitted" message

### Per-Email Limit Testing
- [ ] Create test form with per-email limit = 2
- [ ] Submit once with email A → submission_count = 1
- [ ] Submit again with email A → submission_count = 2
- [ ] Try to submit 3rd time with email A → see "limit reached" message
- [ ] Submit with email B → works fine (different email)
- [ ] Admin can change per-email limit in form settings
- [ ] Changing limit takes effect immediately (no cache)

### Admin Controls Testing
- [ ] Admin can see "Max responses per verified email" dropdown
- [ ] Dropdown options display correctly (Unlimited, 1, 2, 3, 5, 10)
- [ ] Selecting a limit saves to database
- [ ] Changing limit takes effect on next form submission

### Error Handling Testing
- [ ] Network error on Google login → shows error message
- [ ] Network error on form submission → shows error message
- [ ] Invalid form ID → shows form unavailable
- [ ] Closed form → shows closed message
- [ ] RPC fails → shows friendly error, not technical details

---

## 📝 Files Modified/Created

### Created Files
```
supabase/migrations/044_google_oauth_schema.sql     — DB schema + verified_emails table
supabase/migrations/045_google_oauth_rpcs.sql        — RPC functions for submission counting
src/routes/auth/callback.tsx                         — Google OAuth callback handler
src/lib/use-auth.ts                                  — Auth hooks (useAuth, useAuthSubmissionStatus)
NEXT_STEPS_DEPLOYMENT.md                             — This file
```

### Modified Files
```
src/routes/forms/$slug.tsx                           — Added auth UI + submission status
src/components/form-builder/SettingsTab.tsx          — Added per-email limit dropdown
README.md                                            — Updated with Google OAuth features
```

### Documentation Files
```
GOOGLE_OAUTH_IMPLEMENTATION_PLAN.md                  — High-level design & architecture
IMPLEMENTATION_PROGRESS.md                           — Phase-by-phase completion status
```

---

## 🔧 Troubleshooting

### "Sign in with Google" button doesn't work
- **Check**: Google OAuth provider enabled in Supabase Dashboard
- **Check**: Client ID and Client Secret are correct
- **Check**: Redirect URL in Google Cloud matches your domain
- **Fix**: Clear browser cache and retry

### After login, form is blank / doesn't load
- **Check**: Browser console for errors (Ctrl+Shift+K)
- **Check**: Network tab for failed API calls
- **Fix**: Check .env variables are correct
- **Debug**: Look for `[PublicForm]` log messages in console

### "Already submitted" appears but shouldn't
- **Check**: `verified_emails` table for that email/form combo
- **Check**: Did you test with the same email twice?
- **Fix**: Delete test row from `verified_emails` table:
  ```sql
  DELETE FROM public.verified_emails WHERE email = 'test@example.com';
  ```

### Per-email limit not enforced (can submit more than limit)
- **Check**: `responses_per_email_limit` column exists on forms table
- **Check**: Migration 045 ran successfully
- **Check**: Form's `responses_per_email_limit` is set (not NULL)
- **Debug**: Check RPC output:
  ```sql
  SELECT public.get_submission_count_for_email('YOUR_FORM_ID'::uuid, 'YOUR_EMAIL');
  ```
- **Fix**: Run migrations again if they didn't run properly

### "You've reached the limit" shows before reaching actual limit
- **Check**: `verified_emails.submission_count` matches actual count
- **Fix**: Compare with actual submissions in `responses` table
- **Debug**: Check for duplicate entries in `verified_emails`:
  ```sql
  SELECT email, form_id, COUNT(*) FROM public.verified_emails 
  GROUP BY email, form_id HAVING COUNT(*) > 1;
  ```

### Migrations won't run ("already exists" error)
- **Expected**: This is safe - migrations are idempotent
- **Fix**: Try creating a new query and running just the verification sections
- **Example**: Run this to check if verified_emails table exists:
  ```sql
  SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'verified_emails';
  ```

---

## 📞 Support & Questions

If you hit issues:
1. **Check browser console** for client-side errors
2. **Check Supabase logs** for server-side errors (Supabase Dashboard → Logs)
3. **Check RPC output** manually in SQL Editor
4. **Search IMPLEMENTATION_PROGRESS.md** for known issues
5. **Review AGENTS.md** for architecture context

---

## ✅ Success Criteria

You're done when:
- ✅ Google OAuth login works
- ✅ Per-email submission limits are enforced
- ✅ Admin can configure per-email limits
- ✅ Users see "Already submitted" message on revisit
- ✅ Users can submit again if under limit
- ✅ All TypeScript types pass (npm run typecheck)
- ✅ Form works on local, staging, and production

Congratulations on shipping this feature! 🎉
