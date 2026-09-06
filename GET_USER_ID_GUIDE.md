# How to Get Your Supabase User ID & Update Migration 014

## Step 1: Open Your Supabase Dashboard

1. Go to: https://app.supabase.com
2. Login with your account (innotechhub.edu@gmail.com)
3. Click on your project: **zkaeourngxwykkhapotj**

---

## Step 2: Find the Authentication Section

On the left sidebar, click **Authentication** (you'll see a lock icon)

---

## Step 3: Go to Users

Under Authentication, click **Users** (should show a list of user accounts)

---

## Step 4: Find YOUR User

You should see a table with users. Look for the row with email: **innotechhub.edu@gmail.com**

Click on that row to open the user details.

---

## Step 5: Copy Your User ID

The user detail page will show:

```
UID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
Email: innotechhub.edu@gmail.com
...
```

**Copy the UID value** (it's a long string like `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

---

## Step 6: Update Migration 014

Now go to your code editor and open:

```
supabase/migrations/014_add_your_admin_user.sql
```

Find this line:

```sql
INSERT INTO public.admin_users (user_id, email)
VALUES ('your-user-id-here', 'your-email@example.com');
```

Replace:
- `'your-user-id-here'` → paste your UID (keep the quotes!)
- `'your-email@example.com'` → `'innotechhub.edu@gmail.com'`

So it looks like:

```sql
INSERT INTO public.admin_users (user_id, email)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'innotechhub.edu@gmail.com');
```

---

## Step 7: Save the File

Press **Ctrl+S** to save migration 014.

---

## Done! ✅

Now you can run the migrations in Supabase SQL Editor (see DEPLOY_NOW.md).
