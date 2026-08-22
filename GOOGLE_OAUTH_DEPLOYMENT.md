# Google OAuth + Per-Email Limits — Deployment Guide

## Pre-Deployment Checklist

### 1. Database Setup
- [ ] Run migration `044_google_oauth_schema.sql` in Supabase SQL Editor
- [ ] Run migration `045_google_oauth_rpcs.sql` in Supabase SQL Editor
- [ ] Verify tables created:
  ```sql
  SELECT tablename FROM pg_tables WHERE tablename='verified_emails';
  ```
- [ ] Verify column added:
  ```sql
  SELECT column_name FROM information_schema.columns 
    WHERE table_name='forms' AND column_name='responses_per_email_limit';
  ```

### 2. Google Cloud Setup
- [ ] Create/select project in Google Cloud Console
- [ ] Enable Google+ API
- [ ] Create OAuth 2.0 Client ID (Web application)
- [ ] Configure authorized redirect URIs:
  - Production: `https://<your-domain>.supabase.co/auth/v1/callback`
  - Staging: `https://staging-<your-domain>.supabase.co/auth/v1/callback`
  - Development: `http://localhost:3000/auth/v1/callback`
- [ ] Copy Client ID and Client Secret

### 3. Supabase Configuration
- [ ] Go to Supabase Dashboard → Authentication → Providers → Google
- [ ] Enable Google provider
- [ ] Paste Client ID from Google Cloud
- [ ] Paste Client Secret from Google Cloud
- [ ] Click "Save"
- [ ] Verify provider is enabled (green toggle)

### 4. Frontend Environment
- [ ] Update `.env`:
  ```env
  VITE_SUPABASE_URL=https://<your-project>.supabase.co
  VITE_SUPABASE_ANON_KEY=<your-anon-key>
  ```
  (No new variables needed — existing setup is sufficient)

### 5. Build & Test Locally
- [ ] Run `npm run typecheck` — should have no errors
- [ ] Run `npm run dev` — dev server starts without errors
- [ ] Test locally:
  - [ ] Navigate to public form: `http://localhost:3000/forms/<slug>`
  - [ ] Click "Sign in with Google" button
  - [ ] Google consent screen appears
  - [ ] After approval, redirected back to form
  - [ ] Name + email auto-filled
  - [ ] Submit form successfully
  - [ ] Message shows "You've already submitted"
  - [ ] Can see submission count displayed

---

## Deployment Steps

### Phase 1: Database Migrations (Production)
1. Go to Supabase Dashboard → SQL Editor
2. Run migration `044_google_oauth_schema.sql`:
   - Copy entire file
   - Paste into SQL Editor
   - Click "Run"
   - Verify: "Migration 044: Google OAuth schema - Complete" appears
3. Run migration `045_google_oauth_rpcs.sql`:
   - Copy entire file
   - Paste into SQL Editor
   - Click "Run"
   - Verify: "Migration 045: Google OAuth RPCs - Complete" appears
4. **Backup after migrations:**
   ```
   Supabase Dashboard → Backups → Manual backup
   ```

### Phase 2: Frontend Code (Staging)
1. Merge code to staging branch:
   - `src/routes/forms/$slug.tsx` (updated with auth UI)
   - `src/routes/auth/callback.tsx` (new OAuth callback)
   - `src/lib/use-auth.ts` (new auth hooks)
   - `src/components/form-builder/SettingsTab.tsx` (updated with per-email limit)
2. Deploy to staging environment
3. Verify build succeeds: `npm run build`
4. Test on staging:
   - [ ] Sign in with Google works
   - [ ] Form auto-fills user data
   - [ ] Per-email limit enforcement works
   - [ ] "Already submitted" message displays
   - [ ] Admin can set per-email limits in form settings

### Phase 3: Frontend Code (Production)
1. After staging validation, merge to main/production
2. Deploy to production
3. Monitor logs for errors
4. Test on production form

### Phase 4: Admin Configuration (Post-Deploy)
1. Create a test form
2. In form settings, set "Max responses per verified email" to 2
3. Publish form
4. Test with multiple Google accounts:
   - [ ] First submission succeeds
   - [ ] Second submission succeeds
   - [ ] Third submission is blocked with message
   - [ ] Shows "You've submitted 2 of 2 times"

---

## Rollback Plan (If Issues Arise)

### Option 1: Database Rollback (Supabase)
1. Go to Supabase Dashboard → Backups
2. Select backup from before migrations 044 + 045
3. Click "Restore"
4. Confirm restoration (this will revert DB schema)
5. Revert frontend code to previous commit
6. Re-deploy

### Option 2: Partial Rollback (Drop New Tables)
If only need to drop the new tables without full restore:
```sql
DROP TABLE IF EXISTS public.verified_emails CASCADE;
ALTER TABLE public.forms DROP COLUMN IF EXISTS responses_per_email_limit;
DROP FUNCTION IF EXISTS public.get_submission_count_for_email(uuid, text);
DROP FUNCTION IF EXISTS public.verify_google_email(uuid, text);
```

Then revert frontend code and re-deploy.

---

## Testing Checklist

### Unit Tests
- [ ] `useAuth()` hook returns null when not signed in
- [ ] `useAuth()` hook returns session when signed in
- [ ] `useAuthSubmissionStatus()` returns correct count/limit
- [ ] `get_submission_count_for_email()` RPC returns correct data
- [ ] `verify_google_email()` RPC creates verified_emails row
- [ ] `submit_response()` RPC enforces email limit

### Integration Tests
- [ ] User can sign in with Google
- [ ] User is redirected back to form after OAuth
- [ ] Name + email auto-fill from Google
- [ ] Submission count increments after each submit
- [ ] Error raised when limit reached
- [ ] Different emails can submit independently
- [ ] Admin can view submission counts in responses table

### E2E Tests (Manual)
1. **Test Case 1: Sign-in Flow**
   - Open form in incognito window
   - Click "Sign in with Google"
   - Approve OAuth consent
   - Verify redirected back to form
   - Verify name + email filled in
   - Result: ✅ or ❌

2. **Test Case 2: Single Submission**
   - Sign in with Google
   - Fill out form
   - Click Submit
   - Verify success message
   - Verify reference ID displayed
   - Result: ✅ or ❌

3. **Test Case 3: Revisit with Existing Submission**
   - Sign in with same Google account
   - Verify "You've already submitted" message
   - Verify submission count shown
   - Result: ✅ or ❌

4. **Test Case 4: Per-Email Limit (Limit = 2)**
   - Create form with limit 2
   - Submit with Email A (success)
   - Submit with Email A again (success)
   - Try to submit with Email A third time (blocked)
   - Verify error message
   - Submit with Email B (success)
   - Result: ✅ or ❌

5. **Test Case 5: Admin Controls**
   - Open form settings
   - Set "Max responses per verified email" to 3
   - Save
   - Verify limit is enforced for new submissions
   - Result: ✅ or ❌

6. **Test Case 6: Backward Compatibility**
   - Create old form (without per-email limit)
   - Verify limit is NULL (unlimited)
   - Submit multiple times with same email
   - Verify all submissions accepted
   - Result: ✅ or ❌

---

## Monitoring & Alerts

### Key Metrics to Monitor
- [ ] `verified_emails` table row count (should grow with submissions)
- [ ] `submit_response()` RPC error rate (watch for `email_limit_reached`)
- [ ] Google OAuth callback error rate
- [ ] Form submission success rate

### Logs to Check
1. **Supabase Logs** (Dashboard → Logs):
   - Search for `submit_response` errors
   - Search for `email_limit_reached` occurrences
   - Search for `verify_google_email` calls

2. **Browser Console** (Form Page):
   - Check for `[PublicForm]` logged messages
   - Check for `[useAuth]` logged messages
   - Check for `[auth/callback]` logged messages

3. **Errors**:
   - Failed OAuth redirects
   - RPC failures
   - Database constraint violations

---

## Documentation Updates

After deployment, update these documents:
- [ ] README.md — add Google OAuth to features section (already done)
- [ ] AGENTS.md — note per-email limits feature
- [ ] docs/security.md — add section on OAuth security
- [ ] docs/api-rpc.md — document new RPCs
- [ ] docs/database-schema.md — document `verified_emails` table

---

## Success Criteria

✅ **Feature is successful when:**
- Users can sign in with Google on public forms
- Form fields auto-populate from Google profile
- Admins can set per-email submission limits (1-10, unlimited)
- Submission count is enforced at the database level (RPC)
- Users see "Already submitted" message on revisit
- Users see "Submit Another Response" button if under limit
- Users see "No more submissions" if limit reached
- All submissions are tracked in `verified_emails` table
- Admins can see submission counts in responses table
- Backward compatible (existing forms work unchanged)
- No regression in existing functionality

---

## Support & Troubleshooting

### Common Issues

**Issue: Google sign-in button doesn't work**
- Check: Is Google provider enabled in Supabase?
- Check: Is redirect URI configured correctly?
- Solution: Verify OAuth credentials in Supabase → Authentication → Providers

**Issue: User signed in but form still shows "Sign in" button**
- Check: Is sessionStorage working in browser?
- Check: Is useAuth hook reading from sessionStorage?
- Solution: Open browser DevTools → Application → sessionStorage → look for `ith_forms_auth`

**Issue: Submission count not incrementing**
- Check: Is verified_emails table populated?
- Check: Is submit_response RPC updating the count?
- Solution: Query directly:
  ```sql
  SELECT * FROM public.verified_emails WHERE form_id = '<form-id>';
  ```

**Issue: Email limit not being enforced**
- Check: Is responses_per_email_limit set on form?
- Check: Are there RPC errors in logs?
- Solution: Verify form settings and check Supabase logs

---

## Post-Deployment Communication

### Admin Email Template
```
Subject: Forms now support Google Sign-in with per-email limits

We've deployed a new feature for your forms:

✨ What's New:
- Respondents can sign in with Google (one-click authentication)
- Form fields auto-populate with their name and email
- You can now limit how many times each person can submit

🎯 How to Use:
1. Create or edit a form
2. Go to Settings tab
3. Find "Max responses per verified email"
4. Select your limit (Unlimited, 1, 2, 3, 5, or 10)
5. Save and publish

📊 What You'll See:
- Submission responses show the respondent's verified email
- You can see how many times each person submitted
- Names auto-populate from Google profiles

❓ Questions? Contact support.
```

### User-Facing Message (Optional)
```
"Sign in with Google for a quick, secure way to submit this form. 
Your name and email will be automatically filled in."
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-08-22 | Initial release — Google OAuth + per-email limits |
