# Payment Question Type Implementation

This change adds a new 'payment' question type that enables form administrators to create payment workflows within forms. Admins configure a payment URL that opens in a new tab when users click Pay Now, then require users to upload screenshot proof of payment completion. The implementation integrates payment questions into the existing file upload infrastructure, form builder UI, validation system, and response export pipeline.

**Watch for:** URL validation gaps in the builder allowing malformed URLs to be saved, missing validation feedback when payment URLs are invalid making the Pay Now button non-functional, and incomplete payment workflow that only tracks screenshot presence rather than actual payment verification.

**Verdict**: NEEDS_CHANGES

## High-level view

The payment question type leverages the existing file upload system by adding 'payment' to the FILE_TYPES array, ensuring screenshot uploads use the same validation and storage mechanisms as other file questions. The builder provides a URL input field with real-time validation, while the public form conditionally renders a Pay Now button only for valid HTTP/HTTPS URLs with proper security attributes. Conditional logic is intentionally disabled for payment questions since they don't produce selectable answer values. Export functionality maps payment file presence to human-readable status messages rather than exposing file paths. However, there are validation gaps in the builder that allow invalid URLs to be saved, and the payment workflow lacks verification mechanisms beyond screenshot presence.

<details>
<summary>Issues (4)</summary>

1. **URL validation bypass** — Payment URL input only validates on onChange, allowing invalid URLs to be saved through paste operations or programmatic input that bypass the validation check.

2. **Missing validation feedback** — Pay Now button renders conditionally based on URL validity, but users get no feedback when the button is hidden due to an invalid URL, creating confusion about why payment isn't available.

3. **Duplicate display line** — SubmissionDetailModal.tsx contains a duplicated "Payment URL: View Payment Page" line at line 334, indicating a copy-paste error.

4. **Incomplete payment workflow** — The system only tracks screenshot presence but provides no mechanism to verify actual payment completion against payment providers or mark payments as verified by administrators.

</details>

<details>
<summary>Details</summary>

## Payment URL security and validation

**confirmed** — The URL validation in QuestionCard.tsx has a critical gap. The onChange handler accepts any input value and sets it directly to config, only performing validation checks for display purposes. This allows invalid URLs to be saved through paste operations, programmatic input, or other events that bypass the onChange validation. The onBlur handler attempts to catch this but still saves invalid values to config.

The public form correctly validates URLs before rendering the Pay Now button using a try/catch URL constructor pattern that only allows http: and https: protocols, preventing javascript: or data: URL injection. The link uses proper security attributes (target="_blank", rel="noopener noreferrer") to prevent window.opener attacks.

## File upload integration correctness  

**confirmed** — The implementation correctly integrates payment questions into the existing file upload infrastructure. Adding 'payment' to the FILE_TYPES array ensures payment questions participate in file validation loops without affecting existing file question behavior. The public form rendering uses `FILE_TYPES.includes(q.type) && q.type !== "payment"` to exclude payment questions from the generic FileUploader while providing payment-specific upload UI.

Payment screenshots are restricted to image formats (.jpg, .jpeg, .png) with a 10MB limit through the FileUploader component, maintaining consistency with file handling patterns used elsewhere in the application.

## Builder configuration interface

**likely** — The payment configuration editor provides a clean URL input with visual validation feedback (red border for invalid URLs), but the validation only runs on input change events. The builder lacks a preview of how the payment section will appear to form respondents, making it difficult for admins to verify the payment experience during form creation.

## Conditional logic handling

**confirmed** — Payment questions are correctly excluded from conditional logic in LogicRuleEditor.tsx. The component detects payment questions and displays appropriate messaging explaining that payment questions cannot be used for conditional logic since they don't have selectable answer values that can trigger rules. This prevents confusion and maintains system consistency.

## Response display and export

**confirmed** — The export system properly handles payment questions by mapping file presence to readable status messages ("Payment completed - screenshot uploaded" vs "No proof uploaded") rather than exposing internal file paths. This maintains user privacy and provides meaningful information in exported data.

**confirmed** — SubmissionDetailModal.tsx contains a duplicate line at line 334 where "Payment URL: View Payment Page" appears twice, indicating a copy-paste error during implementation.

## Database migration safety

**confirmed** — Migration 061 safely adds the 'payment' enum value using ALTER TYPE with IF NOT EXISTS, ensuring idempotent execution. The migration is minimal and focused, only adding the required enum value without affecting existing data or constraints.

## Validation and submission flow

**possible** — Required payment questions are validated through the general file upload validation system, which checks for uploaded files. However, this validation only ensures a screenshot exists, not that payment was actually completed. The system provides no mechanism for administrators to verify payment completion against payment providers or mark payments as verified manually.

## Section description enhancement

**confirmed** — Section descriptions now properly display with whitespace-pre-wrap CSS class, preserving newlines, spaces, and formatting as authored in the builder. This addresses the UI enhancement request for better text display in form sections.

</details>

<details>
<summary>File map</summary>

- `src/lib/question-types.ts` — Added 'payment' to QuestionType union, QUESTION_TYPES picker array, and FILE_TYPES array for file upload integration
- `src/components/form-builder/types.ts` — Added paymentUrl field to QuestionConfig type for URL storage  
- `src/components/form-builder/QuestionCard.tsx` — Payment configuration editor with URL input, validation, and error display
- `src/routes/forms/$slug.tsx` — Payment question rendering with conditional Pay Now button and screenshot FileUploader
- `src/components/form-builder/LogicRuleEditor.tsx` — Payment question exclusion from conditional logic with explanatory messaging
- `src/lib/export-utils.ts` — Payment question export formatting mapping file presence to status messages
- `src/components/SubmissionDetailModal.tsx` — Payment response display with screenshot preview and status indication
- `supabase/migrations/061_add_payment_question_type.sql` — Database enum update adding payment type with IF NOT EXISTS safety

Full diff: `git diff HEAD~1..HEAD`

</details>