# POST-AUDIT ACTION PLAN
## ITH Forms — Remediation Roadmap

**Based on**: Professional Software Audit Report (January 2026)  
**Current Status**: 65% production-ready → Target: 85% within 2 weeks, 95% within 8 weeks  
**Timeline**: Phased approach (immediate fixes first, long-term hardening second)

---

# PHASE 0: IMMEDIATE (Today — 30 minutes)

## Issue: CRITICAL Audit Action Constraint Violation

**What's wrong**: Migration 053 tries to log action `'submit_response_email_mismatch'` but this action is NOT in the CHECK constraint from migration 023. When email mismatch occurs, the audit INSERT fails with constraint violation.

**Where it breaks**: Form submission with email tampering attempt → audit log INSERT fails → user sees database error instead of friendly message

**Fix required**: Add missing actions to migration 023's CHECK constraint

### ACTION ITEM #1: Fix Migration 023

**File**: `supabase/migrations/023_audit_log_actions.sql`

**Current state** (lines ~25-41):
```sql
CHECK (action IN (
  'admin.login', 'admin.logout',
  'form.created', 'form.published', 'form.unpublished', 'form.deleted', 'form.restored', 'form.updated',
  'theme.updated',
  'submission.status_changed', 'submission.exported'
))
```

**What to do**:
1. Open `supabase/migrations/023_audit_log_actions.sql`
2. Find the CHECK constraint (around line 25-41)
3. Add these two lines to the action list:
```sql
'submit_response_email_mismatch',
'file_upload_path_traversal_attempt'
```

**Updated constraint should be**:
```sql
CHECK (action IN (
  'admin.login', 'admin.logout',
  'form.created', 'form.published', 'form.unpublished', 'form.deleted', 'form.restored', 'form.updated',
  'theme.updated',
  'submission.status_changed', 'submission.exported',
  'submit_response_email_mismatch',
  'file_upload_path_traversal_attempt'
))
```

**After fix**:
- Run in Supabase SQL editor if changes not yet applied
- Test: Attempt form submission with email tampering → should log cleanly without error
- Verify: Query `SELECT * FROM audit_logs WHERE action = 'submit_response_email_mismatch'`

**Effort**: 5 minutes  
**Risk**: None (adding to allowed list, no logic change)  
**Blocker for production**: YES — must fix before deployment

---

# PHASE 1: MONITORING & ERROR TRACKING (Week 1 - 8 hours)

## Issue: Production errors are invisible

**What's wrong**: No error logging means production failures go unnoticed until users complain. Database connection drops? RPC timeout? Unknown until incident.

**Business impact**: Cannot respond to outages quickly, cannot debug issues, no visibility into system health.

**Solution approach**: Add structured logging + error tracking

---

## ACTION ITEM #2: Set Up Sentry Error Tracking

**Why Sentry**: Simple setup, free tier sufficient for MVP, captures errors automatically from browser + server.

### Step 1: Create Sentry Account

1. Go to [sentry.io](https://sentry.io)
2. Sign up (free tier)
3. Create new project:
   - Select "React" for SDK
   - Create project
4. Copy your **Sentry DSN** (looks like: `https://xxxxx@xxxxx.ingest.sentry.io/xxxxx`)

### Step 2: Install Sentry in App

```bash
npm install @sentry/react @sentry/tracing @sentry/node
```

### Step 3: Add Sentry to Frontend

**File**: `src/client.tsx` (add at top, before app initialization)

```typescript
import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    new BrowserTracing(),
    new Sentry.Replay(),
  ],
  tracesSampleRate: 0.1, // 10% of transactions
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0, // Capture all error sessions
});
```

### Step 4: Add Sentry to Backend

**File**: `src/server.ts` (add at top)

```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

### Step 5: Add Environment Variables

**File**: `.env.example` (add lines)

```env
VITE_SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
```

**In Netlify Dashboard**:
1. Site settings → Build & deploy → Environment
2. Add `VITE_SENTRY_DSN` (scope: Builds, preview)
3. Add `SENTRY_DSN` (scope: Runtime)
4. Trigger redeploy

### Step 6: Test Error Logging

Add temporary error to form submission:
```typescript
// src/routes/forms/$slug.tsx, line 515
throw new Error("Test Sentry error");
```

- Deploy test
- Trigger error in browser
- Check Sentry dashboard for error
- Remove test code

**Result**: All errors now logged to Sentry dashboard. You'll get:
- Error stack traces
- Browser version, OS
- Network conditions
- User session replay
- Alerts for error rate spikes

**Effort**: 2 hours  
**Value**: Complete visibility into production errors

---

## ACTION ITEM #3: Add Structured Logging

**Why**: Beyond Sentry, log important events (form submissions, rate limits, etc.) for debugging.

### Option A: Simple (Console → CloudWatch)

Use Netlify's built-in logging — all `console.log`, `console.error` goes to CloudWatch.

**Add to src/server.ts**:
```typescript
// Log important events
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  event: "form_submission_success",
  form_id: formId,
  reference_token: referenceToken,
  email: respondentEmail,
}));
```

Access logs:
- Netlify Dashboard → Functions → View logs
- Or: CloudWatch (AWS)

**Effort**: 1 hour  
**Value**: Basic event tracking

### Option B: Advanced (Winston Logger)

```bash
npm install winston
```

**Create**: `src/lib/logger.ts`

```typescript
import winston from "winston";

export const logger = winston.createLogger({
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    // Optional: Add file/cloud transport
  ],
});

// Usage
logger.info("Form submitted", {
  form_id: formId,
  email: respondentEmail,
  reference_token: referenceToken,
});

logger.error("Rate limit exceeded", {
  email: respondentEmail,
  form_id: formId,
  attempts: submissionCount,
});
```

**Effort**: 2 hours  
**Value**: Structured, queryable logs

---

## ACTION ITEM #4: Add Health Check Monitoring

**Netlify Uptime Monitor**: Free uptime check for `/health` endpoint

1. Netlify Dashboard → Site settings → Monitoring
2. Add uptime check:
   - URL: `https://yourdomain.com/health`
   - Interval: 5 minutes
   - Notify: your email
3. Save

**Result**: You'll get notified if site goes down

**Effort**: 10 minutes  
**Value**: Automatic downtime alerts

---

## PHASE 1 SUMMARY

| Item | Effort | Value | Timeline |
|------|--------|-------|----------|
| Sentry setup | 2 hrs | Error tracking + replay | Wed |
| Structured logging | 1–2 hrs | Event tracking | Thu |
| Health check | 0.25 hrs | Uptime monitoring | Fri |
| **Total** | **3–4 hours** | **Full observability** | **1 week** |

---

# PHASE 2: PAGINATION (Week 2 - 6 hours)

## Issue: Tables break at scale

**What's wrong**: 
- Admin forms list loads all forms (1000+ = browser lag)
- Response table loads all responses (10000+ = freeze)
- No cursor pagination implemented

**Solution**: Add pagination to both tables

---

## ACTION ITEM #5: Create Pagination Hook

**File**: `src/lib/usePagination.ts` (new file)

```typescript
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

type PaginationState = {
  cursor: string | null;
  limit: number;
};

export function usePagination<T extends { id: string }>(
  queryKey: string[],
  queryFn: (cursor: string | null, limit: number) => Promise<T[]>,
  limit: number = 50
) {
  const [pagination, setPagination] = useState<PaginationState>({
    cursor: null,
    limit,
  });

  const [allRows, setAllRows] = useState<T[]>([]);

  const { data: rows, isLoading } = useQuery({
    queryKey: [...queryKey, pagination.cursor],
    queryFn: () => queryFn(pagination.cursor, limit),
  });

  // Handle "Load More"
  const loadMore = () => {
    if (!rows || rows.length === 0) return;
    
    const lastRow = rows[rows.length - 1];
    setAllRows([...allRows, ...rows]);
    setPagination({ cursor: lastRow.id, limit });
  };

  return {
    rows: allRows.length > 0 ? allRows : rows,
    isLoading,
    hasMore: rows && rows.length === limit,
    loadMore,
  };
}
```

---

## ACTION ITEM #6: Implement Forms List Pagination

**File**: `src/routes/_admin/forms/index.tsx`

**Change from**:
```typescript
const { data: forms } = useQuery({
  queryKey: ["forms-list", showTrash],
  queryFn: async () => {
    const { data } = await supabase
      .from("forms")
      .select("*")
      .eq("deleted_at", showTrash ? "not.null" : "null")
      .order("created_at", { ascending: false });
    return data; // ALL forms
  },
});

{forms?.map(form => <FormCard key={form.id} {...form} />)}
```

**Change to**:
```typescript
const { rows: forms, isLoading, hasMore, loadMore } = usePagination(
  ["forms-list", showTrash],
  async (cursor, limit) => {
    let query = supabase
      .from("forms")
      .select("*")
      .eq("deleted_at", showTrash ? "not.null" : "null")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.gt("id", cursor); // Cursor-based pagination
    }

    const { data } = await query;
    return data || [];
  },
  50 // 50 forms per page
);

{forms?.map(form => <FormCard key={form.id} {...form} />)}

{hasMore && (
  <button onClick={loadMore} disabled={isLoading}>
    {isLoading ? "Loading..." : "Load More Forms"}
  </button>
)}
```

**Effort**: 1 hour  
**Result**: Forms list loads 50 at a time, user clicks "Load More"

---

## ACTION ITEM #7: Implement Response Table Pagination

**File**: `src/routes/_admin/forms/$formId/responses/index.tsx`

Same approach as forms list — wrap with `usePagination()` hook.

**Key difference**: RPC `get_form_responses_tabular` needs pagination params:

**Migration update needed** (new migration 056):

```sql
-- migration 056_add_pagination_to_responses_rpc.sql

DROP FUNCTION IF EXISTS public.get_form_responses_tabular(...);

CREATE OR REPLACE FUNCTION public.get_form_responses_tabular(
  p_form_id uuid,
  p_limit integer DEFAULT 50,
  p_cursor text DEFAULT NULL,
  ... other filters
)
RETURNS TABLE (...) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.submissions
  WHERE form_id = p_form_id
    AND (p_cursor IS NULL OR id > p_cursor::uuid)
  ORDER BY created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
```

**Effort**: 2 hours  
**Result**: Response table loads 50 at a time

---

## PHASE 2 SUMMARY

| Item | Effort | Timeline |
|------|--------|----------|
| Create pagination hook | 1 hr | Mon |
| Paginate forms list | 1 hr | Tue |
| Paginate response table + RPC | 2 hrs | Wed–Thu |
| Test with large datasets | 2 hrs | Fri |
| **Total** | **6 hours** | **1 week** |

---

# PHASE 3: REFACTOR FORM BUILDER (Week 3-4 - 8 hours)

## Issue: Large component (1200+ lines)

**What's wrong**: `edit.tsx` handles too many concerns:
- Form metadata (title, description)
- Sections drag-and-drop
- Questions drag-and-drop
- Theme editing
- Save/publish logic
- Preview modal

**Solution**: Extract into smaller, focused components

---

## ACTION ITEM #8: Extract Components

### Structure

```
src/components/form-builder/
├── FormBuilderShell.tsx        (new - main orchestrator)
├── FormMetadataEditor.tsx      (new - title, description, settings)
├── SectionSortable.tsx         (extract from edit.tsx)
├── QuestionSortable.tsx        (extract from edit.tsx)
├── ThemeEditor.tsx             (extract from edit.tsx)
├── PreviewModal.tsx            (already extracted, reuse)
├── BuilderTab.tsx              (already exists)
├── SettingsTab.tsx             (already exists)
└── PublishTab.tsx              (new - publish logic)
```

### Step 1: Create FormMetadataEditor

**File**: `src/components/form-builder/FormMetadataEditor.tsx` (new)

```typescript
interface FormMetadataEditorProps {
  form: Form;
  onChange: (form: Partial<Form>) => void;
  isSaving: boolean;
}

export function FormMetadataEditor({
  form,
  onChange,
  isSaving,
}: FormMetadataEditorProps) {
  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Form title"
        value={form.title}
        onChange={(e) => onChange({ title: e.target.value })}
        disabled={isSaving}
      />
      <textarea
        placeholder="Form description"
        value={form.description}
        onChange={(e) => onChange({ description: e.target.value })}
        disabled={isSaving}
      />
      {/* ...other fields... */}
    </div>
  );
}
```

### Step 2: Create ThemeEditor

**File**: `src/components/form-builder/ThemeEditor.tsx` (new)

Extract theme editing logic from `edit.tsx` into focused component.

### Step 3: Update edit.tsx

**File**: `src/routes/_admin/forms/$formId/edit.tsx` (refactored)

```typescript
export default function FormEditor() {
  const [form, setForm] = useState<Form>(initialForm);
  const [sections, setSections] = useState<Section[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Left: Editor */}
      <div className="space-y-4">
        <FormMetadataEditor
          form={form}
          onChange={(updates) => setForm({ ...form, ...updates })}
          isSaving={isSaving}
        />

        <Tabs>
          <Tab label="Sections">
            {sections.map((section) => (
              <SectionSortable
                key={section.id}
                section={section}
                onChange={(updated) => updateSection(updated)}
              />
            ))}
          </Tab>

          <Tab label="Theme">
            <ThemeEditor
              theme={form.theme}
              onChange={(theme) => setForm({ ...form, theme })}
            />
          </Tab>

          <Tab label="Publish">
            <PublishTab form={form} onPublish={handlePublish} />
          </Tab>
        </Tabs>
      </div>

      {/* Right: Preview */}
      <PreviewModal form={form} sections={sections} />
    </div>
  );
}
```

**Result**: `edit.tsx` shrinks from 1200 lines to ~300 lines (orchestration only)

---

## ACTION ITEM #9: Add Component Tests

**File**: `src/components/form-builder/FormMetadataEditor.test.ts` (new)

```typescript
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormMetadataEditor } from "./FormMetadataEditor";

describe("FormMetadataEditor", () => {
  it("updates form title on input change", () => {
    const form = { id: "1", title: "Old Title", description: "" };
    const onChange = vi.fn();

    render(
      <FormMetadataEditor form={form} onChange={onChange} isSaving={false} />
    );

    const input = screen.getByPlaceholderText("Form title");
    fireEvent.change(input, { target: { value: "New Title" } });

    expect(onChange).toHaveBeenCalledWith({ title: "New Title" });
  });
});
```

---

## PHASE 3 SUMMARY

| Item | Effort | Timeline |
|------|--------|----------|
| Extract FormMetadataEditor | 1 hr | Mon |
| Extract ThemeEditor | 1 hr | Tue |
| Extract SectionSortable | 2 hrs | Wed |
| Extract QuestionSortable | 2 hrs | Wed |
| Refactor edit.tsx orchestration | 1 hr | Thu |
| Add component tests | 1 hr | Fri |
| **Total** | **8 hours** | **1 week** |

---

# PHASE 4: ONGOING IMPROVEMENTS (Per Sprint)

## ACTION ITEM #10: Add Audit Logging for Admin Whitelist

**File**: `supabase/migrations/057_add_whitelist_audit_logging.sql` (new)

```sql
-- Log when admins are added to whitelist
CREATE OR REPLACE FUNCTION public.log_whitelist_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (action, entity, entity_id, metadata)
    VALUES (
      'admin_whitelist.added',
      'admin',
      NEW.email,
      jsonb_build_object(
        'email', NEW.email,
        'approved_by', NEW.approved_by,
        'timestamp', now()
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (action, entity, entity_id, metadata)
    VALUES (
      'admin_whitelist.removed',
      'admin',
      OLD.email,
      jsonb_build_object('email', OLD.email, 'timestamp', now())
    );
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_whitelist_audit
AFTER INSERT OR DELETE ON public.admin_whitelist
FOR EACH ROW EXECUTE FUNCTION public.log_whitelist_change();
```

**Also update migration 023 CHECK constraint** to include:
```sql
'admin_whitelist.added',
'admin_whitelist.removed'
```

---

## ACTION ITEM #11: Implement Accessibility Improvements (WCAG AA)

**Sprint 1**: Color Contrast
```bash
npm install --save-dev @axe-core/react
```

Add axe integration to Playwright tests:
```typescript
// e2e/accessibility.spec.ts
import { injectAxe, checkA11y } from "axe-playwright";

test("form builder has no accessibility violations", async ({ page }) => {
  await page.goto("/admin/forms/new");
  await injectAxe(page);
  await checkA11y(page, null, {
    detailedReport: true,
    detailedReportOptions: { html: true }
  });
});
```

**Sprint 2**: Screen Reader Testing
- Test with NVDA (Windows) or VoiceOver (Mac)
- Document issues
- Fix: Add missing `aria-label`, `role` attributes

**Sprint 3**: Keyboard Navigation
- Tab through all interactive elements
- Fix: Proper focus management, keyboard event handlers

---

## ACTION ITEM #12: Add Missing Audit Actions to Constraint

**Update migration 023** to include all new actions:

```sql
CHECK (action IN (
  'admin.login', 'admin.logout',
  'form.created', 'form.published', 'form.unpublished', 'form.deleted', 'form.restored', 'form.updated',
  'theme.updated',
  'submission.status_changed', 'submission.exported',
  'submit_response_email_mismatch',
  'file_upload_path_traversal_attempt',
  'admin_whitelist.added',
  'admin_whitelist.removed'
))
```

---

## PHASE 4 SUMMARY

| Item | Effort | Timeline |
|------|--------|----------|
| Audit logging for whitelist | 1 hr | Sprint 3 |
| WCAG AA color contrast | 2 hrs | Sprint 4 |
| Screen reader testing | 3 hrs | Sprint 5 |
| Keyboard navigation | 2 hrs | Sprint 6 |
| **Total** | **8 hours** | **6 sprints** |

---

# PHASE 5: ENTERPRISE HARDENING (Month 2-3)

## Long-term roadmap (not urgent but important)

### Scalability (6–12 weeks)

- [ ] Database query optimization for large response sets
- [ ] Implement read replicas (if Supabase bottlenecks)
- [ ] Cache strategy for form metadata (Redis or Supabase vector)
- [ ] Background job queue for large exports

### Load Testing (4 weeks)

- [ ] Set up load test environment (staging)
- [ ] Run load tests:
  - 100 concurrent form submissions
  - 1000 concurrent respondents viewing published forms
  - 50 concurrent admins editing forms
- [ ] Identify bottlenecks
- [ ] Optimize based on results

### Compliance & Security (8 weeks)

- [ ] Full WCAG 2.1 AA audit + remediation
- [ ] SOC 2 Type II assessment (if enterprise customer requires)
- [ ] HIPAA/GDPR compliance review (if applicable)
- [ ] Penetration testing (external security firm)

### Operations & Documentation (4 weeks)

- [ ] Create operational runbooks
- [ ] Document deployment process
- [ ] Set up automated backups
- [ ] Create SLA definitions
- [ ] Incident response playbooks

---

# IMPLEMENTATION TIMELINE

## Week 1 (This week)
- [ ] Phase 0: Fix audit action constraint (30 min) — **DO TODAY**
- [ ] Phase 1: Sentry + monitoring (3–4 hours)
- [ ] Phase 1: Health check monitoring (15 min)

**Outcome**: Production errors now visible

## Week 2
- [ ] Phase 2: Pagination hook (1 hour)
- [ ] Phase 2: Forms list pagination (1 hour)
- [ ] Phase 2: Response table pagination (2 hours)

**Outcome**: Tables scale to 10,000+ items without lag

## Week 3–4
- [ ] Phase 3: Extract form builder components (6–8 hours)
- [ ] Phase 3: Add component tests (1 hour)

**Outcome**: Codebase more maintainable, easier to test

## Ongoing (Per sprint)
- [ ] Phase 4: Audit logging, accessibility (2–3 hours per sprint)

**Outcome**: Better compliance, better user experience

## Month 2–3 (When needed)
- [ ] Phase 5: Enterprise hardening
- [ ] Load testing
- [ ] WCAG AA compliance
- [ ] SOC 2 assessment

---

# EFFORT SUMMARY

| Phase | Effort | Timeline | Blocks Production? |
|-------|--------|----------|-------------------|
| **Phase 0** (Fix constraint) | 0.5 hrs | **Today** | **YES** |
| **Phase 1** (Monitoring) | 4 hrs | Week 1 | No |
| **Phase 2** (Pagination) | 6 hrs | Week 2 | No |
| **Phase 3** (Refactor) | 8 hrs | Week 3–4 | No |
| **Phase 4** (Logging + a11y) | 8 hrs | Ongoing | No |
| **Phase 5** (Enterprise) | 20+ hrs | Month 2–3 | No |
| **Total to 85% readiness** | **18.5 hrs** | **2 weeks** | — |
| **Total to 95% readiness** | **38+ hrs** | **8 weeks** | — |

---

# DEPLOYMENT GATE CHECKLIST

**Before going to production, ensure:**

- [ ] Phase 0: Audit action constraint fixed (CRITICAL)
- [ ] Phase 1: Sentry error tracking deployed
- [ ] Phase 1: Health checks configured
- [ ] Phase 2: Forms list pagination works with 500+ forms
- [ ] Phase 2: Response table pagination works with 10,000+ responses
- [ ] Database: All migrations (001–057) applied in correct order
- [ ] Environment: VITE_SENTRY_DSN, SENTRY_DSN configured in Netlify
- [ ] Test: Attempt form submission → error logged to Sentry
- [ ] Test: Attempt admin whitelist change → audit logged

---

# POST-DEPLOYMENT MONITORING

**First week after launch:**

1. **Check Sentry daily** for new error patterns
2. **Monitor pagination performance** with real data
3. **Track form submission success rate** (should be >99%)
4. **Monitor database query times** (should be <500ms for RPC calls)
5. **Get user feedback** on form builder UI (did refactoring help?)

---

# QUICK REFERENCE: What to Do Today

1. ✅ Read this document (you are here)
2. ✅ Fix migration 023 constraint (add two lines, 5 min)
3. ✅ Apply migration to Supabase SQL editor
4. ✅ Test email mismatch scenario
5. ✅ Commit and prepare for deployment

**Timeline**: 30 minutes → app is CRITICAL-issue free and ready for production.

---

**Next steps**: Start with Phase 1 (monitoring) this week. It will give you complete visibility into production once deployed.
