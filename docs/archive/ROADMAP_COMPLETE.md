# ITH-FORMS — Complete Roadmap to Production

**Generated:** 4 July 2026  
**Current State:** 45% production-ready  
**Target:** 100% feature-complete, production-deployed, enterprise-grade forms platform  
**Execution Model:** Sequential phases, each with verification gate

---

## Overview

This roadmap takes ITH-FORMS from current state (functional but with critical security issues) to a complete, production-ready, feature-rich forms management platform. Phases are ordered by risk: **security first**, then stability, performance, features, and polish.

**Timeline Estimate:** 5-7 working days (40-56 hours)

| Phase | Focus | Effort | Blockers Cleared |
|---|---|---|---|
| 0 | **Security Hardening** | 2 hours | C1, C2, C3, C4 (all critical) |
| 1 | **Repository Setup** | 30 min | Git safety, dependency cleanup |
| 2 | **Performance** | 2 hours | Dashboard optimization, N+1 fixes |
| 3 | **Reliability** | 3 hours | Validation, error boundaries, headers |
| 4 | **Email & Ops** | 1 hour | Confirmation emails, health checks |
| 5 | **Feature Completion** | 24 hours | Drag-drop, theme editor, analytics, bulk ops |
| 6 | **Quality Gate** | 8 hours | Tests, CI/CD, documentation |
| 7 | **Production Deployment** | 4 hours | Deploy, monitor, final audit |

---

## Legend

- 🤖 **I execute** (code changes, file edits)
- 🧑 **You execute** (Supabase dashboard, manual verification)
- ✅ **Verification checkpoint** (must pass before next phase)

---

## Phase 0 — Security Hardening (BLOCKER)
**Goal:** Close all 4 critical security vulnerabilities  
**Effort:** 2 hours code + 30 minutes your manual actions  
**Blocks:** Production deployment  
**Issues Resolved:** C1, C2 (a/b/c/d/e), C3, C4

### Step 0.1: Rotate Supabase Credentials (🧑 YOU)
**Time:** 5 minutes  
**Why:** `.env` contains real keys; must rotate before git usage

**Actions:**
1. Open Supabase Dashboard → https://supabase.com/dashboard/project/prnfnifpltsyatadpkpe/settings/api
2. Click "Regenerate" next to `anon` key
3. Copy NEW anon key
4. Update local `.env` file with new key (do NOT commit)
5. **Verify:** Old anon key stops working (test in browser console)

**Deliverable:** New anon key active, old key invalidated

---

### Step 0.2: Run Migration 005 (🧑 YOU)
**Time:** 10 minutes  
**Why:** Closes C2a (PII breach), C2b (storage RLS), C2c (audit forge), C2d (history forge), C2e (indexes)

**Actions:**
1. Open Supabase Dashboard → SQL Editor
2. Open local file: `supabase/migrations/005_security_hardening.sql`
3. Copy entire contents (470 lines)
4. Paste into SQL Editor
5. Click "Run"
6. **Verify success:** Should see ~15 success messages (DROP POLICY, CREATE FUNCTION, CREATE POLICY, CREATE INDEX)

**Verification Queries:**
```sql
-- Should return 0 (anon has NO direct submission access)
SELECT COUNT(*) FROM pg_policies 
WHERE tablename='submissions' AND roles @> '{anon}';

-- Should return 2 (submit_response, register_submission_file)
SELECT COUNT(*) FROM pg_proc 
WHERE proname IN ('submit_response', 'register_submission_file');

-- Should return 10 (new indexes)
SELECT COUNT(*) FROM pg_indexes 
WHERE indexname LIKE 'idx_%';
```

**Deliverable:** All verification queries pass

---

### Step 0.3: Add CSP Nonce Support (🤖 I EXECUTE)
**Time:** 45 minutes  
**Why:** C3 — Remove `unsafe-inline` from script-src

**Files Changed:**
- `src/server.ts` — Generate per-request nonce, inject into CSP
- `src/client.tsx` — Accept nonce from server (if needed by TanStack)

**Changes:**
```typescript
// server.ts
async function handleRequest(request: Request, env: unknown, ctx: unknown) {
  const nonce = crypto.randomUUID();
  const CSP = [
    `script-src 'self' 'nonce-${nonce}'`,  // Remove unsafe-inline
    "style-src 'self' 'unsafe-inline'",    // Keep for theme system
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
  ].join("; ");
  
  // ... pass nonce to response if TanStack needs it
}
```

**Verification:**
```bash
npm run build
# Check browser console: no CSP violations
# Manually inject <script>alert('xss')</script> → should be blocked
```

**Deliverable:** `unsafe-inline` removed from script-src; app still works

---

### Step 0.4: Add Login Rate Limiting (🤖 I EXECUTE)
**Time:** 30 minutes  
**Why:** C4 — Prevent brute-force attacks on admin credentials

**Files Changed:**
- `src/routes/admin/login.tsx` — Client-side exponential backoff

**Changes:**
```typescript
const [attempts, setAttempts] = useState(0);
const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  
  // Check lockout
  if (lockoutUntil && Date.now() < lockoutUntil) {
    const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
    setError(`Too many failed attempts. Try again in ${remaining} seconds.`);
    return;
  }
  
  setError("");
  setLoading(true);
  
  try {
    const { error: authError } = await supabase.auth.signInWithPassword({ email: userId, password });
    
    if (authError) {
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      
      // Exponential backoff: 5s, 10s, 20s, 40s, 80s...
      if (nextAttempts >= 3) {
        const delay = Math.pow(2, nextAttempts - 3) * 5000;
        setLockoutUntil(Date.now() + delay);
      }
      
      setError("Invalid credentials. Please try again.");
      return;
    }
    
    // Success: reset attempts
    setAttempts(0);
    setLockoutUntil(null);
    
    // ... rest of success flow
  } finally {
    setLoading(false);
  }
}
```

**Also:** Enable Supabase Auth rate limiting (🧑 YOU)
1. Supabase Dashboard → Authentication → Rate Limits
2. Enable "Protect against abuse"
3. Set: 10 attempts per hour per IP

**Deliverable:** 3 failed logins trigger 5-second lockout; Supabase rate limit active

---

### Step 0.5: Add HSTS Header (🤖 I EXECUTE)
**Time:** 5 minutes  
**Why:** H5 — Prevent SSL downgrade attacks

**Files Changed:**
- `src/server.ts` — Add to SECURITY_HEADERS

**Changes:**
```typescript
const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CSP,
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};
```

**Verification:**
```bash
npm run build
curl -I https://your-domain.com | grep -i strict-transport
# Should see: Strict-Transport-Security: max-age=63072000...
```

**Deliverable:** HSTS header present in all responses

---

### ✅ Phase 0 Verification Gate

**Must Pass Before Phase 1:**
- [ ] New Supabase anon key active; old key invalidated
- [ ] Migration 005 applied; all 3 verification queries pass
- [ ] CSP has `nonce-{uuid}` instead of `unsafe-inline` for scripts
- [ ] Login rate limiting works (3 failures = lockout)
- [ ] HSTS header present in HTTP responses
- [ ] `npm run build` succeeds with zero errors
- [ ] Manual smoke test: login → create form → publish → submit works

**Production Blocker Status:** 🟢 CLEARED (all Critical issues resolved)

---

## Phase 1 — Repository & Dependency Hygiene
**Goal:** Safe git usage, clean dependencies, enable CI  
**Effort:** 30 minutes  
**Issues Resolved:** H3 (git safety), M7 (beta deps), L8 (unused deps)

### Step 1.1: Verify .gitignore (🤖 I EXECUTE)
**Time:** 2 minutes  
**Why:** Ensure `.env` and build artifacts never committed

**Files Changed:**
- `.gitignore` (already exists — verify contents)

**Verification:**
```bash
# Simulate git status (DON'T actually init yet)
git ls-files --others --ignored --exclude-standard
# Should list: .env, node_modules/, .output/, .wrangler/
```

**Deliverable:** `.gitignore` correctly excludes secrets and build artifacts

---

### Step 1.2: Initialize Git Repository (🧑 YOU)
**Time:** 5 minutes  
**Why:** Enable version control AFTER secrets are rotated and gitignore verified

**Actions:**
```bash
cd d:\ith-forms
git init
git add .
git status
# VERIFY: .env is NOT in staged files (should see "nothing to commit" or only source files)
git commit -m "Initial commit - ITH-FORMS v1.0"
```

**⚠️ CRITICAL:** Do NOT push to any remote yet (no GitHub/GitLab/Bitbucket). Keep local only for now.

**Deliverable:** Git repo initialized; initial commit created; .env excluded

---

### Step 1.3: Clean Up Unused Dependencies (🤖 I EXECUTE)
**Time:** 10 minutes  
**Why:** Reduce supply chain surface, faster installs

**Files Changed:**
- `package.json` — Remove unused packages
- `src/styles.css` — Remove tw-animate-css import

**Changes:**
```bash
npm uninstall tw-animate-css
```

```css
/* src/styles.css — Remove this line: */
@import "tw-animate-css";
```

**Verification:**
```bash
npm install
npm run build
# Should succeed
```

**Deliverable:** Package count reduced; build still succeeds

---

### Step 1.4: Pin Dependency Versions (🤖 I EXECUTE)
**Time:** 5 minutes  
**Why:** M7 — Prevent unexpected breaks from beta/unstable deps

**Files Changed:**
- `package.json` — Remove ^ semver ranges

**Changes:**
```json
{
  "devDependencies": {
    "nitro": "3.0.260603-beta",  // Already exact, add note
    "vite": "8.1.3",              // Already exact
    "typescript": "5.8.3"         // Already exact
  }
}
```

Add comment in package.json:
```json
{
  "//": "nitro is beta — monitor for stable 3.1.0 release; vite 8 is new major — pinned for stability"
}
```

**Deliverable:** All versions exact (no ^); documented

---

### Step 1.5: Enable Strict TypeScript (🤖 I EXECUTE)
**Time:** 8 minutes  
**Why:** L2 — Catch unused variables, improve code quality

**Files Changed:**
- `tsconfig.json` — Already strict; verify enabled

**Current state:**
```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    // ... already enabled!
  }
}
```

**Action:** Run check and fix any new warnings:
```bash
npx tsc --noEmit
# Fix any reported unused variables
```

**Deliverable:** Zero TypeScript errors

---

### ✅ Phase 1 Verification Gate

**Must Pass:**
- [ ] Git initialized; `.env` not tracked
- [ ] `tw-animate-css` removed; build succeeds
- [ ] All deps exact versions; beta deps documented
- [ ] `npx tsc --noEmit` returns zero errors
- [ ] Fresh `npm install && npm run build` succeeds

**Ready for:** Phase 2 (performance optimizations)

---

## Phase 2 — Performance Optimization
**Goal:** Fix O(n) data fetches, eliminate N+1 queries  
**Effort:** 2 hours  
**Issues Resolved:** H1 (dashboard trend), H2 (CSS injection), H3 (QueryClient), H6 (bulk inserts), M1 (N+1 detail page)

### Step 2.1: Dashboard Aggregate RPC (🤖 I EXECUTE)
**Time:** 30 minutes  
**Why:** H1 — Trend chart fetches 10k rows to client

**Files Changed:**
- Create new migration: `supabase/migrations/006_dashboard_aggregates.sql`
- `src/routes/_admin/dashboard.tsx` — Use RPC instead of client-side bucketing

**Migration:**
```sql
-- 006_dashboard_aggregates.sql
CREATE OR REPLACE FUNCTION public.get_daily_submission_trend(
  p_start_date timestamptz
)
RETURNS TABLE(day date, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT submitted_at::date AS day, COUNT(*) AS count
  FROM public.submissions
  WHERE submitted_at >= p_start_date
  GROUP BY submitted_at::date
  ORDER BY day;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_submission_trend(timestamptz) TO authenticated;

-- Aggregate stats (all counts in one call)
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_forms', (SELECT COUNT(*) FROM forms WHERE deleted_at IS NULL),
    'published', (SELECT COUNT(*) FROM forms WHERE status = 'published' AND deleted_at IS NULL),
    'drafts', (SELECT COUNT(*) FROM forms WHERE status = 'draft' AND deleted_at IS NULL),
    'total_submissions', (SELECT COUNT(*) FROM submissions),
    'new_subs', (SELECT COUNT(*) FROM submissions WHERE status = 'new'),
    'under_review', (SELECT COUNT(*) FROM submissions WHERE status = 'under_review'),
    'approved', (SELECT COUNT(*) FROM submissions WHERE status = 'approved'),
    'rejected', (SELECT COUNT(*) FROM submissions WHERE status = 'rejected'),
    'today', (SELECT COUNT(*) FROM submissions WHERE submitted_at >= CURRENT_DATE),
    'this_week', (SELECT COUNT(*) FROM submissions WHERE submitted_at >= CURRENT_DATE - INTERVAL '7 days')
  ) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;
```

**Frontend:**
```typescript
// dashboard.tsx
const { data: stats } = await supabase.rpc('get_dashboard_stats');
const { data: trend } = await supabase.rpc('get_daily_submission_trend', {
  p_start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
});
// 2 RPC calls instead of 12 head-count queries + 1 giant fetch
```

**Verification:**
```bash
# Before: 13 HTTP requests to Supabase
# After: 2 HTTP requests
# Check Network tab in dashboard
```

**Deliverable:** Dashboard loads with 2 RPC calls instead of 13

---

### Step 2.2: Fix QueryClient SSR Issue (🤖 I EXECUTE)
**Time:** 15 minutes  
**Why:** H3 — New QueryClient per request loses caching

**Files Changed:**
- `src/router.tsx` — Move QueryClient outside getRouter()

**Changes:**
```typescript
// router.tsx
let serverQueryClient: QueryClient | undefined;

export const getRouter = () => {
  const queryClient = typeof window === 'undefined'
    ? (serverQueryClient ??= new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 300_000,
          },
        },
      }))
    : new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 300_000,
          },
        },
      });

  return createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: AppErrorFallback,
    defaultNotFoundComponent: NotFoundPage,
  });
};
```

**Deliverable:** SSR shares QueryClient across requests

---

### Step 2.3: Batch Bulk Status Inserts (🤖 I EXECUTE)
**Time:** 20 minutes  
**Why:** H6 — Bulk status change fires 100 HTTP requests for 50 items

**Files Changed:**
- `src/routes/_admin/forms/$formId/responses/index.tsx` — applyBulk()

**Changes:**
```typescript
async function applyBulk() {
  const ids = [...selected];
  if (ids.length === 0) return;
  
  const label = bulkStatus.replace(/_/g, " ");
  if (!confirm(`Change status of ${ids.length} submission(s) to "${label}"?`)) return;
  
  setApplying(true);
  try {
    const actorEmail = (await supabase.auth.getUser()).data.user?.email ?? null;
    const targets = subs.filter(s => ids.includes(s.id) && s.status !== bulkStatus);
    
    if (targets.length > 0) {
      // Single batch update
      const { error } = await supabase
        .from("submissions")
        .update({ status: bulkStatus as never })
        .in("id", targets.map(t => t.id));
      
      if (error) { toast.error(error.message); return; }
      
      // Batch history insert (1 call instead of N)
      await supabase.from("submission_status_history").insert(
        targets.map(t => ({
          submission_id: t.id,
          form_id: formId,
          from_status: t.status,
          to_status: bulkStatus,
        }))
      );
      
      // Batch audit insert (1 call instead of N)
      await supabase.from("audit_logs").insert(
        targets.map(t => ({
          action: "submission.status_changed",
          entity: "submission",
          entity_id: t.id,
          actor_email: actorEmail,
          metadata: { from: t.status, to: bulkStatus, bulk: true },
        }))
      );
    }
    
    toast.success(`${targets.length} submission(s) moved to "${label}"`);
    setSelected(new Set());
    load();
  } finally {
    setApplying(false);
  }
}
```

**Deliverable:** Bulk op fires 3 requests instead of 1 + N × 2

---

### Step 2.4: Submission Detail Aggregate RPC (🤖 I EXECUTE)
**Time:** 30 minutes  
**Why:** M1 — Detail page fires 4 HTTP requests on every load

**Files Changed:**
- `supabase/migrations/006_dashboard_aggregates.sql` — Add function
- `src/routes/_admin/forms/$formId/responses/$submissionId.tsx` — Use RPC

**Migration (append to 006):**
```sql
CREATE OR REPLACE FUNCTION public.get_submission_detail(p_submission_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT json_build_object(
    'submission', (
      SELECT row_to_json(s) FROM submissions s WHERE id = p_submission_id
    ),
    'answers', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', a.id,
          'question_id', a.question_id,
          'value', a.value,
          'question_label', q.label,
          'question_type', q.type
        )
      ), '[]'::json)
      FROM submission_answers a
      LEFT JOIN form_questions q ON q.id = a.question_id
      WHERE a.submission_id = p_submission_id
    ),
    'notes', (
      SELECT COALESCE(json_agg(
        row_to_json(n) ORDER BY n.created_at
      ), '[]'::json)
      FROM submission_notes n
      WHERE n.submission_id = p_submission_id
    ),
    'history', (
      SELECT COALESCE(json_agg(
        row_to_json(h) ORDER BY h.changed_at
      ), '[]'::json)
      FROM submission_status_history h
      WHERE h.submission_id = p_submission_id
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_submission_detail(uuid) TO authenticated;
```

**Frontend:**
```typescript
// $submissionId.tsx
async function load() {
  setLoading(true);
  const { data, error } = await supabase.rpc('get_submission_detail', {
    p_submission_id: submissionId
  });
  
  if (error || !data) {
    setLoading(false);
    return;
  }
  
  setSub(data.submission);
  setAnswers(data.answers);
  setNotes(data.notes);
  setHistory(data.history);
  setLoading(false);
}
```

**Deliverable:** Detail page loads with 1 RPC call instead of 4

---

### Step 2.5: Sanitize CSS Background URL (🤖 I EXECUTE)
**Time:** 10 minutes  
**Why:** H2 — Potential CSS injection via bg_image_path

**Files Changed:**
- `src/lib/theme-utils.ts` — Encode special chars in URL

**Changes:**
```typescript
export function themeContainerStyle(
  t: FormTheme | null,
  bgImageUrl?: string | null
): CSSProperties {
  if (!t) return {};
  const s: Record<string, string> = {};
  
  // ... existing color logic ...
  
  const style = s as CSSProperties;
  if (t.font_family) style.fontFamily = t.font_family;
  
  if (bgImageUrl) {
    // Sanitize URL: escape `)`, `"`, `'`, `\`
    const safeBgUrl = bgImageUrl.replace(/[)"'\\]/g, (m) => 
      '%' + m.charCodeAt(0).toString(16).padStart(2, '0')
    );
    const overlay = rgba(t.background_color ?? "#0b0b16", t.bg_overlay_opacity ?? 0.5);
    style.backgroundImage = `linear-gradient(${overlay}, ${overlay}), url("${safeBgUrl}")`;
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
    style.backgroundAttachment = "fixed";
  }
  
  return style;
}
```

**Deliverable:** CSS injection vector closed

---

### Step 2.6: Sanitize File Names (🤖 I EXECUTE)
**Time:** 10 minutes  
**Why:** H4 — Raw file names used in storage paths

**Files Changed:**
- `src/routes/forms/$slug[.]html.tsx` — handleSubmit() file upload loop

**Changes:**
```typescript
// Upload files to storage, then register metadata through the validated RPC.
const failedUploads: string[] = [];
for (const q of questions.filter(q => FILE_TYPES.includes(q.type))) {
  const files = (answers[q.id] as File[]) ?? [];
  for (const file of files) {
    // Sanitize filename: alphanumeric, dash, underscore, dot only
    const safeFileName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 200);
    const path = `${result.submission_id}/${q.id}/${Date.now()}-${safeFileName}`;
    
    const { error: upErr } = await supabase.storage
      .from("submission-files")
      .upload(path, file);
    
    if (upErr) {
      failedUploads.push(`${q.label}: ${file.name}`);
      continue;
    }
    
    const { error: regErr } = await supabase.rpc("register_submission_file", {
      p_submission_id: result.submission_id,
      p_question_id: q.id,
      p_file_path: path,
      p_file_name: safeFileName,
      p_file_size: file.size,
      p_mime_type: file.type,
    });
    
    if (regErr) failedUploads.push(`${q.label}: ${file.name}`);
  }
}
```

**Deliverable:** File names sanitized before storage upload

---

### ✅ Phase 2 Verification Gate

**Must Pass:**
- [ ] Dashboard uses 2 RPC calls (stats + trend) instead of 13 queries
- [ ] QueryClient is singleton on server, per-client on browser
- [ ] Bulk status change fires 3 requests (1 update, 2 batch inserts) regardless of selection size
- [ ] Submission detail page loads with 1 RPC call
- [ ] CSS background URL properly encoded
- [ ] File names sanitized (test with file named `../../../etc/passwd.jpg`)
- [ ] `npm run build` succeeds
- [ ] 🧑 **YOU:** Run migration 006 in Supabase SQL Editor

**Performance Improvement:** Dashboard ~85% faster; bulk ops ~95% faster

---

## Phase 3 — Reliability & Validation
**Goal:** Proper error handling, input validation, accessibility  
**Effort:** 3 hours  
**Issues Resolved:** M2 (email validation), M3 (confirm dialogs), M5 (color contrast), M6 (aria-labels)

### Step 3.1: Add Email/URL/Phone Validation (🤖 I EXECUTE)
**Time:** 30 minutes  
**Why:** M2 — noValidate disables browser checks; no server-side validation

**Files Changed:**
- `src/routes/forms/$slug[.]html.tsx` — Extend validate() function

**Changes:**
```typescript
import { z } from "zod";

// Add validation schemas
const VALIDATION_SCHEMAS = {
  email: z.string().email("Please enter a valid email address"),
  url: z.string().url("Please enter a valid URL starting with http:// or https://"),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Please enter a valid phone number"),
  number: z.string().regex(/^-?\d+(\.\d+)?$/, "Please enter a valid number"),
} as const;

function validate(): boolean {
  const errs: Record<string, string> = {};
  
  for (const q of questions) {
    // Check required
    if (requiredMissing(q)) {
      errs[q.id] = "This field is required";
      continue;
    }
    
    // Check format for typed fields
    const value = answers[q.id];
    if (value && typeof value === "string" && value.trim()) {
      const schema = VALIDATION_SCHEMAS[q.type as keyof typeof VALIDATION_SCHEMAS];
      if (schema) {
        const result = schema.safeParse(value.trim());
        if (!result.success) {
          errs[q.id] = result.error.errors[0].message;
        }
      }
    }
  }
  
  setErrors(errs);
  
  // Jump to first error section in multi-step forms
  if (multi && Object.keys(errs).length > 0) {
    const idx = sectionsWithQs.findIndex(s => 
      questions.some(q => q.section_id === s.id && errs[q.id])
    );
    if (idx >= 0) setStep(idx);
  }
  
  return Object.keys(errs).length === 0;
}
```

**Deliverable:** Invalid emails/URLs/phones rejected with clear messages

---

### Step 3.2: Replace window.confirm() with Modal (🤖 I EXECUTE)
**Time:** 45 minutes  
**Why:** M3 — Native confirm() is unst styleable, blocking, inaccessible

**Files Changed:**
- Create `src/components/ConfirmDialog.tsx`
- Update all admin files using `confirm()`:
  - `forms/index.tsx`
  - `forms/$formId/edit.tsx`
  - `forms/$formId/responses/index.tsx`
  - `forms/$formId/responses/$submissionId.tsx`

**New Component:**
```typescript
// src/components/ConfirmDialog.tsx
import { createContext, useContext, useState, ReactNode } from "react";
import { X } from "lucide-react";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
};

type ConfirmContextType = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    open: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ open: true, options, resolve });
    });
  };

  const handleClose = (confirmed: boolean) => {
    state?.resolve(confirmed);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative rounded-2xl border border-border bg-card p-6 shadow-2xl max-w-md w-full mx-4">
            <button
              onClick={() => handleClose(false)}
              className="absolute top-4 right-4 p-1 hover:text-destructive transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 className="text-lg font-bold mb-2">{state.options.title}</h2>
            <p className="text-sm text-muted-foreground mb-6">{state.options.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleClose(false)}
                className="flex-1 h-10 rounded-md border border-border text-sm hover:bg-secondary transition-colors"
              >
                {state.options.cancelLabel ?? "Cancel"}
              </button>
              <button
                onClick={() => handleClose(true)}
                className={`flex-1 h-10 rounded-md text-sm font-medium transition-colors ${
                  state.options.variant === "destructive"
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {state.options.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
```

**Usage (example in forms/index.tsx):**
```typescript
import { useConfirm } from "@/components/ConfirmDialog";

function FormsList() {
  const { confirm } = useConfirm();
  
  async function softDelete(id: string) {
    const confirmed = await confirm({
      title: "Delete form?",
      message: "This will move the form to deleted status. You can restore it later from settings.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    
    if (!confirmed) return;
    
    // ... proceed with delete
  }
  
  // ... rest of component
}
```

**Wrap AdminShell:**
```typescript
// AdminShell.tsx
import { ConfirmProvider } from "@/components/ConfirmDialog";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <ConfirmProvider>
      <div className="min-h-screen flex">
        {/* ... existing shell */}
        {children}
      </div>
    </ConfirmProvider>
  );
}
```

**Deliverable:** All `window.confirm()` replaced with styled modal

---

