# ITH-FORMS — Form Builder & Response Collection

**Self-hosted form builder and response collection platform.** Admins design and publish forms; anyone with the public link submits responses via Google Sign-in; admins review, track statuses, and export — all backed by Supabase with end-to-end row-level security.

Built with **React 19** · **TanStack Start/Router/Query** · **Tailwind CSS v4** · **Supabase** (Postgres + Auth + Storage) · **TypeScript (strict)**.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Quick Start](#quick-start)
5. [Commands](#commands)
6. [Project Structure](#project-structure)
7. [Development Conventions](#development-conventions)
8. [Key Implementation Details](#key-implementation-details)
9. [Security Overview](#security-overview)
10. [Security Patches (2026)](#security-patches-2026)
11. [Deployment](#deployment)
12. [Known Limitations](#known-limitations)
13. [License](#license)

---

## Features

### Form Builder
- **Drag-and-drop UI** — intuitive section and question reordering
- **14+ question types** — text, email, phone, URL, number, name, address, organization, long_text, short_text, choice (radio), checkbox, dropdown, date, time, rating, grid, file upload, document upload, image upload
- **Question templates** — quick-insert pre-configured questions
- **Per-question validation** — min/max length, required fields, file size/type, rating scales, grid row/column configs
- **Atomic saves** — explicit "Save" button with debounce (600ms) + save indicator
- **Live preview** — desktop & mobile previews of unsaved drafts
- **Theming** — custom colors, background images, logo upload, confirmation message

### Publishing
- **Public URL** — one shareable link per form
- **Open/close scheduling** — restrict submissions by date/time
- **Response limits** — cap total submissions with overflow handling
- **Consent text** — optional GDPR/privacy checkbox
- **QR code & social sharing** — built-in distribution tools
- **Duplication** — clone entire forms with all sections/questions/theme
- **URL pre-fill** — respondents pre-populate answers via `?name=…&email=…`
- **Preview mode** — `?preview=1` for testing without incrementing counts

### Response Collection
- **Multi-page forms** — automatic pagination across sections
- **Client & server validation** — real-time UI feedback + DB-level constraints
- **Idempotent submission** — replay-safe with per-form reference IDs (`ABBR-form-00001`)
- **Secure file uploads** — private S3-like storage, signed/expiring download URLs
- **Respondent access** — "view your submission" link with reference token
- **Google Sign-in** — one-click OAuth, verified email = one submission per respondent per form

### Response Management
- **Server-side filtering** — search by name/email, filter by status, date range
- **Bulk actions** — change status, add notes, or delete multiple submissions at once
- **Status tracking** — full history of status changes with timestamps & user
- **Notes & audit trail** — internal comments logged with admin identity
- **XLSX export** — responses with file references; formula-injection hardened
- **File access** — secure download/preview with admin-only permissions

### Administration
- **Dashboard** — submission trends, form count, recent activity
- **Audit log** — all mutations with readable action labels (create, edit, delete, etc.) + admin email + timestamp
- **Settings** — global branding (logo, name, colors), default form appearance, default confirmation message
- **Health checks** — database connectivity, file storage status, email delivery (if enabled)
- **Dark/light mode** — automatic theme switching

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TanStack Router (file-based), TanStack Query |
| **Styling** | Tailwind CSS v4, CSS variables (design tokens in `src/styles.css`) |
| **UI Components** | Lucide icons, Sonner toasts, custom form inputs |
| **Database** | Supabase (managed Postgres) |
| **Authentication** | Supabase Auth + Google OAuth |
| **Storage** | Supabase Storage (S3-compatible private bucket) |
| **Type Safety** | TypeScript (strict mode) |
| **Form Handling** | Zod (validation schemas) |
| **Drag & Drop** | @dnd-kit (accessible sortable lists) |
| **CSV/XLSX** | fast-csv, exceljs |
| **QR Codes** | qrcode |
| **Build & Deploy** | TanStack Start (Vite + Nitro SSR), Netlify (or any Node 18+ host) |
| **Testing** | Vitest (unit), Playwright (E2E + visual regression) |

---

## Architecture

### High-Level Flow

```
┌─────────────────┐
│  Admin Browser  │
└────────┬────────┘
         │ Auth + RLS
         ▼
    ┌────────────────────┐
    │  Supabase (Auth)   │ ◄──── Admin session
    └────────────────────┘
         │
         ├──────────────────────────────┐
         │                              │
         ▼                              ▼
    ┌─────────────────┐    ┌──────────────────┐
    │  Admin Tables   │    │  Forms/Questions │
    │  (RLS-gated)    │    │  Submissions/    │
    │                 │    │  Answers (RLS)   │
    └─────────────────┘    └──────────────────┘
                                   │
                                   │
┌──────────────────────────────────┐
│  Public Respondent (Google OAuth)│
└──────────────────────────────────┘
         │ Anon + verified_email
         ▼
    ┌────────────────────┐
    │ Published Forms    │ (read via RLS)
    │ Submit via RPC     │ (submit_response)
    └────────────────────┘
         │
         ▼
    ┌────────────────────┐
    │  Submissions       │ (one per verified email per form)
    │  Submission Files  │ (private bucket)
    │  Submission_Answers│
    └────────────────────┘
```

### No Custom Backend
The browser talks **directly to Supabase** via the anon key. The bundled Nitro server (`src/server.ts`) only provides:
- **Security headers** — CSP, HSTS, X-Frame-Options
- **Health check** — `GET /health` for monitoring
- **Static asset serving** — HTML, JS, CSS

### Admin Access
- **RLS Policies** — every admin table row has `is_admin()` check; requires active row in `admin_users` table + authenticated Supabase session
- **Query keys** — `["form-meta", formId]`, `["responses-tabular", formId, …filters]`, `["forms-list", showTrash]`, `["audit-logs"]`
- **Mutations** — auto-invalidate cached data after save

### Public Form Submission
- **Read** — published forms via anon RLS policies (only `status='published'` and not deleted)
- **Write** — **only** through `submit_response()` SECURITY DEFINER RPC (no direct table insert)
  - Validates form exists, is published, and accepts submissions
  - Checks `max_responses` with row-level locking (race-safe)
  - Checks Google-verified email not already submitted to this form
  - Returns reference ID for respondent tracking
- **Idempotency** — same `idempotency_key` twice = returns original submission, no duplicate

### File Handling
- **Upload flow**
  1. Frontend generates `submission_id` + signs upload URL to private bucket
  2. Browser uploads file directly to Supabase Storage
  3. Frontend calls `register_submission_file()` RPC to record metadata (path, size, mime type)
  4. RPC validates: path belongs to submission, file size < 10 MB, question exists
- **Download flow**
  1. Admin clicks "Download" on submission
  2. Backend generates signed, expiring URL (15 min)
  3. URL grants temporary access to private file
  4. Browser downloads; signature expires

---

## Quick Start

### Prerequisites
- Node.js 18+ (20+ recommended)
- npm (comes with Node)
- A [Supabase](https://supabase.com) project (free tier works)
- Google OAuth credentials (Client ID + Secret from Google Cloud Console)

### 1. Clone & Install
```bash
git clone https://github.com/innotech-hub/ith-forms.git
cd ith-forms
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env`:
```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Both are safe to commit (RLS + Google OAuth govern access). **Never** include the service-role key.

### 3. Set Up Database
1. Go to [Supabase Dashboard](https://app.supabase.com) → SQL Editor
2. Run every migration file in `supabase/migrations/` **in canonical order** (see [docs/migrations.md](docs/migrations.md))
3. Add your admin email to the whitelist:
   - Run this query:
     ```sql
     INSERT INTO public.admin_whitelist (email, approved_by)
     SELECT id, id FROM auth.users 
     WHERE email = 'your-admin@example.com'
     LIMIT 1;
     ```
   - Replace `your-admin@example.com` with your actual email
   - Verify it worked:
     ```sql
     SELECT email, approved_at FROM public.admin_whitelist;
     ```

### 4. Set Up Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to Credentials → Create OAuth 2.0 Client ID (Web application)
5. Add authorized redirect URIs:
   - `https://<your-supabase-project>.supabase.co/auth/v1/callback`
   - `http://localhost:3000/auth/v1/callback` (for local dev)
6. Copy **Client ID** and **Client Secret**
7. Go to [Supabase Dashboard](https://app.supabase.com) → Authentication → Providers → Google
8. Enable Google, paste Client ID and Secret, Save

### 5. Run Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000). Sign in at `/admin/login` with your admin email.

### 6. Create Your First Form
1. Click "New Form" on the admin dashboard
2. Add sections and questions via drag-and-drop
3. Click "Save" to commit
4. Go to "Publish" tab, set title/description, click "Publish"
5. Share the public URL or QR code with respondents

---

## Commands

| Command | Purpose | Notes |
|---|---|---|
| `npm run dev` | Dev server (Vite + Nitro) | Port 3000, hot reload |
| `npm run build` | Production build | Output: `dist/` + `.netlify/` |
| `npm run typecheck` | TypeScript strict check | No build, fast feedback |
| `npm test` | Unit tests (Vitest) | `src/**/*.test.ts` |
| `npm run test:rpc` | Integration tests | Real Supabase project (opt-in) |
| `npm run test:e2e` | Playwright E2E | Needs `E2E_ADMIN_EMAIL/PASSWORD` |
| `npm run test:visual` | Visual regression tests | Needs `E2E_PUBLIC_SLUG` |
| `npm run loadtest` | Submission load test | Needs `LT_FORM_ID`, `LT_CONFIRM=yes` |

---

## Project Structure

```
src/
├── routes/                    # TanStack Router (file-based)
│   ├── _admin/
│   │   ├── route.tsx          # Layout + auth guard
│   │   ├── dashboard.tsx
│   │   ├── forms/
│   │   │   ├── index.tsx      # Forms list
│   │   │   ├── $formId/
│   │   │   │   ├── edit.tsx   # Form builder
│   │   │   │   ├── responses/ # Response management
│   │   │   │   └── settings/  # Form settings
│   │   ├── audit.tsx          # Audit log
│   │   ├── settings.tsx       # Global settings
│   │   └── profile.tsx        # Admin profile
│   ├── forms/
│   │   └── $slug.tsx          # PUBLIC form renderer (anon)
│   ├── view-response/
│   │   └── $referenceId.tsx   # Respondent's view-only submission
│   ├── auth/
│   │   └── callback.tsx       # Google OAuth callback
│   └── index.tsx              # Home/redirect
│
├── components/
│   ├── form-builder/          # Builder UI (drag-drop, preview)
│   │   ├── QuestionCard.tsx
│   │   ├── SectionBlock.tsx
│   │   ├── BuilderTab.tsx
│   │   ├── SettingsTab.tsx
│   │   └── PreviewModal.tsx
│   ├── responses/             # Response management UI
│   │   ├── ResponsesTable.tsx
│   │   ├── FilterBar.tsx
│   │   ├── BulkActions.tsx
│   │   └── ExportDialog.tsx
│   ├── admin-shell/           # Sidebar, nav, auth layout
│   ├── public-form/           # Form renderer & pagination
│   ├── ui.tsx                 # Shared form inputs, buttons, Field wrapper
│   └── shared/                # Dialogs, modals, loaders
│
├── lib/
│   ├── validation.ts          # Zod schemas (FormCreateSchema, SubmitPayloadSchema, etc.)
│   ├── responses.ts           # Export pipeline, filtering, sorting
│   ├── duplicate-form.ts      # Form cloning logic
│   ├── ith-brand.ts           # Branding hooks (logo, colors)
│   ├── theme-utils.ts         # Theme container styles
│   ├── audit-labels.ts        # Human-readable audit action names
│   └── date-utils.ts          # Date formatting, timezone handling
│
├── integrations/
│   └── supabase/
│       ├── client.ts          # Supabase client instance
│       └── types.ts           # TypeScript types (auto-generated from Supabase)
│
├── styles.css                 # Tailwind + CSS variable tokens
└── server.ts                  # Nitro server (headers, health check)

supabase/
├── migrations/                # SQL migrations (run manually)
│   ├── 001_schema_and_functions.sql
│   ├── 005_security_hardening.sql
│   ├── 010_reference_ids.sql
│   ├── 014_add_your_admin_user.sql
│   └── ... (see docs/migrations.md for order)
└── seed.sql                   # (Optional) test data

docs/
├── README.md                  # This file
├── api-rpc.md                 # RPC function signatures & examples
├── database-schema.md         # Tables, columns, RLS policies
├── migrations.md              # Migration order, numbers, fixes
├── security.md                # Security model, CSP, audit
├── testing.md                 # Unit/integration/E2E setup
├── deployment.md              # Platform-specific guides
└── load-testing.md            # Load test usage

e2e/                           # Playwright E2E + visual specs
├── fixtures/
├── auth.setup.ts
├── admin.spec.ts
├── public-form.spec.ts
└── ...

tests/
├── integration/               # RPC & RLS tests
├── unit/                      # Utility tests
└── ...

.env.example                   # Template
netlify.toml                   # Netlify build config
vite.config.ts                 # Vite + Nitro config
tsconfig.json                  # TypeScript strict config
```

---

## Development Conventions

### State Management
- **Route components** own state + Supabase calls
- **Presentational components** in `src/components/` receive data via props
- **No Redux/Zustand** — local state + TanStack Query cache only
- **Query invalidation** — call `queryClient.invalidateQueries()` after mutations, not manual refetch

### Query Keys
```typescript
["form-meta", formId]              // Single form metadata
["forms-list", showTrash]          // Admin forms list
["option-map", formId]             // Question option labels/values map
["responses-tabular", formId, filters]  // Paginated responses table
["submission-detail", submissionId]     // Single submission + answers
["audit-logs", page, limit]        // Admin audit log
```

### Saving Pattern (Debounced)
```typescript
// In form builder or settings:
const [title, setTitle] = useState(form.title);

const debouncedSave = useMemo(() =>
  debounce(async (newTitle) => {
    try {
      await supabase.from("forms").update({ title: newTitle }).eq("id", formId);
      queryClient.invalidateQueries(["form-meta", formId]);
    } catch (e) {
      toast.error("Save failed");
    }
  }, 600),
  []
);

return (
  <input 
    value={title} 
    onChange={(e) => {
      setTitle(e.target.value);
      debouncedSave(e.target.value);
    }}
  />
);
```

### Audit Logging
Every admin mutation auto-writes an `audit_logs` row (trigger-based). Action values are DB-constrained:
```
'form_created', 'form_edited', 'form_published', 'form_unpublished', 'form_deleted',
'submission_status_changed', 'submission_deleted', 'submission_note_added',
'user_invited', 'settings_updated', 'export_generated'
```

### Error Handling
- **User-facing errors** → Toast (Sonner): `toast.error("Failed to save")`
- **Developer errors** → Console: `console.error("Unexpected state", error)`
- **RLS violations** → Supabase returns 403; catch + toast "Access denied"

### Styling
- **Tailwind utilities only** — no custom CSS in components
- **Design tokens** via CSS variables in `src/styles.css`:
  ```css
  :root {
    --color-primary: #3b82f6;
    --color-secondary: #10b981;
    --font-sans: system-ui, sans-serif;
    /* ... */
  }
  ```
- **Primary buttons** become pills via:
  ```css
  .btn-primary { @apply px-6 py-2 rounded-full; }
  ```

### Comments
Explain **why**, not what. Reference bug fixes:
```typescript
// B123: Skip validation on pre-filled emails (they come from Google OAuth)
if (isPrefilled) {
  // ...
}

// F45: Debounce to 600ms per design feedback; 300ms was too aggressive
const debouncedSave = useMemo(() => debounce(save, 600), []);
```

### Type Safety
- **Strict mode enabled** in `tsconfig.json`
- **Zod schemas** validate all RPC inputs/outputs
- **Database types** auto-generated from Supabase schema (see `docs/database-schema.md`)

---

## Key Implementation Details

### Google Sign-in Flow
1. User clicks "Sign in with Google" on public form
2. Frontend generates cryptographically secure `state` parameter (CSRF protection)
3. Stores `state` in sessionStorage
4. Supabase redirects to Google consent → user approves
5. Google returns `id_token` + email to `/auth/callback?state=…`
6. Frontend validates `state` matches stored value (prevents CSRF)
7. Supabase auth session created
8. Frontend extracts email + name from session
9. Frontend calls form submission with verified Google email
10. **Result**: One submission per unique verified email per form

### Idempotent Submission
- Frontend generates UUID `idempotency_key` before first attempt
- Calls `submit_response(..., idempotency_key: 'abc-123')`
- If network fails → retry with same key
- RPC checks: does a submission with `idempotency_key='abc-123'` exist?
  - Yes → return original submission ID (no duplicate)
  - No → insert new row + generate secure reference token + return ID & token
- **Race-safe** via unique index on `idempotency_key`
- **Returns**: Both `reference_id` (human-readable) and `reference_token` (secure)

### Reference IDs & Tokens
**Reference ID** (human-readable, admin-visible):
- Format: `{FORM_ABBR}-{form-prefix}-{00001}`
- `FORM_ABBR` — 4-letter application code (e.g., "ITH_")
- `form-prefix` — 1–8 char form slug (e.g., "app")
- `00001` — zero-padded sequence per form
- Example: `ITH_-app-00001`, `ITH_-app-00002`
- Generated via RPC `next_reference_id(formId)` with row locking

**Reference Token** (secure, unpredictable):
- 256-bit cryptographically random value
- Base64url encoded (URL-safe)
- Example: `jK7mP9qRsT2uVwXyZaBcDeFgHiJkLmNoPqRsTuVwXy_Z`
- Used in public links: `/view-response/{referenceToken}`
- Cannot be guessed; prevents enumeration attacks
- Generated via `encode(gen_random_bytes(24), 'base64url')`

**Admin View**: Reference ID displayed (readable, trackable)
**Public View**: Reference Token used in URLs (secure, non-enumerable)

### Submission Access Control
**Respondent can view their submission** via reference token:
- `/view-response/{referenceToken}` → calls `get_submission_by_token(token)`
- Token is unpredictable; no way to enumerate other submissions
- Respondent receives token after form submission

**Admin can view any submission** via reference ID:
- Admin dashboard shows reference ID
- `/admin/forms/{formId}/responses/{refId}` → calls `get_submission_by_reference(id)`
- Requires admin authentication
- Access control: checks if user is admin OR user email matches respondent email

### URL Pre-fill
Query params like `?name=John&email=john@example.com` auto-populate compatible questions:
- **Type match**: `?email=…` fills the "email" question
- **Label match**: `?full_name=…` fills a question labeled "Full Name"
- **Substring match**: `?contact=…` fills "Contact Information" (if 3+ char key)
- **Validation**: pre-fill values are capped at 500 chars; full validation still applies on submit

### Rate Limiting
- **Limit**: 10 submissions per hour per email (sliding window)
- **Table**: `submission_rate_limit` tracks submission attempts
- **Check**: Before processing, RPC counts submissions in past hour
  - Count ≥ 10 → reject with "Rate limit exceeded"
  - Count < 10 → allow + record attempt
- **Scope**: Per form + per email (same person, different forms = separate limits)
- **Logging**: Rate limit violations logged to `audit_logs`

### XLSX Export
1. Fetch all submissions + answers for the form
2. Build column headers from question labels
3. Rows = submissions; cells = stringified answers (arrays joined with `||`)
4. **Injection hardening**: wrap cells with formula-like starts (`=`, `+`, `-`, `@`) in `'` prefix → `'=SUM(…)` renders as text
5. Stream to browser as attachment

### File Upload Security
- **Client**: Frontend signs upload URL, user's browser uploads directly to private bucket
- **Server**: `register_submission_file()` RPC validates:
  - Submission exists + is fresh (< 1 hour old)
  - Question belongs to same form
  - **File path is strict**: must be exactly `{submission_id}/{filename}` (no subdirectories, no `../`, no double slashes)
  - File size < 10 MB
  - Mime type whitelisted
  - No null bytes, control characters, or hidden files
- **Traversal prevention**: Logs attempts to escape submission folder to `audit_logs`
- **Access**: Admin downloads via signed URL (15 min expiry) → automatic revocation

---

## Security Overview

### Row-Level Security (RLS)
Every table has RLS enabled. Policies check:
- **Admin tables** (`forms`, `form_questions`, `form_sections`, `audit_logs`) — require `is_admin()` + authenticated session
- **Submissions** — anon can only call `submit_response()` RPC; cannot read/write directly
- **Public forms** — anon can read published, non-deleted forms only
- **Files** — private bucket; admins read via signed URLs
- **verified_emails** — admin-only read; modifications only via `submit_response()` RPC

### Authentication & Authorization
- **Admin login** — Google OAuth (one verified email = one admin per form)
- **Public respondents** — Google OAuth (one verified email = one submission per form)
- **Admin whitelist** — `admin_whitelist` table gates admin provisioning. Only whitelisted emails can become admins
  - Prevents auto-admin-on-first-login vulnerability
  - Admins must be explicitly approved before access
  - See `Setup Database` section for how to add your email
- **No self-signup** for admins (deliberate security boundary)
- **Service-role key** never shipped to frontend (stays on backend only)

### Submission Security
- **Reference tokens** — secure, unpredictable tokens for public submission links
  - Sequential reference IDs hidden from public (admin-only)
  - Public links use `reference_token` (256-bit crypto-random base64url)
  - Prevents enumeration attacks (cannot guess other submissions)
- **Email validation** — `submit_response()` RPC validates submitted email matches authenticated session
  - Prevents email tampering/impersonation
  - Logs mismatch attempts to audit trail
- **Rate limiting** — max 10 submissions per hour per email (sliding window)
  - Prevents spam and DoS attacks
  - Per-form enforcement
- **Idempotent submission** — same `idempotency_key` returns original (no duplicates)
  - Race-safe via unique index + row-level locking

### OAuth Security
- **CSRF protection** — state parameter validation on OAuth callback
  - Prevents attackers from redirecting users to fake auth flows
  - State generated client-side, stored in sessionStorage, validated on return
  - Mismatch → reject with error message
- **Verified Google tokens** — email/name come directly from Google, not user input

### File Upload Security
- **Path traversal protection** — strict validation prevents `../` and directory escape attempts
  - Paths must be exactly `{submission_id}/{filename}`
  - No subdirectories, double slashes, null bytes, or special characters allowed
  - Logs traversal attempts to audit trail
- **Size limits** — file < 10 MB (configurable per question, max 50 MB)
- **Type validation** — MIME types whitelisted per question config
- **Private storage** — all files in private bucket; access via signed URLs only
- **Signed URLs** expire in 15 min (automatic revocation)
- **Admin-only access** — users cannot download others' files

### No Direct Anon Writes
- Pre-2024: anon users could directly `INSERT` into `submissions` (security hole)
- Migration 005 + 051 dropped all legacy anon policies
- **Now**: anon **only** calls `submit_response()` RPC (SECURITY DEFINER validates everything):
  - Validates form is published
  - Validates email matches session
  - Validates per-form response limits
  - Checks rate limits
  - Generates secure reference token
- Result: Cannot forge reference IDs, cannot skip validation, cannot submit to unpublished forms

### Input Validation
- **Client**: Zod schemas validate on form change (UX feedback)
- **Server**: `submit_response()` RPC re-validates all answers:
  - Array length < 50
  - String values < 20,000 chars
  - Questions must belong to the form
  - Required fields present
  - Email matches authenticated session (NEW)
  - Rate limits enforced (NEW)

### Content Security Policy (CSP)
```
script-src 'unsafe-inline' https://accounts.google.com;
frame-src https://accounts.google.com;
style-src 'unsafe-inline' 'nonce-{random}';
```
- `'unsafe-inline'` necessary for current TanStack Start version (cannot nonce hydration scripts)
- Revisit if framework updates support nonces
- `frame-src` allows Google OAuth iframe
- See [docs/security.md](docs/security.md) for full CSP + HSTS + X-Frame-Options

### Audit Trail
All admin mutations logged to `audit_logs`:
```
{
  id: uuid,
  action: text (CHECK constrained),
  entity: text,
  entity_id: text,
  actor_email: text,
  metadata: jsonb,
  created_at: timestamp
}
```
- Append-only; no delete
- Tracks form changes, status updates, exports, security events (email mismatches, rate limits, path traversal attempts)
- Full audit chain for compliance

### Idempotency & Race Conditions
- `idempotency_key` prevents accidental duplicates on retry
- Row-level locking in `submit_response()` ensures `max_responses` is enforced atomically
- Reference ID generation uses `FOR UPDATE` lock on form row

### Recent Security Patches (2026)
1. **Reference ID Enumeration (HIGH)** — Fixed by switching public access to secure `reference_token`
2. **Auto-Admin Provisioning (CRITICAL)** — Fixed with `admin_whitelist` table + approval workflow
3. **Email Enumeration (HIGH)** — Fixed by revoking anon RLS on `verified_emails`
4. **Email Tampering (HIGH)** — Fixed with email validation in `submit_response()`
5. **OAuth CSRF (HIGH)** — Fixed with state parameter validation
6. **DoS/Spam (HIGH)** — Fixed with rate limiting on `submit_response()`
7. **Path Traversal (HIGH)** — Fixed with strict path normalization in file upload RPC

---

## Security Patches (2026)

This section documents critical security vulnerabilities identified and fixed in January 2026.

### Vulnerabilities Fixed

| # | Vulnerability | Severity | Fix | Status |
|---|---|---|---|---|
| 1 | Reference ID Enumeration | HIGH | Use `reference_token` (256-bit random) for public links instead of sequential `reference_id` | ✅ Fixed |
| 2 | Auto-Admin Provisioning | CRITICAL | Implement `admin_whitelist` table; only whitelisted emails can become admins | ✅ Fixed |
| 3 | Email Enumeration | HIGH | Revoke anon RLS on `verified_emails`; restrict to authenticated admins | ✅ Fixed |
| 4 | Email Tampering | HIGH | Validate submitted email matches authenticated session in `submit_response()` RPC | ✅ Fixed |
| 5 | OAuth CSRF | HIGH | Add state parameter validation in OAuth callback flow | ✅ Fixed |
| 6 | DoS/Spam | HIGH | Implement rate limiting (10 submissions/hour per email) | ✅ Fixed |
| 7 | Path Traversal | HIGH | Strict file path validation preventing `../` and directory escapes | ✅ Fixed |
| 8 | Response Text Overflow | MEDIUM | Fix CSS layout in submission detail modal | ✅ Fixed |

### Migration Files
All patches implemented via new migrations (050–055):
- `050_fix_reference_id_enumeration.sql` — Token-based access + access control
- `051_fix_verified_emails_rls.sql` — Restrictive RLS policies
- `052_fix_auto_admin_provisioning.sql` — Admin whitelist requirement
- `053_add_email_validation_to_submit_response.sql` — Email tampering prevention + rate limiting check
- `054_add_rate_limiting_to_submit_response.sql` — Rate limit infrastructure
- `055_fix_file_path_traversal.sql` — File upload security

### Admin Action Required
After running migrations 050–055, add your admin email to the whitelist:

```sql
INSERT INTO public.admin_whitelist (email, approved_by)
SELECT id, id FROM auth.users 
WHERE email = 'your-admin@example.com'
LIMIT 1;
```

---

## Deployment

### Netlify (Recommended)

```bash
npm run build
# Output: dist/, .netlify/functions-internal/
# Netlify auto-detects netlify.toml
```

**Steps:**
1. Connect GitHub repo to Netlify
2. Build command: `npm run build`
3. Publish directory: `dist`
4. **Environment variables** (Site settings → Build & deploy → Environment):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - Scope **must include "Builds"** (inlined at build time)
5. Deploy

**Note**: Anon key is public by design (RLS protects data). `netlify.toml` whitelists it in secret scanner.

### Other Hosts (Node 18+)

Any host that runs Node can deploy:

```bash
npm run build
# .output/ contains the full Nitro app (SSR + static)
node .output/server/index.mjs
```

**Environment**:
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at build time
- Set `NODE_ENV=production`
- Put a reverse proxy (nginx, Cloudflare) in front for TLS
- Point a health monitor at `GET /health`

**Platforms**:
- **Vercel**: Use `@vercel/nix` preset (see [docs/deployment.md](docs/deployment.md))
- **Cloudflare Workers**: Use `cloudflare-module` preset
- **Docker**: Use Node 18+ image, `npm run build && npm run preview`
- **Fly.io, Railway, Render**: Standard Node deployment

### Environment Variables at Build Time

Vite inlines `VITE_*` vars at build time:
```javascript
// vite.config.ts
define: {
  __SUPABASE_URL__: JSON.stringify(process.env.VITE_SUPABASE_URL),
  __SUPABASE_KEY__: JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY),
}
```

This means:
- ✅ Set at build time → baked into JS bundle
- ❌ Cannot change at runtime without rebuild
- ✅ Safe because anon key is public + RLS gates access

---

## Known Limitations

### Admin Account Provisioning
- No self-signup for admins (deliberate security boundary)
- Admins must be whitelisted in `admin_whitelist` table before first login
- **Setup**: Add your email to whitelist via SQL query in Supabase console (see Setup Database section)
- **Workaround**: Automate via CLI or create an invite RPC (future)

### Manual Migrations
- No automated migration system (no Prisma, Liquibase, etc.)
- Migrations run manually via Supabase SQL Editor
- Order matters; see [docs/migrations.md](docs/migrations.md) for canonical sequence
- **Workaround**: Consider Supabase CLI or custom migration runner (future)

### CSP & Nonce
- CSP allows `'unsafe-inline'` for scripts (should use nonces)
- Current TanStack Start cannot nonce streamed hydration scripts
- Revisit once framework supports per-request nonces
- Compensating controls: frame-src, style-src strict, no eval

### No CAPTCHA / Bot Protection
- No built-in CAPTCHA on public forms
- Primary defense: rate limiting (10 submissions/hour per email)
- **For high-volume abuse**: Use Cloudflare challenge or IP-based rate limit (edge layer)

### Reference Token as Capability Link
- Link `/view-response/{referenceToken}` acts as a capability token
- Anyone with the URL can view that submission
- **By design** (respondents get a link to check their submission)
- **Security**: Tokens are 256-bit random; guessing is cryptographically infeasible
- **Risk**: If link is shared publicly, submission is visible to all
- **Workaround**: Respondent access can be disabled in form settings (future)

### Single Supabase Project
- App tied to one Supabase project
- Multi-tenancy requires custom RLS + project switching (not implemented)
- **Workaround**: Deploy separate instances per customer

### Netlify Deployment Limitations
- Static redirects via `netlify.toml` (SPA routing works out of box)
- Response time ties to Supabase latency (no caching layer)
- No edge-side authentication (SSR can run closer, but still auth-heavy)

### Rate Limiting Granularity
- Rate limiting is per email per form (not IP-based)
- Same person with multiple Google accounts can submit multiple times
- Legitimate users with multiple emails not blocked
- **For stricter control**: Add IP-based rate limiting at edge (Cloudflare, Netlify functions)

---

## Support & Contribution

This is a private project of InnoTech-Hub. For support, contact the development team.

For internal development, see:
- [AGENTS.md](AGENTS.md) — AI agent conventions
- [docs/testing.md](docs/testing.md) — testing setup
- [docs/security.md](docs/security.md) — security model deep-dive
- [docs/migrations.md](docs/migrations.md) — migration order & fixes

---

## License

**Private project of InnoTech-Hub. All rights reserved.**

Unauthorized copying, distribution, or use is prohibited.
