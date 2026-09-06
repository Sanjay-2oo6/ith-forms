# PHASE 4 & 5: Ongoing & Enterprise Hardening
## Long-term Production Excellence

**Status**: Planning  
**Timeline**: Phase 4 (ongoing, 2-3 hrs/sprint) + Phase 5 (Month 2-3, 20+ hours)  
**Target Readiness**: 85% → 95% by Month 2-3

---

## PHASE 4: Ongoing Improvements (Per Sprint)

These are continuous improvements that can be tackled incrementally alongside feature development.

### Task 4.1: Add Admin Whitelist Audit Logging

**Problem**: Admin whitelist changes aren't logged. Can't track who added/removed admins.

**Solution**: Add audit logging trigger

**What to do**:
1. Create migration 057 with trigger:
```sql
CREATE TRIGGER admin_whitelist_audit
AFTER INSERT OR DELETE ON public.admin_whitelist
FOR EACH ROW EXECUTE FUNCTION public.log_whitelist_change();
```

2. Update migration 023 CHECK constraint to include:
   - `'admin_whitelist.added'`
   - `'admin_whitelist.removed'`

3. Test: Add/remove admin from whitelist → check audit_logs table

**Files to create/update**:
- `supabase/migrations/057_add_whitelist_audit_logging.sql`
- `supabase/migrations/023_audit_actions_canonical.sql` (append 2 actions)

**Effort**: 1 hour  
**Sprint**: Week 4

---

### Task 4.2: WCAG 2.1 AA Accessibility Audit

**Problem**: App doesn't meet WCAG 2.1 AA accessibility standards. Blind/low-vision users, keyboard-only users struggling.

**Solution**: Systematic accessibility improvements

#### Sprint 1: Color Contrast (Week 5)

1. Install axe-core:
```bash
npm install --save-dev axe-core axe-playwright
```

2. Add to Playwright E2E tests:
```typescript
// e2e/accessibility.spec.ts
import { injectAxe, checkA11y } from "axe-playwright";

test("form builder has no critical violations", async ({ page }) => {
  await page.goto("/admin/forms/new");
  await injectAxe(page);
  await checkA11y(page, null, {
    detailedReport: true,
    detailedReportOptions: { html: true }
  });
});
```

3. Run and fix violations:
   - Primary button: Need better contrast (background too light)
   - Form inputs: Labels need `for` attribute linking
   - Links: Need underline or other indication

**Expected fixes**:
- Update `src/styles.css` — primary button background color
- Add `htmlFor` to all form labels
- Add `aria-label` where labels hidden

**Effort**: 2 hours  
**Files**: `e2e/accessibility.spec.ts` (new), `src/styles.css`, component updates

#### Sprint 2: Keyboard Navigation (Week 6)

1. Manual testing checklist:
   - [ ] Can tab through entire form
   - [ ] Can open/close menus with Enter/Escape
   - [ ] Can submit form with Enter key
   - [ ] Focus visible on all interactive elements
   - [ ] Modal dialogs trap focus (can't tab outside)

2. Common fixes:
   - Add `tabIndex={0}` to custom buttons
   - Add `onKeyDown` handlers for Enter/Escape
   - Use `FocusTrap` component for modals
   - Set `outline` focus styles (don't remove)

**Effort**: 2 hours  
**Testing**: Use keyboard only (no mouse) for entire flow

#### Sprint 3: Screen Reader Testing (Week 7)

1. Test with NVDA (Windows) or VoiceOver (Mac):
   - Can screen reader read all form labels?
   - Does it announce form status changes?
   - Can it navigate sections?

2. Common fixes:
   - Add `aria-label` for icon-only buttons
   - Add `aria-live="polite"` for toast notifications
   - Add `role="status"` for save indicators
   - Add `aria-describedby` linking help text to inputs

**Effort**: 2-3 hours  
**Tools**: Free (NVDA for Windows, VoiceOver built-in on Mac)

**Total Phase 4.2 Effort**: 6-7 hours across 3 sprints

---

### Task 4.3: Performance Monitoring & Optimization

**Problem**: Can't see which pages/queries are slow. Need data-driven optimization.

**Solution**: Add performance tracking

**What to do**:

1. Enable Sentry performance monitoring:
```typescript
// Already initialized in Phase 1, but increase sampling
tracesSampleRate: 0.5  // 50% of transactions
```

2. In Sentry dashboard:
   - Go to Performance → Transactions
   - Identify slow pages (>1s)
   - Click to see slow spans (database queries, network, etc.)

3. Common issues & fixes:
   - Slow form load → add pagination (already done Phase 2)
   - Slow responses table → check response count
   - Slow RPC → check database indexes

**Effort**: 1 hour  
**Benefit**: Data-driven optimization priorities

---

### Task 4.4: Add Form Submission Success Rate Monitoring

**Problem**: Don't know how many form submissions are failing.

**Solution**: Track submission metrics

**What to do**:

1. In `src/routes/forms/$slug.tsx`, add logging:
```typescript
try {
  const result = await supabase.rpc("submit_response", {...});
  if (result.ok) {
    logFormSubmission(formId, email, result.reference_id, {
      status: "success",
      time_ms: Date.now() - startTime,
    });
  } else {
    logFormSubmission(formId, email, null, {
      status: "failed",
      error: result.error,
    });
  }
} catch (err) {
  logFormSubmission(formId, email, null, {
    status: "error",
    error: err.message,
  });
}
```

2. In Sentry:
   - Create dashboard: "Form Submissions"
   - Metric: Success rate (should be >99%)
   - Alert if success rate drops below 98%

**Effort**: 1 hour  
**Benefit**: Early warning of submission issues

---

## PHASE 5: Enterprise Hardening (Month 2-3)

Larger initiatives for scale and compliance.

### Task 5.1: Database Performance Optimization (4 weeks)

#### Week 1: Query Analysis
1. Enable slow query logging in Supabase
2. Identify queries >200ms
3. Check missing indexes

Common bottlenecks:
- `get_form_responses_tabular` without form_id index (add if missing)
- Large JOIN operations without USING
- Full table scans on forms/submissions

#### Week 2: Index Optimization
```sql
-- Existing indexes to verify:
-- - forms (id, deleted_at, created_at)
-- - form_questions (form_id, position)
-- - submissions (form_id, submitted_at)

-- Potentially add:
CREATE INDEX IF NOT EXISTS idx_submissions_respondent_email 
  ON public.submissions(respondent_email);

CREATE INDEX IF NOT EXISTS idx_form_sections_position
  ON public.form_sections(form_id, position);
```

#### Week 3: RPC Optimization
- Add `EXPLAIN ANALYZE` to slow RPCs
- Rewrite queries to use indexes
- Add pagination to large result sets

#### Week 4: Testing & Monitoring
- Load test with 10k+ responses
- Monitor query times in Sentry
- Create baseline metrics

**Effort**: 8-10 hours

---

### Task 5.2: Load Testing & Capacity Planning (3 weeks)

#### Week 1: Load Test Setup
```bash
npm run loadtest  # Already exists
```

Configuration:
- 100 concurrent users
- 1000 total submissions
- 30 second ramp-up

Metrics to track:
- Requests/sec
- Avg response time
- 95th percentile response time
- Error rate

#### Week 2: Identify Bottlenecks
From load test results:
- Database queries hitting timeout?
- Netlify function timeout?
- Supabase connection pool exhausted?

Common fixes:
- Increase Supabase connection pool
- Add query timeout handling
- Implement retry logic

#### Week 3: Capacity Planning
Based on load test data:
- Max sustainable submissions/hour
- Max concurrent form visitors
- Cost projections at 2x, 5x, 10x scale

Document:
- SLA: "Support 500 concurrent respondents, 50k submissions/day"
- Scaling strategy: "Replicate DB at 10M rows"
- Budget: "Current cost $X, 5x scale cost $Y"

**Effort**: 6-8 hours

---

### Task 5.3: Full WCAG 2.1 AA Compliance (2 weeks)

After Phase 4.2 initial work, comprehensive audit:

1. Use WAVE tool (wave.webaim.org)
2. Manual testing with screen reader
3. Fix remaining issues:
   - Color contrast on hover states
   - Error messages linked to inputs
   - Form validation messages announced
   - Animated content can be paused

**Effort**: 4-6 hours

---

### Task 5.4: SOC 2 Type II Compliance (2 weeks)

If enterprise customers require SOC 2:

1. Security controls audit:
   - ✅ Access controls (RLS, auth)
   - ✅ Encryption (TLS, at-rest)
   - ⚠️ Audit logging (partially implemented)
   - ⚠️ Incident response (not yet documented)

2. Missing elements:
   - Document incident response playbook
   - Set up security monitoring alerts
   - Create backup/recovery procedures
   - Implement password policies

3. External audit: Cost $3-5k, Timeline 4-6 weeks

**Effort**: 8-12 hours (internal audit), $3-5k (external audit)

---

### Task 5.5: Documentation & Runbooks (1 week)

Create operational playbooks:

1. **Deployment Runbook**
   - How to deploy a hotfix
   - How to roll back
   - How to verify deployment

2. **Incident Response**
   - What to do if submissions failing
   - What to do if database down
   - What to do if security breach suspected
   - Escalation contacts

3. **Scaling Guide**
   - When to increase Supabase plan
   - When to add database replica
   - When to increase function timeout

4. **Monitoring Dashboard**
   - Key metrics (error rate, response time, submissions/hour)
   - Alert thresholds
   - How to debug alerts

**Effort**: 4 hours  
**Outcome**: Team can operate production independently

---

## 📊 Phase 4-5 Timeline

### Month 1 (Ongoing - Phase 4)

| Week | Task | Effort | Status |
|------|------|--------|--------|
| Week 4 | 4.1: Audit logging | 1 hr | Planned |
| Week 5 | 4.2 Sprint 1: Color contrast | 2 hrs | Planned |
| Week 6 | 4.2 Sprint 2: Keyboard nav | 2 hrs | Planned |
| Week 7 | 4.2 Sprint 3: Screen reader | 2-3 hrs | Planned |
| Week 8 | 4.3: Performance monitoring | 1 hr | Planned |
| Ongoing | 4.4: Submission tracking | 1 hr | Planned |
| **Total** | | **9-10 hrs** | |

### Month 2-3 (Enterprise - Phase 5)

| Week | Task | Effort | Status |
|------|------|--------|--------|
| Week 9-10 | 5.1: DB optimization | 8-10 hrs | Planned |
| Week 11-13 | 5.2: Load testing | 6-8 hrs | Planned |
| Week 14-15 | 5.3: WCAG AA full | 4-6 hrs | Planned |
| Week 16-17 | 5.4: SOC 2 compliance | 8-12 hrs | Planned |
| Week 18 | 5.5: Runbooks | 4 hrs | Planned |
| **Total** | | **30-40 hrs** | |

---

## 🎯 Readiness Milestones

| Milestone | Timeline | Readiness | Blocking? |
|-----------|----------|-----------|-----------|
| Phase 0: Fix constraint | Today | → Critical fix | ✅ Deploy today |
| Phase 1-3: Deploy | Week 3 | 65% → 85% | ✅ Deploy week 3 |
| Phase 4: Accessibility | Week 8 | 85% → 88% | ❌ Can defer |
| Phase 5: Enterprise | Month 3 | 88% → 95% | ❌ Can defer |

**Decision**: Deploy Phases 0-3 now (no blocking issues). Do Phases 4-5 based on customer requirements.

---

## 💰 Resource Planning

### Skills Needed
- **Full-stack development**: Phases 0-3 (completed)
- **Accessibility tester**: Phase 4.2 (1 person, part-time)
- **DevOps/SRE**: Phase 5.1-5.5 (contractor or external)
- **Security audit**: Phase 5.4 (external firm)

### Budget
| Item | Cost | Timeline |
|------|------|----------|
| Development (40 hrs @ $50/hr) | $2,000 | Month 2-3 |
| Accessibility audit (external) | $1,000 | Week 8 |
| SOC 2 Type II audit | $3,000-5,000 | Month 3 |
| **Total** | **$6,000-8,000** | | |

---

## ✅ Success Criteria

### Phase 4 (by Week 8)
- [ ] Audit logging added for admin whitelist
- [ ] WCAG AA color contrast fixed
- [ ] Keyboard navigation works
- [ ] Screen reader accessibility tested
- [ ] Performance monitoring active
- [ ] Submission success rate tracked

**Readiness**: 88%

### Phase 5 (by Month 3)
- [ ] Database optimized (queries <200ms)
- [ ] Load test passing (100 concurrent users)
- [ ] Full WCAG 2.1 AA compliance
- [ ] SOC 2 Type II compliance (if needed)
- [ ] Operational runbooks complete

**Readiness**: 95%

---

## 🚀 Quick Start: Phase 4 Week 1

To start Phase 4 immediately:

1. **Read**: Review section "Task 4.1: Admin Whitelist Audit Logging"
2. **Create**: New migration file `supabase/migrations/057_*.sql`
3. **Test**: Add/remove admin, check audit_logs
4. **Deploy**: Commit and deploy
5. **Verify**: Audit logs appear

**Effort**: 1 hour
**Complexity**: Low (just adding logging)
**Can do this**: Week 4 of deployment

---

## 📚 References

- **Accessibility**: https://www.w3.org/WAI/WCAG21/quickref/
- **Load Testing**: https://www.k6.io/ (alternative to our load-test)
- **SOC 2**: https://www.aicpa.org/interestareas/informationmanagement/socialmediakit/downloadabledocuments/soc2-faqs.pdf
- **Database Optimization**: PostgreSQL official docs on EXPLAIN ANALYZE

---

**Questions?** Each phase includes specific code examples and effort estimates. Start with Phase 4 week 1 for quick wins.
