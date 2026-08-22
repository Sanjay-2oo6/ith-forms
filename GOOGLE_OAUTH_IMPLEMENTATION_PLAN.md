# Google OAuth + Per-Email Submission Limits — Implementation Plan

## Overview
Implement Google Sign-in authentication for public forms with configurable per-email submission limits (like Google Forms). Respondents verify via Google OAuth, auto-populate their name/email, and are limited to a configurable number of submissions per email per form.

---

## Feature Specification

### User Experience Flow

#### Public Respondent Flow
1. Respondent opens public form → sees "Sign in with Google" button (top of form)
2. Clicks → redirects to Google consent screen
3. Approves → redirected back to form with email verified
4. Form auto-fills:
   - `respondent_name` = Google account name
   - `respondent_email` = Google email (verified by Google)
5. Respondent fills and submits form
6. Submission counts against their email's per-form limit
7. If they open the form again with same email:
   - **If limit reached**: Show "✓ You've already submitted this form" (no submit button)
   - **If limit NOT reached**: Show "You've submitted this form before" + "Submit Another Response" button

#### Admin Control Flow
1. Admin creates/edits form
2. In form settings, sees new field: "Responses per email"
   - Options: Unlimited | 1 | 2 | 3 | 5 | 10 | Custom
   - Default: Unlimited (backward compatible)
3. Admin saves → limit applied to form
4. When viewing responses, admins can see:
   - Email of respondent (verified via Google)
   - Name (auto-filled from Google)
   - How many times this email has submitted
   - Submission count against per-email limit

---

## Database Schema Changes

### Table: `forms` (Modification)
Add one column:
```sql
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS responses_per_email_limit integer;
  -- NULL = unlimited (default)
  -- 1, 2, 3, ... = max submissions per email per form
```

### Table: `verified_emails` (New)
Tracks email verification & submission counts per form.

```sql
CREATE TABLE public.verified_emails (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id                 uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  email                   text NOT NULL,
  submission_count        integer NOT NULL DEFAULT 0,
  first_submitted_at      timestamptz NOT NULL DEFAULT now(),
  last_submitted_at       timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(form_id, email),
  INDEX idx_verified_emails_form_email (form_id, email),
  INDEX idx_verified_emails_created_at (first_submitted_at DESC)
);

-- RLS Policy: anon can insert/update only their own email
CREATE POLICY "anon_verified_emails_insert_own" ON public.verified_emails
  FOR INSERT TO anon
  WITH CHECK (true);  -- RPC will validate

CREATE POLICY "anon_verified_emails_read_own" ON public.verified_emails
  FOR SELECT TO anon
  USING (true);  -- RPC will validate email via session
```

---

## RPC Updates

### 1. `verify_google_email(p_form_id uuid, p_email text)` — NEW
**Purpose**: Called after Google OAuth callback to mark an email as verified for the session.

**Behavior**:
- Store email in session context (or trust Supabase auth session)
- Return the email + any prior submission count

**Returns**:
```json
{
  "email": "user@gmail.com",
  "submission_count": 1,
  "limit": 3
}
```

### 2. `submit_response()` — MODIFY
**Current**: Takes `p_email` (respondent's email), validates form, inserts submission

**New Logic**:
```
1. Extract email from Supabase auth session (verified by Google)
2. Check if email has submission count record in verified_emails
   a. If not found → first submission, create row with count=1
   b. If found → check count against form's responses_per_email_limit
      - If limit NULL → allow unlimited submissions
      - If count >= limit → raise exception 'email_limit_reached'
      - If count < limit → increment count + 1, allow submission
3. Insert submission with respondent_name + respondent_email (from Google)
4. Update verified_emails.last_submitted_at
```

**Error Handling**:
- `email_limit_reached` — user has submitted max times
- `form_unavailable` — form not published/deleted
- `form_not_open` — scheduled form not yet open
- `form_closed` — form close date passed
- `limit_reached` — form's global max_responses hit

### 3. `get_submission_count_for_email(p_form_id uuid, p_email text)` — NEW
**Purpose**: Called on form load to check if user has already submitted & how many times

**Returns**:
```json
{
  "submission_count": 2,
  "limit": 3,
  "can_submit": true,
  "message": "You have submitted this form 2 of 3 times"
}
```

---

## Frontend Implementation

### Phase 1: Auth Routes & Session Management

#### New File: `src/routes/auth/google-callback.tsx`
- Google OAuth redirect target
- Extracts `id_token` + email from Supabase session
- Stores in context/localStorage: `{ email, name, verified: true }`
- Redirects to form page (preserves slug in query)

#### Modify: `src/integrations/supabase/client.ts`
- Add method: `getAuthSession()` → returns `{ email, name, user }`
- Add method: `signOutGoogle()` → logs out, clears session

#### New Hook: `src/lib/use-auth.ts`
```typescript
export function useAuth() {
  const [session, setSession] = useState(null);
  useEffect(() => {
    supabase.auth.getSession().then(data => setSession(data));
  }, []);
  return session;
}
```

### Phase 2: Public Form Page (`src/routes/forms/$slug.tsx`)

#### Component Changes
1. **Top of form**: Add auth header
   - If NOT signed in: "Sign in with Google" button → redirects to Supabase OAuth URL
   - If signed in: Show "Signed in as: [name] ([email])" + "Sign out" button

2. **Before form content**: Add submission status card
   - Check `get_submission_count_for_email(formId, email)` on mount
   - If `submission_count > 0`:
     - Show: "✓ You've already submitted this form"
     - If `can_submit`: Show "Submit Another Response" button below form
     - If NOT `can_submit`: Hide form, show "No more submissions allowed"

3. **Form submission logic**:
   - Call `submit_response()` with email from session (not manual input)
   - On success: Show thank-you page with submission count
   - On `email_limit_reached`: Show "You've reached the submission limit for this form"

4. **Auto-fill logic**:
   - If signed in: `respondent_name` + `respondent_email` pre-filled, read-only
   - If NOT signed in: Show "Sign in with Google to continue"

#### Type Updates
```typescript
type FormState = "loading" | "unavailable" | "upcoming" | "closed" | "limit" 
                | "auth_required" | "already_submitted" | "ready" | "submitting" | "done";

type SubmissionStatus = {
  email: string;
  submission_count: number;
  limit: number | null;
  can_submit: boolean;
};
```

### Phase 3: Admin Settings (`src/routes/_admin/forms/$formId/settings.tsx`)

#### New Form Field
- **Label**: "Responses per email"
- **Type**: Dropdown + optional custom input
- **Options**:
  ```
  ☐ Unlimited (default)
  ☐ 1 response per email
  ☐ 2 responses per email
  ☐ 3 responses per email
  ☐ 5 responses per email
  ☐ 10 responses per email
  ☐ Custom: [__________]
  ```
- **Default**: Unlimited (NULL in DB)
- **Save**: Updates `forms.responses_per_email_limit`

#### New Column in Responses Table
- Add column: "Submission Count" (e.g., "2 of 3")
- Shows `verified_emails.submission_count` / `forms.responses_per_email_limit`
- Sortable by count

---

## Implementation Phases

### Phase 0: Database Migrations
**Files**:
- `supabase/migrations/044_google_oauth_schema.sql`
  - Add `responses_per_email_limit` to `forms`
  - Create `verified_emails` table
  - Add RLS policies
  - Add indexes

**Deployment**: Manual SQL in Supabase editor

---

### Phase 1: RPC Functions
**Files**:
- `supabase/migrations/045_google_oauth_rpcs.sql`
  - `verify_google_email(p_form_id, p_email)` — NEW
  - `get_submission_count_for_email(p_form_id, p_email)` — NEW
  - `submit_response()` — MODIFIED (add email limit check)

**Key Logic**:
```
submit_response():
  - Extract email from Supabase session (verified by Google)
  - Check verified_emails for this form + email
  - If not found: INSERT with count=1
  - If found: check count vs limit
    - If count >= limit AND limit IS NOT NULL: RAISE 'email_limit_reached'
    - Else: UPDATE count = count + 1
  - INSERT submission as before
```

**Deployment**: Manual SQL in Supabase editor

---

### Phase 2: Frontend Auth Routes
**Files**:
- `src/routes/auth/callback.tsx` — Google OAuth callback handler
- `src/integrations/supabase/client.ts` — Add auth helper methods
- `src/lib/use-auth.ts` — Custom hook for session management

**Key Features**:
- Parse `#access_token` from URL fragment
- Exchange for session via Supabase
- Extract email + name from `user.user_metadata`
- Redirect back to form with session

**Deployment**: No DB changes

---

### Phase 3: Public Form UI
**Files**:
- `src/routes/forms/$slug.tsx` — MODIFY to:
  - Add auth status header
  - Add "Sign in with Google" button
  - Fetch submission count on load
  - Show "already submitted" message + "Submit Another" button logic
  - Auto-fill name/email from session
  - Handle `email_limit_reached` error

**Key UI Flows**:
1. **Not signed in**: Show form with "Sign in with Google" button at top
2. **Signed in, no prior submissions**: Show form normally, auto-filled email/name
3. **Signed in, prior submissions, can submit more**: Show "You've submitted X of Y times" + form
4. **Signed in, reached limit**: Show "You've reached the submission limit" message, hide form

**Deployment**: No DB changes

---

### Phase 4: Admin Settings
**Files**:
- `src/routes/_admin/forms/$formId/settings.tsx` — MODIFY to:
  - Add "Responses per email" dropdown
  - Save to `forms.responses_per_email_limit`
  - Show in form settings tab

- `src/components/responses/ResponsesTable.tsx` — MODIFY to:
  - Add "Submission Count" column
  - Show count as "2 of 3" format
  - Sort by count

**Deployment**: No DB changes

---

### Phase 5: Testing & Validation

#### Unit Tests
- `src/lib/use-auth.test.ts` — auth hook
- `submit_response` RPC tests against real Supabase project

#### Integration Tests
- E2E: Sign in → submit → check submission count
- E2E: Reach limit → see blocked message
- E2E: Admin sets limit → verify enforcement

#### Manual Testing
- **Test Case 1**: Submit multiple times, reach limit, verify message
- **Test Case 2**: Admin sets limit to 1, respondent submits twice, verify second blocked
- **Test Case 3**: Admin changes limit from 1 → 3, respondent can submit again
- **Test Case 4**: Different emails submit, verify each tracked independently

---

## Configuration Changes

### Environment Variables (`.env`)
No new variables needed. Google OAuth already configured via Supabase dashboard.

### Supabase Dashboard Setup (Manual)
1. Go to Authentication → Providers → Google
2. Ensure Client ID + Secret are set
3. Verify redirect URI: `https://<your-supabase>.supabase.co/auth/v1/callback`

---

## Backward Compatibility

- **Existing forms**: `responses_per_email_limit` = NULL → unlimited submissions (default)
- **Existing submissions**: No changes; will show with email from prior respondent data
- **Old respondents (before OAuth)**: Can still use if form allows anonymous submissions
- **Opt-in**: Admins can enable per-email limits per form (no forced change)

---

## Error Messages & User Feedback

### Public Form Errors
```
✗ email_limit_reached
  "You've reached the submission limit for this form. Try again later."

✓ already_submitted (not an error, but status)
  "You've already submitted this form. [Submit Another Response button]"

✓ need_auth (informational)
  "Sign in with Google to submit this form."
```

### Admin Messages
```
Responses per email limit set to: 3
Form will accept up to 3 responses per unique email.
```

---

## Success Criteria

✅ Respondents can sign in with Google  
✅ Name auto-fills from Google account  
✅ Email verified & tracked  
✅ Admin can set per-email limits  
✅ Submission count enforced (prevent over-limit)  
✅ "Already submitted" message shows when revisiting  
✅ "Submit Another" button appears only if limit allows  
✅ Backward compatible (existing forms unaffected)  
✅ Admins see submission counts in responses table  

---

## Timeline Estimate

| Phase | Task | Effort | Duration |
|-------|------|--------|----------|
| 0 | Database migrations | Low | 30 min |
| 1 | RPC functions | Medium | 1 hour |
| 2 | Auth routes & hooks | Medium | 1.5 hours |
| 3 | Public form UI | High | 2 hours |
| 4 | Admin settings | Medium | 1.5 hours |
| 5 | Testing | High | 2 hours |
| — | **Total** | — | **~8 hours** |

---

## Files to Create/Modify

### New Files
- `supabase/migrations/044_google_oauth_schema.sql`
- `supabase/migrations/045_google_oauth_rpcs.sql`
- `src/routes/auth/callback.tsx`
- `src/lib/use-auth.ts`

### Modified Files
- `src/routes/forms/$slug.tsx` (major changes)
- `src/integrations/supabase/client.ts`
- `src/routes/_admin/forms/$formId/settings.tsx`
- `src/components/responses/ResponsesTable.tsx`

### Updated Types
- `src/integrations/supabase/types.ts` (auto-generated after migrations)

---

## Rollback Plan

If issues arise:
1. **Before deployment**: Take Supabase backup
2. **If schema breaks**: `DROP TABLE verified_emails;` + remove `responses_per_email_limit` from `forms`
3. **If RPC breaks**: `DROP FUNCTION submit_response(...)` and restore from previous migration
4. **If UI breaks**: Revert frontend files to previous commit

---

## Next Steps

1. ✅ Review this plan with user
2. → Start Phase 0: Create database migration SQL
3. → Create Phase 1: RPC functions
4. → Implement Phase 2: Auth routes
5. → Implement Phase 3: Public form UI
6. → Implement Phase 4: Admin settings
7. → Phase 5: Testing & validation

