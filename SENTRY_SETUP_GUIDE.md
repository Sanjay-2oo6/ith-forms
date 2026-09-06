# Sentry Setup Guide - Step by Step

## 📋 What You'll Do (5 minutes total)

1. Create Sentry account
2. Create ITH Forms project
3. Copy your DSN
4. Add DSN to Vercel env vars
5. Redeploy on Vercel
6. Verify it works

---

## Step 1: Create Sentry Account

### 1.1 Go to Sentry
```
https://sentry.io
```

### 1.2 Click "Sign Up"
Look for blue "Sign Up" button top right

### 1.3 Fill in form
```
Email:    innotechhub.edu@gmail.com
Password: (your choice)
```

### 1.4 Click "Create Account"

### 1.5 Verify Email
- Check your email inbox
- Click the verification link from Sentry
- You're logged in! ✅

---

## Step 2: Create ITH Forms Project

### 2.1 After login, you'll see "Create Project" button
Click it

### 2.2 Select Platform
Scroll and find: **Node.js**
Click it

### 2.3 Project Details
```
Project name: ITH Forms
Platform:     Node.js
```

### 2.4 Click "Create Project"

---

## Step 3: Get Your DSN

After creating project, you'll see a page like:

```
Installation Instructions

Include this DSN in your app:

https://xxxxxxxxxxxxxxxx@sentry.io/1234567890
```

### 3.1 Copy the DSN URL
- Click on the DSN (or triple-click to select)
- Copy it: Ctrl+C
- Save it somewhere temporarily (we'll use it next)

**Your DSN looks like:**
```
https://xxxxxxxxxxxxx@sentry.io/1234567890
```

---

## Step 4: Add to Vercel Environment Variables

### 4.1 Open Vercel Dashboard
```
https://vercel.com/dashboard
```

### 4.2 Select ITH Forms Project
Click on your project name

### 4.3 Go to Settings
Click "Settings" tab at the top

### 4.4 Click "Environment Variables"
On the left sidebar, find "Environment Variables"

### 4.5 Add First Variable

Click "+ Add New" or "Add Environment Variable"

Fill in:
```
Name:          VITE_SENTRY_DSN
Value:         (paste your DSN from Step 3)
Environments:  Select "Production" (check the box)
```

Click "Save" or "Add"

### 4.6 Add Second Variable

Click "+ Add New" again

Fill in:
```
Name:          SENTRY_DSN
Value:         (paste same DSN again)
Environments:  Select "Production"
```

Click "Save" or "Add"

**Result**: You should see both variables in the list ✅

---

## Step 5: Redeploy on Vercel

### 5.1 Go to Deployments
Click "Deployments" tab (top of Vercel page)

### 5.2 Find Latest Deployment
Should see a list like:
```
Deployment 1 - main - just now - ✓ Ready
Deployment 2 - main - 1 day ago - ✓ Ready
```

### 5.3 Click the 3-dot menu (•••)
On the latest deployment row, click the three dots on the right

### 5.4 Click "Redeploy"
From dropdown, select "Redeploy"

**Vercel will rebuild your app with new env vars**

Wait 2-3 minutes for build to finish. You'll see:
```
Status: ✓ Ready
```

---

## Step 6: Verify Sentry Works

### 6.1 Open Your App

Go to your deployed app URL (from Vercel dashboard)

### 6.2 Open Browser Console
Press **F12** (or right-click → Inspect → Console tab)

### 6.3 Look for Sentry Message
You should see in console:
```
[Sentry] Browser error tracking initialized
```

If you see it → ✅ **SUCCESS!**

### 6.4 Test Error Capture

In the browser console, paste and run:
```javascript
throw new Error("Test error from Sentry")
```

Press Enter. You'll see the error in console (that's normal).

### 6.5 Verify in Sentry Dashboard

1. Go to: https://sentry.io
2. Click your **ITH Forms** project
3. Click **Issues** (left sidebar)
4. Wait 10-30 seconds
5. You should see your "Test error" appear ✅

If you see it → **Sentry is working perfectly!** 🎉

---

## 🎉 You're Done!

Sentry is now tracking all errors from your app.

### What Happens Now?

- ✅ Every error in your app is automatically captured
- ✅ Errors appear in your Sentry dashboard
- ✅ You get real-time alerts
- ✅ You can debug issues faster
- ✅ 100% FREE (under 5K errors/month)

---

## Troubleshooting

### Issue: Sentry message NOT in console

**Solution:**
1. Check Vercel env vars are set correctly
2. Check you redeployed (deployment status = "Ready")
3. Hard refresh your app: Ctrl+Shift+R
4. Try again

### Issue: Error not appearing in Sentry dashboard

**Solution:**
1. Wait 30 seconds (it's not instant)
2. Refresh Sentry dashboard (F5)
3. Check you're in the right project
4. Check the "Issues" tab (not "Events")

### Issue: Can't find "Environment Variables" in Vercel

**Solution:**
1. Make sure you're in the project (not dashboard)
2. Look for "Settings" tab at top
3. Then "Environment Variables" on left sidebar
4. If still stuck, Google "Vercel environment variables" for current UI

---

## Next Steps

Now that Sentry is set up:

1. **Monitor your app** - Watch for errors in Sentry
2. **Fix bugs** - Use Sentry to debug production issues
3. **Add more projects** - Later, add your other apps to same Sentry account
4. **Scale** - All stay FREE as long as under 5K errors each

---

## Questions?

Check:
- `PHASE_1_MONITORING_SETUP.md` - More details on Sentry
- `DEPLOYMENT_READY.md` - Full deployment guide
- https://docs.sentry.io - Official Sentry docs

---

**Setup complete! Your app is now production-ready with error tracking.** 🚀
