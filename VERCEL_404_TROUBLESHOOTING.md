# Troubleshooting: 404 NOT_FOUND on Vercel

If you're getting a **404 NOT_FOUND** error after deploying to Vercel, this guide will help you fix it.

## Quick Diagnosis

The 404 error usually means one of these:

1. ❌ **Environment variables not set** (most common)
2. ❌ **Build succeeded but app can't initialize**
3. ❌ **Supabase connection failing**

## Fix #1: Check Environment Variables

**This is the most common cause.**

### Step 1: Go to Vercel Dashboard

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click your **ith-forms** project
3. Click **Settings** (top menu)
4. Click **Environment Variables** (left sidebar)

### Step 2: Verify Variables Exist

You should see:

```
VITE_SUPABASE_URL       = https://zkaeourngxwykkhapotj.supabase.co
VITE_SUPABASE_ANON_KEY  = eyJhbGciOiJIUzI1NiIs...
```

**If they're missing:**

1. Click **Add New Environment Variable**
2. Set `VITE_SUPABASE_URL` to your Supabase URL
3. Set `VITE_SUPABASE_ANON_KEY` to your anon key
4. Make sure the **Scope includes "Production"** ✅

### Step 3: Important - Check the Scope

⚠️ **Critical:** The variables must include the **Production** scope.

If you see "Preview" only, click the variable and add **Production** scope.

### Step 4: Redeploy

1. Go to **Deployments** tab
2. Find the latest deployment
3. Click the **⋮** (three dots) menu
4. Click **Redeploy**
5. Wait 2-5 minutes for the build to complete

## Fix #2: Check Build Logs

If variables are set but still getting 404:

### Step 1: View Build Logs

1. Go to **Deployments**
2. Click the latest deployment
3. Click **Logs** tab
4. Look for errors (especially near the top or bottom)

### Common Build Errors

**Error: "Cannot find module 'X'"**
- Solution: Commit `package-lock.json` to GitHub
- Then redeploy from Vercel

**Error: "VITE_SUPABASE_URL is undefined"**
- Solution: Environment variables aren't set (see Fix #1)

**Error: "ReferenceError: process is not defined"**
- Solution: Make sure you're using `import.meta.env.*` not `process.env.*`

## Fix #3: Test Supabase Connection

If build succeeded but app shows 404:

### Step 1: Test Health Endpoint

Open your browser console and run:

```javascript
fetch('https://your-vercel-url.vercel.app/health')
  .then(r => r.json())
  .then(d => console.log(d))
```

Should see:
```json
{
  "ok": true,
  "db": true,
  "ts": "2024-..."
}
```

If `"db": false`, your Supabase connection is failing.

### Step 2: Verify Supabase Credentials

1. Go to your Supabase dashboard
2. Click **Settings > API**
3. Verify the URL matches `VITE_SUPABASE_URL` in Vercel
4. Verify the key matches `VITE_SUPABASE_ANON_KEY` in Vercel
5. Make sure your Supabase project is **not paused**

## Fix #4: Clear Vercel Cache

Sometimes Vercel caches the old build:

1. Go to **Settings > Git**
2. Click **Clear Build Cache**
3. Go to **Deployments** and click **Redeploy** on the latest
4. Wait for rebuild

## Fix #5: Check Function URL

Make sure Vercel deployed the function correctly:

1. Go to **Deployments**
2. Click the deployment status
3. Look for a **Function Logs** section
4. If empty, the function wasn't deployed (go back to Fix #1)

## Verification Checklist

After applying fixes, verify:

- [ ] Environment variables set in Vercel (Settings > Environment Variables)
- [ ] Variables include **Production** scope
- [ ] Build succeeded (check Deployments > Logs)
- [ ] `/health` endpoint returns `"db": true`
- [ ] Can visit your Vercel URL (should show login page, not 404)
- [ ] Can log in with test credentials

## Still Not Working?

Try these debug steps:

### 1. Check Vercel Function Logs

In Vercel dashboard, go to:
- **Deployments > [latest] > Functions**
- Click the function (should be `.vercel/output/functions/index.js`)
- Look for errors in the logs

### 2. Test Supabase Directly

Open your browser DevTools and run:

```javascript
// Test if Supabase is reachable
const url = 'https://zkaeourngxwykkhapotj.supabase.co/rest/v1/forms?select=id&limit=1';
const key = 'your-anon-key-here';

fetch(url, {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
})
.then(r => console.log('Status:', r.status))
.catch(e => console.error('Error:', e))
```

If this fails, your Supabase is unreachable from Vercel.

### 3. Redeploy from Scratch

1. Delete the Vercel deployment
2. Go back to GitHub and make a small change (like adding a comment)
3. Push to `main` branch
4. Vercel will auto-redeploy from fresh

## Need More Help?

- Check `docs/deployment-vercel.md` for full deployment guide
- Check build logs first (99% of issues are there)
- Verify environment variables are set with correct values
- Make sure Supabase project is running (not paused)

---

**TL;DR:** Most 404 errors are fixed by:
1. Setting `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel
2. Making sure those variables have **Production** scope
3. Clicking **Redeploy** on the latest deployment
