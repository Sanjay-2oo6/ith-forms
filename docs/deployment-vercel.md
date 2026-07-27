# Deploy to Vercel

Step-by-step guide to deploy ITH Forms to Vercel.

## Prerequisites

✅ GitHub repository pushed (Sanjay-2oo6/ith-forms)
✅ Supabase project created with all migrations run
✅ Test admin account created
✅ Local `.env` file with credentials (NOT committed to Git)

## Step 1: Create Vercel Account & Project

1. Go to [vercel.com](https://vercel.com)
2. Click **Sign Up** (or log in if you have an account)
3. Choose **GitHub** as your sign-in method
4. Authorize Vercel to access your GitHub account
5. Click **Create New Project**
6. Select your GitHub organization
7. Find and select **ith-forms** repository
8. Click **Import**

## Step 2: Configure Build Settings

Vercel will auto-detect the framework (React + Vite). You should see:

- **Framework Preset**: `Vite` ✅ (correct)
- **Build Command**: `npm run build` ✅ (correct)
- **Output Directory**: `dist` ✅ (correct)
- **Install Command**: `npm install` ✅ (correct)

No changes needed here. Click **Deploy** (or continue to environment variables first).

## Step 3: Set Environment Variables ⚠️ IMPORTANT

Before deploying, you MUST set environment variables. These values are inlined at build time.

**Option A: Set Before Deploy (Recommended)**

1. On the import screen, click **Environment Variables**
2. Add these two variables:

| Key | Value | Notes |
|-----|-------|-------|
| `VITE_SUPABASE_URL` | `https://zkaeourngxwykkhapotj.supabase.co` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your anon public key | From Supabase Settings > API |

3. Leave `SUPABASE_SERVICE_ROLE_KEY` empty (not needed in production frontend)
4. Click **Deploy**

**Option B: Set After Deploy (if you forgot)**

1. Go to your Vercel project
2. Click **Settings** > **Environment Variables**
3. Add the two variables above
4. Click **Deployments** > **Select latest** > **Redeploy**

## Step 4: Wait for Build & Deploy

The build takes 2-5 minutes. You'll see:

```
✓ Build completed
✓ Deployed to production
```

Vercel provides a URL like: `https://ith-forms-xxxx.vercel.app`

## Step 5: Verify Deployment

1. Click the **Visit** button or go to your Vercel URL
2. You should see the login page
3. Log in with test credentials:
   - **Email**: `admin@test.local`
   - **Password**: `TestAdmin123!@#`
4. You should be in the admin dashboard

✅ If this works, deployment is successful!

## Step 6: Set Custom Domain (Optional)

1. In Vercel project settings, click **Domains**
2. Click **Add Domain**
3. Enter your domain (e.g., `forms.example.com`)
4. Follow DNS instructions for your domain registrar
5. Wait for DNS propagation (5-30 minutes)

## Production Checklist

Before going live, do this:

- [ ] Test form creation and publishing
- [ ] Test public form submission
- [ ] Test response viewing and export
- [ ] Change admin password (don't use test credentials)
- [ ] Update app settings (Settings > Application Settings)
- [ ] Set up monitoring/logging (optional)
- [ ] Backup Supabase database

## Updating Your App

Every time you push to `main` branch:

1. Vercel auto-detects the push
2. Builds and deploys automatically (CI/CD)
3. No manual intervention needed

**Deploy preview for pull requests:**
- Vercel creates preview URLs for each PR
- Test changes before merging to main
- Previews are automatically cleaned up after PR closes

## Environment Variables Explained

### Public (Safe in Frontend)
- `VITE_SUPABASE_URL` — Your Supabase API endpoint
- `VITE_SUPABASE_ANON_KEY` — Public anon key (RLS governs access, not secrecy)

These are inlined into the frontend code and visible in network requests. This is **intentional and safe** because:
- The anon key is public by design
- Row-Level Security (RLS) policies control data access
- Supabase enforces all security at the database level

### Private (Only Backend)
- `SUPABASE_SERVICE_ROLE_KEY` — Admin key for backend operations
- **NEVER expose this in the frontend**
- Not needed for this app (no backend admin operations)

## Troubleshooting

### Build Failed: "Cannot find module 'X'"

**Solution**: Run locally first to verify:
```bash
npm install
npm run build
```

If it works locally but fails on Vercel, try:
1. Clear Vercel cache: **Settings > Git > Clear Vercel Build Cache**
2. Redeploy

### "Configuration required" on deployed app

**Cause**: Environment variables not set

**Solution**:
1. Go to Vercel project **Settings > Environment Variables**
2. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
3. Go to **Deployments > Redeploy latest**

### Deployed app doesn't match local version

**Cause**: Environment variables weren't set at build time

**Solution**:
1. Set environment variables
2. Go to **Deployments**
3. Click the latest deployment's **⋮** menu
4. Click **Redeploy**

### Database connection errors after deploy

**Cause**: Wrong Supabase URL or key

**Solution**:
1. Verify values in `.env.local` match production
2. Check Supabase project is running (not paused)
3. Verify RLS policies are enabled

## Next Steps

- 📖 Read: [Vercel Docs](https://vercel.com/docs)
- 🔍 Monitor: Set up error tracking (Sentry, LogRocket)
- 🛡️ Security: Enable 2FA on Vercel and Supabase
- 📊 Analytics: Monitor traffic and performance

---

## Questions?

- Check `docs/` folder for architecture details
- See `AGENTS.md` for technical overview
- Check GitHub issues for known problems
