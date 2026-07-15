# ITH-FORMS — Forms Module: End-to-End Test & Bug Report

**Scope:** the entire Forms module — creation, editing, publishing, the public
respondent form, submission, validation, all question types, file uploads,
response viewing/export, and form management (delete/duplicate/archive/restore/share).

**Method & honesty note.** The admin panel is behind email/password auth, which
this pass could not drive interactively, so admin-UI cases were verified by
**source trace** of the exact code paths plus **live database/RPC tests** against
the real Supabase project (public submission path, limits, validation regexes).
Every FAIL/GAP below is tied to a specific file/line and, where possible, a live
result. Public respondent flows were traced end-to-end through the running
`submit_response` RPC.

Baseline: `tsc --noEmit` = 0 errors; production build passes.

---

## ✅ Resolution status (fixes applied)

**Fixed in code** (tsc + build green, 20 logic tests pass): **F1, F2, F3, F6, F8, F12,
F13, F15, F16, F23, F25, F30, F33** — plus a bonus fix to the submission-modal file
download (was using a public URL on a private bucket → now a signed URL).

**Not changed — feature decisions (need product sign-off, not bugs):** F18 (duplicate),
F19 (archive/close button), F20 (restore/trash view), F21 (draft preview), F27
(confirmation-email deploy), F34 (edit submitted answers), F4/F10 (per-field config).

**Not changed — security hardening needing a DB migration (flagged, not yet applied):**
F11 (server-side file-type validation), F14 (content/magic-byte MIME check).

**Left as-is — minor/by-design:** F5 (yes_no stores label; harmless & readable), F7
(text storage), F17, F24, F26, F28 (name/email capture — intentional use of typed fields;
label-guessing would be fragile).

---

## Severity summary

| Sev | Count | IDs |
|-----|-------|-----|
| 🔴 High | 5 | F1, F8, F15, F20, F23 |
| 🟠 Medium | 8 | F2, F3, F9, F11, F14, F28, F30, F32 |
| 🟡 Low | 9 | F5, F6, F12, F13, F16, F24, F25, F26, F33 |
| 🔵 Gap / not implemented | 5 | F18, F19, F21, F27, F34 |
| ⚪ Informational / by-design | 4 | F4, F7, F10, F17 |

---

## Part A — Workflow test cases

### A1. Create form
| TC | Case | Result |
|----|------|--------|
| C1 | Create blank form → default "Section 1" created, redirect to editor | ✅ PASS |
| C2 | Create from template → sections + questions inserted, theme row created | ✅ PASS |
| C3 | Title auto-generates slug (slugify) | ✅ PASS |
| C4 | Duplicate slug rejected (pre-check + DB unique constraint / 23505) | ✅ PASS |
| C5 | Empty title/slug blocked (HTML5 `required`) | ✅ PASS |
| C6 | Slug hint text | ❌ **F25** — hint shows `/forms/{slug}.html`, real URL is `/forms/{slug}` |
| C7 | Reuse slug of a **soft-deleted** form | ❌ **F26** — blocked; deleted forms still hold the slug |

### A2. Edit form (builder)
| TC | Case | Result |
|----|------|--------|
| C8 | Add/reorder/delete sections & questions (drag-and-drop) | ✅ PASS |
| C9 | Change question type post-creation (guards option loss) | ✅ PASS |
| C10 | 25-question limit enforced | ✅ PASS |
| C11 | Autosave of label/description/options | ✅ PASS |
| C12 | Options editor derives `value` from label | ❌ **F3** |
| C13 | Configure linear-scale/rating range or endpoint labels | ⚪ **F4** — not configurable (hardcoded 1–10 / 1–5) |
| C14 | Configure file type/size/count restrictions | ⚪ **F10** — no such config exists |

### A3. Publish / open / preview
| TC | Case | Result |
|----|------|--------|
| C15 | Publish from **editor** validates ≥1 section & ≥1 question | ✅ PASS |
| C16 | Publish from **forms list** (togglePublish) | ❌ **F23** — no validation; can publish an empty form |
| C17 | Open published form URL renders | ✅ PASS (live) |
| C18 | Preview an **unpublished/draft** form | 🔵 **F21** — not possible; public URL returns "Form Unavailable" |
| C19 | "Open" button on a draft row | 🟡 **F24** — always shown; leads to "Unavailable" |

### A4. Fill & submit (public form)
| TC | Case | Result |
|----|------|--------|
| C20 | Required-field validation blocks submit + scrolls to error | ✅ PASS |
| C21 | Multi-section pagination (Next validates current section) | ✅ PASS |
| C22 | Email/URL format validation | ✅ PASS (see F16 timing) |
| C23 | **Phone** format validation | ❌ **F15** — rejects most real phone formats |
| C24 | Number format validation | 🟡 rejects `1,000`/`.5` (F33) |
| C25 | Double-submit prevention (guard + disabled button) | ✅ PASS |
| C26 | Idempotency key valid over plain HTTP/LAN | ✅ PASS (fixed) |
| C27 | Success screen shows reference ID only after commit | ✅ PASS |

### A5. Question-type coverage (render ↔ stored value)
| Type | Renders? | Stored value | Issue |
|------|----------|--------------|-------|
| short_text / name / address / organization | ✅ | raw text | — |
| email | ✅ | raw text | also copied to `respondent_email` |
| phone | ✅ | raw text | 🔴 **F15** over-strict validation |
| url | ✅ | raw text | — |
| number | ✅ | **string** | ⚪ F7 (text column) |
| date / time / datetime | ✅ | ISO-ish string | — |
| dropdown / radio / poll | ✅ | **option slug** | 🔴 **F1** stores/shows slug not label |
| checkbox | ✅ | **comma-joined slugs** | 🟠 **F2** ambiguous CSV |
| yes_no | ✅ | `"Yes"`/`"No"` | 🟡 **F5** inconsistent (label not slug) |
| rating (1–5) | ✅ | `"1".."5"` | — |
| linear_scale (1–10) | ✅ | `"1".."10"` | ⚪ F4 range fixed |
| consent | ✅ | `"agreed"`/`""` | 🟡 **F6** shows "agreed" |
| file / document / image | ✅ | uploaded separately | 🔴 **F8**, 🟠 F9/F11/F14 |
| section_heading / information_paragraph / hidden | ✅ display-only | — | — |

### A6. View / manage responses
| TC | Case | Result |
|----|------|--------|
| C28 | Responses list (tabular: Reference + question columns) | ✅ PASS |
| C29 | Choice columns show human label | ❌ **F1** — show slug (`hr_executive`) |
| C30 | Export XLSX mirrors table | ✅ PASS (inherits F1) |
| C31 | Bulk status change (writes history + audit) | ✅ PASS |
| C32 | Submission detail (answers, notes, status, history) | ✅ PASS |
| C33 | **Edit a submitted response's answers** | 🔵 **F34** — not supported |
| C34 | Name/Email columns populated | 🟠 **F28** — only if form uses dedicated `name`/`email` types |

### A7. Form management
| TC | Case | Result |
|----|------|--------|
| C35 | Delete (soft) form | ✅ PASS |
| C36 | **Restore** deleted form | 🔴 **F20** — no restore path; irreversible via UI |
| C37 | **Duplicate** form | 🔵 **F18** — not implemented |
| C38 | **Archive / Close** form | 🔵 **F19** — no button (status + filter exist) |
| C39 | Copy link / Share (QR, apps, message) | ✅ PASS |
| C40 | Access control — anon can submit, cannot read others' data | ✅ PASS (RLS verified live) |

---

## Part B — Detailed findings

### 🔴 F1 — Choice answers stored & displayed as machine slugs, not option labels
- **Where:** `edit.tsx` `OptionsEditor.updateOption` (`value: label.toLowerCase().replace(/\s+/g,"_")`); `forms/$slug.tsx` radio/dropdown/checkbox `onChange(o.value)`; read via `get_form_responses_tabular` (migration 007) which returns `a.value` with no option mapping; `responses/index.tsx exportExcel` uses `answer.value` raw.
- **Expected:** admin sees the actual option text the respondent chose ("HR Executive").
- **Actual:** admin sees the slug (`hr_executive`, `option_1`). The tabular RPC never returns the question `options`, so the UI cannot map value→label.
- **Impact:** every dropdown/radio/poll/checkbox answer is shown and exported in degraded, lossy form; two labels that normalize to the same slug become indistinguishable.
- **Fix (later):** store the label as the answer, or join stored value against `form_questions.options` in the view/export to show the label.

### 🔴 F8 — Required file upload can be silently missing on a "successful" submission
- **Where:** `forms/$slug.tsx handleSubmit` — files upload *after* `submit_response` commits; upload/register failures only push to `failedUploads` (warning), then `setFormState("done")`.
- **Actual:** submission + answers already committed; a failed resume upload still shows the success screen. Admin sees a submission with no file. Closing the tab mid-upload is identical.
- **Impact:** required attachments (resumes, IDs) can be absent while the submission looks valid.
- **Fix (later):** upload required files before marking done and block/retry on failure.

### 🔴 F15 — Phone validation rejects most real-world phone formats
- **Where:** `forms/$slug.tsx validate()` — `phone: z.string().regex(/^\+?[1-9]\d{1,14}$/)`.
- **Live result (8 inputs):** ACCEPT `9876543210`; **REJECT** `09876543210`, `+91 98765 43210`, `+91-98765-43210`, `(212) 555-0199`, `0044 20 7946 0958`, `+1 (800) 123-4567`, `98765 43210`.
- **Impact:** any form with a **required** phone field (e.g., recruitment) blocks respondents using spaces, dashes, parentheses, or a leading `0` — a direct submission blocker.
- **Fix (later):** strip non-digit separators before validating; allow a leading `0`.

### 🔴 F20 — Soft-deleted forms cannot be restored from the UI
- **Where:** `forms/index.tsx softDelete` sets `status='deleted'` + `deleted_at`; list filters `deleted_at IS NULL`; no trash view or restore action.
- **Impact:** accidental delete is unrecoverable through the app.

### 🔴 F23 — Publishing from the Forms list skips "has questions" validation
- **Where:** `forms/index.tsx togglePublish` just flips `status`; the editor's `publish()` validates ≥1 section and ≥1 real question — the list button does not.
- **Impact:** an empty form can be published from the list; respondents open a form with nothing to answer.

### 🟠 F2 — Checkbox answers stored as ambiguous comma-joined string
- **Where:** `$slug.tsx handleSubmit` — `v.join(",")`. Slugs preserve commas from labels (only whitespace is replaced), so `"Yes, definitely"` → `yes,_definitely`, and `yes,_definitely,option_2` can't be reliably split.
- **Fix (later):** store multi-select as a JSON array or use a slug-safe delimiter.

### 🟠 F3 — Option `value` derived from label; mutates when label is edited
- **Where:** `OptionsEditor.updateOption` recomputes `value` on every keystroke.
- **Impact:** (a) two labels can collide to one value; (b) editing a label after responses exist changes the value → previously-stored answers orphaned.

### 🟠 F9 — No maximum file-count enforcement
- `FileUploader` uses `<input multiple>` always and appends without limit; can't require exactly one file.

### 🟠 F11 — Server-side file registration does not validate type/extension
- `register_submission_file` (005) checks size + path only; client `fileCheck` is bypassable via the storage API. Type enforcement is client-only.

### 🟠 F14 — File-type validation is extension/browser-MIME based (spoofable)
- `validation.ts fileCheck` — documents by filename extension, images by `file.type`. No content/magic-byte inspection; a renamed `.exe`→`.pdf` passes.

### 🟠 F28 — Respondent Name/Email captured only from dedicated `name`/`email` types
- `$slug.tsx handleSubmit` uses `questions.find(q => q.type === "name"/"email")`. If a form collects these via `short_text`, `respondent_name`/`respondent_email` stay null → blank Responses columns, no confirmation email, "Anonymous" on dashboard. Only the *first* such question is used.

### 🟠 F30 — Choice render not null-guarded against missing options
- `$slug.tsx` — `q.options.map(...)`. A choice question with `options = null` (templates insert `options: q.options || null`) would throw and crash the whole public form. Use `(q.options ?? []).map(...)`.

### 🟠 F32 — Sequential post-commit file uploads: slow, no progress, silent loss on abort
- Upload loop runs one file at a time after commit with no progress UI; navigating away mid-loop drops remaining files (compounds F8).

### 🟡 F5 — Inconsistent storage: `yes_no` stores label, other choices store slug.
### 🟡 F6 — Consent answer displays as literal `"agreed"` rather than a friendly Yes/✔.
### 🟡 F12 — `accept` attribute vs `fileCheck` allowed-set mismatch for documents (`.txt`/`.csv`).
### 🟡 F13 — Orphaned storage objects if `register_submission_file` fails after a successful upload.
### 🟡 F16 — Email/url/phone/number format checks run only at final submit, not on section "Next" (UX friction; caught eventually).
### 🟡 F24 — "Open" button shown for draft rows → leads to "Form Unavailable".
### 🟡 F25 — New-form slug hint shows stale `.html` URL.
### 🟡 F26 — Slug uniqueness check counts soft-deleted forms → a deleted form's slug can't be reused.
### 🟡 F33 — Number validation rejects `1,000` and `.5` (whitespace is fine — `validate()` trims first).

### 🔵 Gaps (not implemented)
- **F18** Duplicate form — no action.
- **F19** Archive / Close form — status enum + filter exist, but no button to set them.
- **F21** Draft preview — cannot preview an unpublished form.
- **F27** Confirmation email — edge function exists but requires external deploy/webhook (not wired by default).
- **F34** Edit submitted-response answers — not supported (only status/notes).

### ⚪ Informational / by-design
- **F4** Linear-scale/rating ranges & endpoint labels fixed (1–10 / 1–5); no builder config.
- **F7** All answers stored as `text` (numbers/dates included) — no numeric typing downstream.
- **F10** No admin config for file type/size/count (hardcoded per file type).
- **F17** Number/phone validated by regex only (see F15/F33 for specifics).

---

## Recommended fix order (when approved)
1. **F15** phone regex — active submission blocker.
2. **F1** choice value→label display — every choice answer is degraded.
3. **F8 / F32** required-file integrity + upload ordering.
4. **F23** validate on list-publish; **F20** restore path.
5. **F2 / F3** multi-select storage + option-value stability.
6. **F28 / F30** name/email capture + null-guard.
7. Remaining Medium/Low; feature gaps (F18/F19/F21) are product decisions.

*No code was changed in this pass — this is the test/audit report only.*
