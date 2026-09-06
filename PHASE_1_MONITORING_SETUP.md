# PHASE 1: Monitoring & Error Tracking Setup
## ITH Forms Production Deployment Guide

**Status**: Implementation complete — ready for deployment  
**Timeline**: 2–3 hours to production  
**Effort**: Setting env vars + deploying + testing

---

## ✅ What's Been Done

1. **Sentry Integration Added**
   - `src/lib/sentry.ts` — Browser + server initialization
   - Automatic error capture from React components
   - Network error tracking
   - Server-side exception logging
   - Session replay (on errors)
   - Performance monitoring (10% sampling)

2. **Structured Logging Added**
   - `src/lib/logger.ts` — Event tracking utilities
   - Pre-built functions for common events:
     - Form submissions
     - Rate limit violations
     - Email validation failures
     - File uploads
     - Admin actions
   - All logs go to console (Netlify/CloudWatch) + Sentry

3. **Dependencies Updated**
   - Added `@sentry/react`, `@sentry/node`, `@sentry/tracing` to package.json
   - Pinned to exact versions (^8.45.0)

4. **Environment Variables Documented**
   - Updated `.env.example` with Sentry DSN placeholders
   - `.env` ready for local setup (optional)

---

## 🚀 DEPLOYMENT CHECKLIST

### Step 1: Create Sentry Account & Project (10 minutes)

1. Go to **https://sentry.io**
2. Sign up (free tier is sufficient for MVP)
3. Create new organization (if needed)
4. Create new project:
   - Select **React** as platform
   - Name: `ith-forms-prod` (or similar)
   - Team: Your team
5. Copy your **DSN** (looks like):
   ```
   https://1234567890abcdef@12345.ingest.sentry.io/9876543
   ```
6. Save this — you'll need it in step 3

### Step 2: Install Dependencies (5 minutes)

Run locally (or will be installed on deployment):
```bash
npm install
```

This adds Sentry packages to node_modules.

### Step 3: Configure Environment Variables (5 minutes)

#### In Netlify Dashboard:

1. Go to **Site Settings** → **Build & Deploy** → **Environment**
2. Add two new environment variables:

   **For builds + browser (make visible to browsers):**
   - Key: `VITE_SENTRY_DSN`
   - Value: `https://your-key@your-org.ingest.sentry.io/your-project-id`
   - Scope: Builds, preview, production

   **For runtime/server-side only (not visible in browser):**
   - Key: `SENTRY_DSN`
   - Value: `https://your-key@your-org.ingest.sentry.io/your-project-id`
   - Scope: Production only

   ⚠️ **IMPORTANT**: The `VITE_` prefix for the browser one makes Vite inline it at build time. Do NOT add `VITE_SENTRY_DSN` to Scope `Production` only — it must be available at build time.

3. Save environment variables

4. **Trigger a redeploy** (either manually or via git push)

### Step 4: Verify Deployment (5 minutes)

1. Wait for build to complete (watch Deploys tab)
2. Visit your live site: `https://your-domain.com`
3. Open browser console (F12)
4. Look for message:
   ```
   [Sentry] Browser error tracking initialized
   ```
5. If you see this, Sentry is working! ✅

### Step 5: Test Error Logging (10 minutes)

#### Test Browser Error:

1. Go to admin dashboard: `/admin`
2. Open browser console (F12 → Console tab)
3. Paste and run:
   ```javascript
   throw new Error("Test Sentry error — this is intentional");
   ```
4. Wait 5 seconds
5. Go to **Sentry Dashboard** → **Issues** tab
6. You should see your error appear within ~30 seconds
7. Click on it to see:
   - Stack trace
   - Browser/OS info
   - Network requests leading up to error
   - Session replay (if enabled)

#### Test Email Validation Error:

1. In form submission flow, attempt to submit with mismatched email
   - Log in as user1@example.com
   - Try to submit form with user2@example.com
2. This triggers the audit log: `submit_response_email_mismatch`
3. Check Sentry dashboard → should show "email_validation_failed" event

#### Test Rate Limit:

1. Rapidly submit same form 10+ times in quick succession
2. 11th submission should fail with rate limit message
3. Check Sentry → should show "rate_limit_exceeded" event

### Step 6: Configure Sentry Alerts (Optional, 5 minutes)

In Sentry Dashboard:

1. Go to **Alerts** → **Create Alert Rule**
2. Create rule: "Send me email when error count > 5 in 1 hour"
3. Actions: Email to your inbox
4. This gives you proactive notifications if things break

### Step 7: Monitor Production (Ongoing)

**Daily checks** (first week):
- [ ] Visit Sentry dashboard
- [ ] Review any new errors
- [ ] Check error spike trends
- [ ] Review session replays if helpful

**Weekly checks**:
- [ ] Review weekly error report in Sentry
- [ ] Triage/close resolved issues
- [ ] Check performance metrics (10% sampling)

---

## 📊 What You'll See in Sentry

### Issues Dashboard
- Lists all unique errors (grouped by stack trace)
- Shows frequency, first/last seen, affected users
- Click to see details, stack trace, session replay

### Example Error Details:
```
ReferenceError: Cannot read property 'id' of undefined

Browser: Chrome 120 on Windows 11
URL: /admin/forms/123/responses
User: admin@example.com
Time: 2:34 PM UTC

Stack trace:
  at renderForm (forms.tsx:245)
  at setupFormBuilder (edit.tsx:108)
  at React.useEffect (react.ts:...)

Session replay: [Watch video of what user was doing]
```

### Performance Tab
- Shows average response times for key transactions
- Identifies slow pages/endpoints
- Useful for optimization priorities

---

## 🔍 How to Use Logs

### View Logs in Netlify:

1. Netlify Dashboard → **Logs** tab
2. Select your function (e.g., `react-start-server`)
3. Scroll through logs — you'll see JSON entries like:
   ```json
   {
     "timestamp": "2024-01-15T14:32:10.123Z",
     "level": "info",
     "event": "form_submission",
     "form_id": "abc-123",
     "respondent_email": "user@example.com",
     "reference_id": "DEMO-0001"
   }
   ```

### View Logs in Sentry:

1. Sentry Dashboard → **Issues** tab
2. Filter by event type (submission, rate_limit, etc.)
3. See all logs with structured metadata searchable

### Local Development Logs:

Run locally:
```bash
npm run dev
```

Logs appear in terminal:
```
[Sentry] Browser error tracking initialized
[Sentry] Server error tracking initialized
{"timestamp": "2024-01-15T...", "level": "info", "event": "form_submission", ...}
```

---

## 📝 Integration Points (Where Errors Are Logged)

The Sentry integration automatically captures:

1. **Browser Errors**
   - JavaScript exceptions
   - React component errors
   - Network request failures
   - Unhandled promise rejections

2. **Server Errors**
   - RPC function failures
   - Database connection errors
   - Middleware exceptions

3. **Structured Events** (logged manually):
   - `logFormSubmission()` — when form is submitted
   - `logRateLimitViolation()` — when rate limit exceeded
   - `logEmailValidationFailure()` — when email doesn't match session
   - `logFileUpload()` — when file is uploaded
   - `logAdminAction()` — when admin performs action

---

## 🚨 Important: Environment Variable Scopes

**Netlify has two deploy contexts:**
- **Build context**: When code is built (happens once per deploy)
- **Runtime context**: When function runs on server

**For Sentry:**

| Var | Scope | Why |
|-----|-------|-----|
| `VITE_SENTRY_DSN` | Builds, preview, prod | Browser needs this at runtime (compiled into JS bundle) |
| `SENTRY_DSN` | Production runtime | Server needs this when handling requests |

**If you get "Sentry not initialized" error:**
1. Check Netlify env vars are saved
2. Trigger a **new deploy** (env vars don't update existing builds)
3. Wait for build to complete
4. Visit site again

---

## 🔐 Security Notes

1. **Sentry DSNs are public-safe**
   - The public DSN is designed to be visible in frontend code
   - Sentry only accepts events from your configured project
   - Never put your Service Role Key in Sentry config

2. **No sensitive data logged**
   - Logs exclude passwords, emails (scrubbed by default)
   - Session replay masks input fields by default
   - Configure scrubbing in Sentry → Settings → Data Scrubbing

3. **Rate limiting**
   - Sentry free tier: 5,000 events/month
   - ITH Forms will use ~500–1000/month (1–2 errors per hour + some submissions)
   - If you exceed, events are dropped but site keeps working

---

## 🆘 Troubleshooting

### "Sentry not tracking errors"

**Check 1: Is DSN configured?**
```bash
# In Netlify dashboard, Environment tab
# Both VITE_SENTRY_DSN and SENTRY_DSN should be set
```

**Check 2: Is Sentry initialized?**
- Open browser console (F12)
- Look for `[Sentry] Browser error tracking initialized`
- If missing, DSN wasn't available at build time

**Check 3: Has the build deployed?**
- Netlify automatically rebuilds on env var change
- Check Deploys tab for in-progress builds
- Wait for build to complete before testing

### "Errors appear but no session replay"

Session replay only records when:
- An error occurs (replaysOnErrorSampleRate: 100%)
- OR randomly 10% of sessions (replaysSessionSampleRate: 10%)

To force replay collection:
1. In Sentry project settings
2. Search for "Session Replay"
3. Increase `replaysSessionSampleRate` to 0.5 (50%)
4. Note: Uses more quota

### "I see errors but want to ignore them"

Sentry automatically ignores some noise (browser extensions, ads).

To add custom ignore rules:
1. Sentry Dashboard → Settings → Inbound Filters
2. Add patterns for URLs/errors to ignore
3. Example: Ignore all 404s from `/static/*`

---

## ✅ SUCCESS CRITERIA

After deployment, you should see:

- [ ] Browser shows `[Sentry] Browser error tracking initialized` in console
- [ ] Sentry dashboard shows your project with 0 issues
- [ ] Test error appears in Sentry within 30 seconds
- [ ] Rate limit event logged to Sentry
- [ ] Email validation failure logged to Sentry
- [ ] Netlify logs show structured JSON entries for submissions

**If all checkmarks pass**: Production monitoring is working! 🎉

---

## 📞 Next Steps

After Sentry is working:

1. **PHASE 2** (next week): Add pagination for forms/responses tables
2. **PHASE 3** (week after): Refactor form builder component
3. **Ongoing**: Monitor Sentry dashboard daily first week, then weekly

---

## 📚 Resources

- **Sentry Docs**: https://docs.sentry.io/platforms/javascript/
- **React Integration**: https://docs.sentry.io/platforms/javascript/guides/react/
- **Node Integration**: https://docs.sentry.io/platforms/node/
- **Session Replay**: https://docs.sentry.io/product/session-replay/

---

**Questions?** Check the Sentry docs link above or review the code in:
- `src/lib/sentry.ts` — Initialization
- `src/lib/logger.ts` — Event logging
- `src/client.tsx` — Browser entry point
- `src/server.ts` — Server entry point
