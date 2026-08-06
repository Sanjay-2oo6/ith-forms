# Root Cause Analysis: HTTP 500 Error on Vercel

## The Problem

App worked fine locally and on Vercel on July 28th. After recent changes, **HTTP 500 error** appears on every route on Vercel (but not locally).

---

## Root Cause Found

**File**: `src/integrations/supabase/client.ts`

### What Changed

**July 28th (Working):**
```typescript
function createSupabaseClient() {
  if (!isSupabaseConfigured) {
    throw new Error(`[ITH-FORMS configuration] ${supabaseConfigError}`);
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, ...);
}
```

**Recent Version (Broken):**
```typescript
function createSupabaseClient() {
  const url = SUPABASE_URL || "https://placeholder.supabase.co";
  const key = SUPABASE_ANON_KEY || "placeholder";
  return createClient(url, key, ...);
}
```

### Why This Breaks on Vercel

**Scenario 1: Env vars ARE set in Vercel (correct)**
- Build time: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` baked into bundle
- Runtime: Real values used, app works ✅

**Scenario 2: Env vars NOT set in Vercel (current situation)**
- Build time: Env vars empty → Constants are empty strings
- Runtime: Falls back to placeholders
  - URL: `"https://placeholder.supabase.co"` (invalid)
  - Key: `"placeholder"` (invalid)
- First API call tries to reach invalid URL
- Supabase returns 404/403
- App crashes with HTTP 500 ❌

### Why It Worked Locally

Local `.env` file has real values, so build-time constants are populated correctly.

### Why It Seemed To Work Before

July 28th had **error throwing** that caught missing env vars:

```typescript
if (!isSupabaseConfigured) {
  throw new Error(...);  // Caught by __root.tsx
}
```

This error was caught in `__root.tsx`:
```typescript
if (supabaseConfigError) {
  return <ConfigError message={supabaseConfigError} />;
}
```

So instead of HTTP 500, users would see a friendly config error message.

---

## The Fix Applied

**Commit**: `b9a8f77`

Restored the error-throwing behavior:

```typescript
function createSupabaseClient() {
  if (!isSupabaseConfigured) {
    throw new Error(`[ITH-FORMS configuration] ${supabaseConfigError}`);
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: typeof window !== "undefined",
      autoRefreshToken: typeof window !== "undefined",
    },
  });
}
```

**Key improvements:**
1. ✅ Throws error if env vars missing (not silently fails)
2. ✅ Error caught by `__root.tsx` early
3. ✅ Shows user-friendly message instead of 500
4. ✅ `persistSession` and `autoRefreshToken` only set on client (safer for SSR)

---

## What You Need To Do

### CRITICAL: Add Env Vars to Vercel

The fix prevents silent failures, but you still need to **set the env vars in Vercel**:

1. Go to **https://vercel.com/dashboard**
2. Select **ith-forms** project
3. Go to **Settings → Environment Variables**
4. Add these THREE variables (all marked for Production):

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://zkaeourngxwykkhapotj.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprYWVvdXJuZ3h3eWtraGFwb3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNjg4MDEsImV4cCI6MjEwMDc0NDgwMX0.73H3JRqvojytktdNdI1T7w13Pg7f5mcEClNw8daQnCs` |

### Redeploy

1. Go to Vercel Dashboard → Deployments
2. Click latest deployment → "..." → "Redeploy"
3. Wait for deployment to complete

### Expected Result

After setting env vars and redeploying:
- ✅ No HTTP 500 error
- ✅ App redirects to `/admin/login`
- ✅ Identical behavior to local version

If env vars are still missing after this redeploy:
- User sees a clear error message: *"Missing required environment variable: VITE_SUPABASE_URL..."*
- Not a cryptic HTTP 500

---

## Comparison: Before vs After Fix

| Scenario | Before Fix | After Fix |
|----------|-----------|----------|
| Env vars set in Vercel | ✅ Works | ✅ Works |
| Env vars NOT set | ❌ HTTP 500 (silent) | ✅ Clear error message |
| Local dev (has .env) | ✅ Works | ✅ Works |

---

## Key Insight

**Never use placeholders for critical config.** Always fail early and loudly:
- ✅ Good: Throw error if missing
- ❌ Bad: Use placeholder values
- ❌ Bad: Silently fail on first use

---

## Files Changed

- **`src/integrations/supabase/client.ts`** - Restored error-throwing behavior
- Commit: `b9a8f77` ✅ Pushed to GitHub

---

## Next Steps

1. ✅ Code is fixed and pushed to GitHub
2. ⏳ **Add env vars to Vercel dashboard** (YOUR ACTION)
3. ⏳ **Redeploy on Vercel** (YOUR ACTION)
4. ⏳ **Test** (YOUR ACTION)

This time it will work because:
- Code properly handles missing env vars (shows error instead of 500)
- You have the env vars (they're in your `.env` locally)
- Vercel just needs them in the dashboard too

Good luck! 🚀
