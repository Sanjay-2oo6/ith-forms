# Quick Start Guide

Get ITH Forms running in 5 minutes.

## Prerequisites

✅ Node.js 18+ installed
✅ Supabase account (supabase.com)
✅ Git

## Step 1: Clone & Install (1 min)

```bash
git clone https://github.com/Sanjay-2oo6/ith-forms.git
cd ith-forms
npm install
```

## Step 2: Set Up Environment (2 min)

1. Create `.env` file in root:

```bash
cp .env.example .env
```

2. Update `.env` with your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Where to find these:**
- Go to your Supabase project
- Settings > API
- Copy `Project URL` and `anon public` key
- Copy `service_role` key (service role secret)

## Step 3: Run Migrations (1 min)

In Supabase SQL Editor, run these **in order**:

1. `supabase/migrations/001_schema_and_functions.sql`
2. `supabase/migrations/002_rls_and_storage.sql`
3. `supabase/migrations/003_indexes_and_grants.sql`

## Step 4: Create Test Admin (1 min)

```bash
node scripts/create-test-admin.mjs
```

This will:
- Create auth user: `admin@test.local`
- Set password: `TestAdmin123!@#`
- Create admin record
- Print credentials

## Step 5: Start Dev Server

```bash
npm run dev
```

Open http://localhost:3000

## Login

- **Email**: `admin@test.local`
- **Password**: `TestAdmin123!@#`

---

## What You Can Do Now

✅ Create forms in the builder
✅ Publish forms with a public link
✅ View and manage responses
✅ Export data to Excel
✅ Track submission status
✅ Add admin notes

## Running Tests

```bash
# Unit tests
npm test

# E2E tests (requires .env with E2E_ADMIN_EMAIL/PASSWORD)
npm run test:e2e

# Visual regression tests
npm run test:visual
```

## Troubleshooting

### "Connection refused"
- Check Supabase project is running
- Verify VITE_SUPABASE_URL is correct

### "User not admin"
- Verify migration 004 ran
- Check admin_users table has your user

### "CORS error"
- Check CSP headers in src/server.ts
- Verify Supabase URL matches .env

---

## Next: Customize

1. Change admin credentials (Settings > Users in Supabase)
2. Customize app settings (Admin Dashboard > Settings)
3. Create sample forms to test
4. Deploy to production (see docs/deployment.md)

---

## Need Help?

- 📖 Docs: See `docs/` folder
- 🐛 Issues: Check GitHub issues
- 💬 Questions: See AGENTS.md for architecture overview
