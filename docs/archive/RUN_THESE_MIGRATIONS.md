# 🚀 Quick Start - Run These Migrations

## ⚡ MUST RUN (In Order)

### 1. Migration 010 - Per-Form Reference IDs
**File:** `010_per_form_reference_ids.sql`  
**Purpose:** Each form gets unique reference ID format (ABBR-id-00001)  
**Test:** Submit form → Check reference ID format

---

### 2. Migration 011 - Public View Response
**File:** `011_public_view_response.sql`  
**Purpose:** Allow users to view submissions by reference ID  
**Test:** Visit `/view-response/{your-reference-id}`

---

### 3. Migration 012 - Fix Audit Log
**File:** `012_fix_audit_log_actions.sql`  
**Purpose:** Only track important actions (login, logout, publish, delete)  
**Test:** Check Audit Log page → Only shows important actions

---

### 4. Migration 013 - Fix Dashboard
**File:** `013_fix_dashboard_functions.sql`  
**Purpose:** Exclude deleted items from dashboard stats  
**Test:** Dashboard matches Forms page count

---

## 📋 How to Run

1. Open Supabase Dashboard → SQL Editor
2. Open migration file (e.g., `010_per_form_reference_ids.sql`)
3. Copy ENTIRE file contents
4. Paste into SQL Editor
5. Click "Run"
6. Repeat for migrations 011, 012, 013

---

## ✅ Done Checklist

- [ ] Migration 010 run successfully
- [ ] Migration 011 run successfully
- [ ] Migration 012 run successfully
- [ ] Migration 013 run successfully
- [ ] Dashboard loads and shows correct stats
- [ ] Reference IDs format: `ABBR-xxxxx-00001`
- [ ] Can view response by reference ID
- [ ] Audit log shows only important actions

---

## 🔴 If Dashboard Was Broken

If dashboard showed errors before, also run:

**File:** `008_complete_fixes.sql`  
**Purpose:** Creates dashboard functions  
**When:** Only if dashboard won't load

---

That's it! Run those 4 migrations (010, 011, 012, 013) and you're done! 🎉

---

## 🔐 BONUS: Make Yourself Admin

**File:** `014_add_your_admin_user.sql`

**Purpose:** Add yourself as an admin user

**Steps:**
1. Login to your app (creates your auth account)
2. Find your user_id:
   ```sql
   SELECT id, email FROM auth.users;
   ```
3. Edit `014_add_your_admin_user.sql`
4. Replace the user_id and email with yours
5. Run the migration
6. You're now admin! 🎉

**Note:** Your email in the file is already `siddharthaimmadi@gmail.com`. Just update the user_id if it changed!
