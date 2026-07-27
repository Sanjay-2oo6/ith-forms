# Deployment Checklist

Before deploying to Vercel, run through this checklist.

## Pre-Deployment (Local Testing)

- [ ] All migrations run successfully (001-005)
- [ ] Test admin account created and working
- [ ] Can log in locally with test credentials
- [ ] Can create a form
- [ ] Can publish a form
- [ ] Can view public form (public link works)
- [ ] Can submit a response
- [ ] Can view responses in admin dashboard
- [ ] Settings page works (can change app name)
- [ ] No console errors in browser DevTools
- [ ] No errors in `npm run typecheck`
- [ ] Unit tests pass: `npm test`
- [ ] Build succeeds locally: `npm run build`

## Vercel Setup

- [ ] GitHub account connected to Vercel
- [ ] Repository pushed to GitHub (Sanjay-2oo6/ith-forms)
- [ ] Vercel project created and connected to GitHub
- [ ] Build settings configured:
  - [ ] Framework: `Vite`
  - [ ] Build command: `npm run build`
  - [ ] Output directory: `dist`
  - [ ] Node version: `20.x`

## Environment Variables (Vercel)

- [ ] `VITE_SUPABASE_URL` set to your Supabase project URL
- [ ] `VITE_SUPABASE_ANON_KEY` set to your anon public key
- [ ] Variables are in **Build** scope (not just Runtime)
- [ ] NO service-role key in Vercel environment variables

## Post-Deployment

- [ ] Build completed successfully on Vercel
- [ ] Deployment shows "Ready"
- [ ] Can access deployed URL (vercel.app domain)
- [ ] Login page loads
- [ ] Can log in with test credentials
- [ ] Admin dashboard loads
- [ ] Can view forms list
- [ ] Can create a test form
- [ ] Can publish test form
- [ ] Can submit response to public form
- [ ] Can view response in admin dashboard

## Before Going Live

- [ ] Change admin password (don't use `TestAdmin123!@#`)
- [ ] Update app settings:
  - [ ] Application name
  - [ ] Organization name
  - [ ] Powered-by text
  - [ ] Default appearance
  - [ ] Default confirmation message
- [ ] Test all form types:
  - [ ] Text input
  - [ ] Multiple choice
  - [ ] Checkboxes
  - [ ] File upload
  - [ ] Rating scale
  - [ ] Date picker
  - [ ] Long text
- [ ] Test form settings:
  - [ ] Response limits
  - [ ] Form scheduling (opens_at/closes_at)
  - [ ] Consent text
  - [ ] Confirmation message
- [ ] Test response management:
  - [ ] Filter responses
  - [ ] Update status
  - [ ] Add notes
  - [ ] Export to Excel
  - [ ] Delete response
- [ ] Test error handling:
  - [ ] Submit invalid form
  - [ ] Test network error recovery
  - [ ] Try large file upload (should reject > 50 MB)
- [ ] Security checks:
  - [ ] RLS policies working (can't access other forms)
  - [ ] Anon users can only see published forms
  - [ ] Anon users can't edit forms
  - [ ] Admin can see all forms

## Monitoring & Support

- [ ] Set up error tracking (optional):
  - [ ] Sentry for error monitoring
  - [ ] LogRocket for user session replay
- [ ] Enable Vercel Analytics (free tier available)
- [ ] Set up uptime monitoring (optional)
- [ ] Document admin login process for team

## Backup & Disaster Recovery

- [ ] Backup Supabase database regularly
- [ ] Have rollback plan if deployment fails
- [ ] Know how to revert on Vercel (one click)
- [ ] Keep local `.env` file secure

---

## Common Issues & Quick Fixes

| Issue | Fix |
|-------|-----|
| "Configuration required" error | Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel |
| Build fails with "Cannot find module" | Verify package.json, run `npm install` locally |
| Deployed app shows blank page | Check browser console, verify Supabase URL |
| Forms don't load | Verify RLS policies are enabled in Supabase |
| Can't log in | Verify test admin was created and is_active = true |

---

## Need Help?

1. Check `docs/deployment-vercel.md` for detailed steps
2. Review `AGENTS.md` for architecture overview
3. Check `docs/` folder for specific topics
4. See GitHub issues for known problems
