# Quick Sentry Setup (5 Minutes)

Copy this and follow along! ✅

---

## ☐ Step 1: Create Sentry Account (2 min)

- [ ] Go to: https://sentry.io
- [ ] Click **Sign Up**
- [ ] Email: `innotechhub.edu@gmail.com`
- [ ] Password: (choose one)
- [ ] Click **Create Account**
- [ ] Verify email (check inbox)

---

## ☐ Step 2: Create Project (1 min)

- [ ] Click **Create Project**
- [ ] Select **Node.js**
- [ ] Project name: `ITH Forms`
- [ ] Click **Create Project**

---

## ☐ Step 3: Copy DSN (30 sec)

You'll see something like:
```
https://xxxxx@sentry.io/12345
```

- [ ] **Copy the entire DSN URL**
- [ ] Save it somewhere (you'll paste it next)

---

## ☐ Step 4: Add to Vercel (1 min)

Go to: https://vercel.com/dashboard

1. Click your **ITH Forms** project
2. Click **Settings** (top)
3. Click **Environment Variables** (left)
4. Click **+ Add New**

**Add Variable 1:**
```
Name:  VITE_SENTRY_DSN
Value: (paste your DSN from Step 3)
Envs:  Production
```
Click **Add**

**Add Variable 2:**
```
Name:  SENTRY_DSN
Value: (paste same DSN)
Envs:  Production
```
Click **Add**

---

## ☐ Step 5: Redeploy (1 min)

1. Click **Deployments** (top)
2. Find latest deployment
3. Click **•••** (3 dots)
4. Click **Redeploy**
5. Wait for ✓ Ready (2-3 min)

---

## ☐ Step 6: Verify (2 min)

1. Open your deployed app
2. Press **F12** (open console)
3. Look for: `[Sentry] Browser error tracking initialized`
4. If you see it → ✅ **DONE!**

---

## ✅ Verify Working (Optional)

1. In console, run:
   ```javascript
   throw new Error("Test")
   ```
2. Go to https://sentry.io
3. Click your project → Issues
4. Should see your error ✅

---

## 🎉 You're Done!

Sentry is now tracking all errors from your app. Cost: **FREE** 🚀

Need help? See `SENTRY_SETUP_GUIDE.md` for detailed steps.
