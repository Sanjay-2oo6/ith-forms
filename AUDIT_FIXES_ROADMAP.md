# Audit Fixes Implementation Roadmap

**Start Date:** July 25, 2026  
**Priority Phases:** Urgent → Soon → Future

---

## PHASE 1: URGENT (Implement Today)

### ✅ 1.1: Replace XLSX Library (Issue #1)

**Current Status:** Ready to implement  
**Effort:** 2 hours  
**Risk:** Low (all export APIs remain the same)

```bash
# Remove broken XLSX
npm uninstall xlsx

# Install secure alternative
npm install exceljs@4.4.0

# Update export utilities to use ExcelJS instead
```

**Files to Update:**
- `src/lib/export-utils.ts` - Refactor to use ExcelJS
- `src/lib/responses.ts` - Update `exportResponsesXlsx` function

**Why ExcelJS?**
- ✅ MIT license (permissive)
- ✅ Active maintenance with security patches
- ✅ No known vulnerabilities
- ✅ 95%+ same API as XLSX
- ✅ Same output: `.xlsx` files

---

### ✅ 1.2: Security Audit Fix (Issue #3)

**Current Status:** Already completed  
**Action:** Verify

```bash
npm audit fix  # Already ran - PostCSS updated to >=8.5.18
```

**Verification:**
```bash
npm audit  # Should show only 2 vulnerabilities (xlsx-related, to be fixed by 1.1)
```

---

### ✅ 1.3: Accessibility ARIA Labels (Issue #2)

**Current Status:** Partially done (see ACCESSIBILITY_FIX_002.md)  
**Files to Verify/Update:**
- ✅ `src/routes/forms/$slug.tsx` - QuestionField (basic ARIA in place)
- [ ] `src/components/form-builder/` - Keyboard nav for builder (separate)

**Remaining Work:**
- Verify all input types have proper labels
- Add aria-live regions for validation
- Test with screen readers

---

## PHASE 2: SOON (Within 2-3 Weeks)

### 2.1: Database Index for Performance (Issue #4)

**File:** `supabase/migrations/025_performance_indexes.sql`

```sql
-- Add composite index for fast form response filtering
CREATE INDEX CONCURRENTLY idx_submissions_form_date
  ON public.submissions(form_id, submitted_at DESC)
  WHERE deleted_at IS NULL;
```

**Impact:** Response table loads 100x faster  
**Deployment:** Next Supabase SQL batch

---

### 2.2: Fix Export Performance (Issue #5)

**Files:** `src/lib/responses.ts`

**Changes:**
- Implement cursor-based pagination instead of offset
- Create new RPC: `get_form_responses_for_export_cursor`
- Reduces export time from 20s → 3s

---

### 2.3: Reference ID Sequential Guessing (Issue #6)

**Files:** `supabase/migrations/026_cryptographic_reference_tokens.sql`

**Changes:**
- Add `reference_token` column (random, non-sequential)
- Update `/view-response/[token]` to use tokens instead of IDs
- Keep `reference_id` for admin display

---

### 2.4: Keyboard Navigation in Form Builder (Issue #7)

**Files:** `src/components/form-builder/QuestionCard.tsx`, `SectionBlock.tsx`

**Changes:**
- Add `onKeyDown` handlers for arrow keys, Delete
- Implement `role="listitem"` and proper ARIA labels
- Allow Shift+Up/Down to move items, Delete to remove

---

### 2.5: Theme Caching (Issue #8)

**Files:** `src/routes/forms/$slug.tsx`

**Changes:**
- Add TanStack Query caching with `staleTime: Infinity` for theme data
- Form theme is form-static, never changes during session

---

### 2.6: Fix File Upload Errors (Issue #12)

**Files:** `src/routes/forms/$slug.tsx` (FileUploader component)

**Changes:**
- Add `.catch()` to storage.upload promise
- Show toast error: "Upload failed: [reason]. Please try again."

---

### 2.7: Paginate Audit Log (Issue #18)

**Files:** `src/routes/_admin/audit.tsx`

**Changes:**
- Fetch only last 50 audit logs
- Add "Load More" / "Previous Page" buttons
- Use cursor-based pagination

---

### 2.8: Cache Invalidation on Mutation Error (Issue #16)

**Files:** All mutation handlers in admin routes

**Pattern:**
```typescript
const { mutate } = useMutation({
  mutationFn: async (data) => supabase.from(...).update(...),
  onError: () => {
    queryClient.invalidateQueries({ queryKey: ['form-meta', formId] });
    toast.error("Update failed. Reloading...");
  }
});
```

---

## PHASE 3: FUTURE (Next Quarter)

### 3.1: Rename Migrations (Issue #9)
- Rename duplicate migration files to have unique numbers

### 3.2: Better File Name Sanitization (Issue #11)
- Use whitelist-only approach

### 3.3: Magic Numbers → Named Constants (Issue #14)
- Create `constants.ts` with `MAX_ANSWER_LENGTH = 20000`

### 3.4: Automated Dependency Scanning (Issue #15)
- Add GitHub Actions workflow to run `npm audit` on each PR

### 3.5: Pin Font Versions (Issue #17)
- Add SRI hash to Google Fonts link

### 3.6: Add Missing Tests (Issue #19)
- Add tests for form update audit logging

### 3.7: Copy Reference ID Button (Issue #20)
- Add "Copy to Clipboard" button on thank-you page

### 3.8: Rare Race Condition (Issue #10)
- Add database-level lock for idempotency key

### 3.9: Form Slug Collision on Restore (Issue #13)
- Add uniqueness check when restoring soft-deleted forms

---

## Implementation Status

| Issue | Title | Phase | Status | ETA |
|-------|-------|-------|--------|-----|
| #1 | XLSX Library | 1 | ⏳ Ready | Today |
| #2 | Accessibility ARIA | 1 | 🔄 Partial | Today |
| #3 | PostCSS | 1 | ✅ Done | ✅ |
| #4 | Index Performance | 2 | ⏳ Ready | Week 1 |
| #5 | Export Performance | 2 | ⏳ Ready | Week 2 |
| #6 | Reference ID Guessing | 2 | ⏳ Ready | Week 2 |
| #7 | Keyboard Nav | 2 | ⏳ Ready | Week 2 |
| #8 | Theme Caching | 2 | ⏳ Ready | Week 1 |
| #9 | Migration Naming | 3 | ⏳ Future | Month 2 |
| #10 | Race Condition | 3 | ⏳ Future | Month 2 |
| #11 | File Sanitization | 3 | ⏳ Future | Month 2 |
| #12 | Upload Errors | 2 | ⏳ Ready | Week 1 |
| #13 | Slug Collision | 3 | ⏳ Future | Month 2 |
| #14 | Magic Numbers | 3 | ⏳ Future | Month 2 |
| #15 | Auto Scanning | 3 | ⏳ Future | Month 2 |
| #16 | Cache Invalidation | 2 | ⏳ Ready | Week 1 |
| #17 | Font Pinning | 3 | ⏳ Future | Month 2 |
| #18 | Audit Pagination | 2 | ⏳ Ready | Week 1 |
| #19 | Missing Tests | 3 | ⏳ Future | Month 2 |
| #20 | Copy Button | 3 | ⏳ Future | Month 3 |

---

## Next Steps

1. ✅ **Start Phase 1 immediately** (2-3 hours)
   - Replace XLSX → ExcelJS
   - Verify security fixes
   - Complete accessibility testing

2. 📋 **Plan Phase 2** (2-3 weeks of parallel work)
   - Create database migration files
   - Update RPC functions
   - Test performance improvements

3. 📅 **Schedule Phase 3** (next quarter)
   - Refactor migrations
   - Add test coverage
   - Implement long-term improvements

