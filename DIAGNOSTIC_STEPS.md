# Diagnostic Steps to Debug HTTP 500 Error

The fact that you're still getting the error even after setting env vars and redeploying suggests one of these issues:

1. Env vars not set for **Production** environment
2. Env vars set but build cache not cleared
3. A different error is causing the 500 (not missing config)

---

## Step 1: Verify Env Vars in Vercel

1. Go to **https://vercel.com/dashboard**
2. Select **ith-forms** project
3. Go to **Settings** → **Environment Variables**
4. Look for these TWO variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

**CRITICAL:** For each variable, check that:
- ✅ The value is filled in (not empty)
- ✅ The **"Production"** checkbox is CHECKED ☑️
- ✅ The **"Preview"** checkbox is CHECKED ☑️ (optional but recommended)

If any are unchecked or missing, click "Edit" and fix them.

---

## Step 2: Force Clear Cache & Redeploy

Even with correct env vars, Vercel might use old cache.

1. Go to **Settings** → **Build & Development Settings**
2. Scroll down to **"Build Caching"** (if visible)
3. Click **"Clear Build Cache"** button (if available)
4. Go back to **Deployments** tab
5. Click latest deployment
6. Click **"..."** → **"Redeploy"**
7. Wait for status to show **"Ready"** ✅

---

## Step 3: Check the Deployment Build Logs

After redeploy completes:

1. Go to **Deployments** → Latest deployment
2. Click the deployment to open it
3. Look for **"Build Logs"** section
4. Search for these keywords:
   - "VITE_SUPABASE_URL" (should see it in logs)
   - "error" or "Error" (check for build errors)
   - "npm run build" (should complete successfully)

**What you should see:**
```
✓ npm run build completed successfully
```

**If you see errors:**
- Note the exact error message
- Share it with me

---

## Step 4: Check Runtime Logs

After deployment is "Ready":

1. Visit your app: **https://your-domain** (or click "Visit" in Vercel)
2. Open browser **DevTools** (F12)
3. Go to **Console** tab
4. Look for these messages:

**If you see:**
```
[Supabase Config] {
  configured: true,
  urlLength: 42,
  keyLength: 184,
  missing: []
}
```
→ ✅ Env vars loaded correctly

**If you see:**
```
[Supabase Config] {
  configured: false,
  urlLength: 0,
  keyLength: 0,
  missing: ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"]
}
```
→ ❌ Env vars still missing in Vercel build

---

## Step 5: Check Vercel Function Logs

If it's a deeper error:

1. Go to **Deployments** → Latest → Click deployment name
2. Look for **"Functions"** section
3. Click on **"__server.func"** or similar function
4. Click **"Runtime Logs"**
5. Look for error messages starting with `[UNCAUGHT ERROR]` or `[ERROR 500+]`

These logs will show the actual error from the server.

---

## What to Share If Still Stuck

If you're still getting 500 after these steps, please provide:

1. **Screenshot of Vercel Environment Variables** (Settings page)
   - Show that both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are there
   - Show the Production checkbox is checked

2. **Build log from latest deployment**
   - Deployments → Latest → Copy/paste the build output

3. **Runtime logs from the function**
   - Deployments → Latest → Functions → __server.func → Runtime Logs
   - Copy/paste any error messages

4. **Console output from browser** (F12 → Console)
   - Screenshot or copy/paste of console messages

With this information, I can diagnose exactly what's happening.

---

## Common Issues & Quick Fixes

| Issue | Fix |
|-------|-----|
| Env vars show blank values | Click "Edit", paste the values again, save |
| Production checkbox unchecked | Click "Edit", check "Production", save |
| Build says "cannot find variable" | Redeploy, wait 5 min, try again |
| Build logs show old date | Click "Clear Build Cache" then redeploy |
| Console shows "missing env vars" | Env vars not set in Vercel Settings |
| Console shows no messages | Clear browser cache (Ctrl+Shift+Del), reload |

---

## Quick Checklist

- [ ] Env vars set in Vercel Settings
- [ ] Both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY visible
- [ ] Production checkbox checked for both
- [ ] Build cache cleared
- [ ] Redeployed (status shows "Ready")
- [ ] Browser cache cleared
- [ ] Checked console for "[Supabase Config]" message
- [ ] If still 500, checked runtime logs for error message

If all checked and still failing, share the runtime logs and I'll dig deeper.
