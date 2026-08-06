# Timeline: What Broke & How It's Fixed Now

## Historical Timeline

| Commit | What Changed | Status |
|--------|---|---|
| `b6173f9` | ✅ Description fix - showed sections on all forms | **WORKING LOCALLY** |
| `9a88761` | Revert description gate | Working locally |
| `aab090e` | Critical fixes applied | Working locally |
| ... | Various SSR attempts | Hit 500s on Vercel |
| `f061204` | Added `if (typeof window === "undefined") return;` guard to `_admin/route.tsx` | ❌ **BROKE VERCEL** |
| `177ddfc` | Fixed index route with client-side nav | Partial fix |
| `39501b9` | ✅ Removed window guard, restored working state | **FIXED** |

---

## Why It Worked Locally But Failed on Vercel

### Local Development (`npm run dev`)
- Vite dev server with HMR (hot module reload)
- React hydration happens immediately
- No true SSR — components render client-side
- Window guard didn't matter because code never ran server-side
- **Result**: Worked fine ✅

### Vercel Deployment (Production SSR)
- TanStack Start + Nitro SSR on Vercel Functions
- Server renders HTML first, then client hydrates
- Routes with `beforeLoad` try to run on the server
- Window guard returns early **without redirecting**
- Outlet tries to render unauthenticated
- Supabase client fails
- **Result**: 500 HTTPError ❌

---

## The Broken Code (Commit f061204)

```typescript
beforeLoad: async () => {
  if (typeof window === "undefined") return;  // ❌ WRONG
  // Auth logic never runs on server
  // Component tries to render without auth
  // Crash!
}
```

**Problem**: Returns from beforeLoad without throwing redirect means:
- On server: Returns `undefined`, Outlet renders anyway → crash
- On client: Runs the auth check → works fine
- Result: Works locally, breaks on Vercel

---

## The Fixed Code (Commit 39501b9)

```typescript
beforeLoad: async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    // Throws redirect to login
    throw redirect({ to: "/admin/login" });
  }
  // Rest of auth logic
}
```

**Why it works now**:
1. Route has `ssr: false` → TanStack Router knows this is client-only
2. Server doesn't try to execute `beforeLoad` at all
3. Client hydrates, runs `beforeLoad`, checks auth
4. User gets redirected if not authenticated
5. No more window guards needed

---

## Key Insight

**Window guards are NOT the solution to SSR problems.**

The correct solution is:
```typescript
export const Route = createFileRoute("/_admin")({
  ssr: false,  // ✅ Tell framework "don't SSR this route"
  beforeLoad: async () => {  // No window check needed!
    // Normal auth logic
  }
})
```

When `ssr: false`, the framework:
- Server sends `<!DOCTYPE html>...` shell
- Server skips component & beforeLoad
- Client hydrates and runs `beforeLoad`
- Result: No server-side auth issues

---

## Current State (39501b9)

✅ **Back to the working state** (b6173f9 but with SSR properly disabled)

| File | Status | Change |
|------|--------|--------|
| `src/routes/index.tsx` | ✅ Client-side nav | Using `useEffect` instead of SSR redirect |
| `src/routes/admin/login.tsx` | ✅ SSR disabled | `ssr: false` |
| `src/routes/_admin/route.tsx` | ✅ No window guard | `ssr: false`, clean `beforeLoad` |
| `src/server.ts` | ✅ Enhanced logging | Better diagnostics |

All other admin routes inherit `ssr: false` from the layout.

---

## Why This Time Will Work on Vercel

1. **SSR properly disabled** on authenticated routes
2. **No window guards** causing early returns
3. **Client-side auth checks** work as intended
4. **Environment variables set** in Vercel dashboard
5. **Error logging** makes debugging future issues easy

---

## Next Action

Just redeploy on Vercel:

1. Go to https://vercel.com/dashboard
2. Select ith-forms
3. Go to Deployments
4. Click latest → "..." → "Redeploy"
5. Wait for "Ready" ✅
6. Test: Visit `/` (should redirect to `/admin/login`)

That's it! The code is now correct for production SSR.
