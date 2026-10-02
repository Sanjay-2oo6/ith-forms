# Payment Question Type Implementation Review

The implementation adds a new 'payment' question type that allows admins to create questions with a Pay Now button redirecting to external payment URLs and file upload for payment screenshot proof.

**Watch for:** **likely** Payment URL XSS risk through unvalidated URLs, **confirmed** missing payment question support in conditional logic, **likely** incomplete validation for payment screenshot requirements.

**Verdict**: CHANGES_REQUESTED

## High-level view

The payment question type is properly integrated into the type system and form builder with a dedicated config panel for payment URL input. The public form renders a Pay Now button with correct security attributes (noopener noreferrer) but lacks URL validation that could allow XSS attacks. File upload is correctly wired through the existing FileUploader component with appropriate image restrictions, and responses display properly in both the admin detail modal and CSV/XLSX export. However, conditional logic support was not implemented for payment questions, and there's no validation ensuring required payment questions actually have uploaded screenshots before submission.

<details>
<summary>Issues (5)</summary>

1. **Payment URL XSS vulnerability** — paymentUrl accepts any string without validation, could enable XSS attacks via javascript: or data: URLs. Add URL validation in the config editor.

2. **Missing conditional logic support** — LogicRuleEditor.tsx doesn't handle payment question types, preventing admins from creating logic rules based on payment completion. Add payment to CHOICE_ANSWER_TYPES or create payment-specific logic handling.

3. **Incomplete payment validation** — Required payment questions can be submitted without uploaded screenshots since FILE_TYPES validation only checks file existence, not payment completion. Add payment-specific validation logic.

4. **Direct public URL exposure** — Payment screenshot images use getPublicUrl() in SubmissionDetailModal, bypassing the existing file access pattern used elsewhere in the app. Verify this doesn't expose files inappropriately.

5. **Missing migration reference** — Migration 061 adds the payment enum value but isn't referenced in the migration tracking that other files use for canonical ordering.

</details>

<details>
<summary>Details</summary>

## Payment URL handling and security posture

The implementation correctly uses `target="_blank"` and `rel="noopener noreferrer"` when opening payment URLs, preventing window.opener attacks. However, there's a **confirmed** XSS vulnerability: the paymentUrl field accepts any string without validation. An attacker could inject `javascript:alert('xss')` or `data:text/html,<script>alert('xss')</script>` URLs that would execute when users click Pay Now.

The config editor shows a URL input type which provides some browser-level validation, but this isn't enforced programmatically. The implementation needs server-side URL validation that only allows http/https schemes and rejects dangerous protocols.

```typescript
// Current unsafe usage in $slug.tsx
href={q.config?.paymentUrl || "#"}
```

## File upload integration and lifecycle

The payment question integrates with the existing file upload system by adding 'payment' to FILE_TYPES arrays. The FileUploader component accepts only image formats (.jpg, .jpeg, .png) with a 10MB limit.

However, there's a **likely** security concern: payment screenshots use `getPublicUrl()` directly rather than the signed URL pattern used elsewhere, potentially exposing files that should require authentication.

## Export and response display behavior

The export logic correctly handles payment questions by displaying "Payment completed - screenshot uploaded" vs "No proof uploaded" based on whether rawValue (the file path) exists.

## Conditional logic gap

**Confirmed** missing support: LogicRuleEditor.tsx doesn't include 'payment' in any validation or option handling logic. This means admins can't create conditional logic rules based on payment completion status, which is a common use case (show different sections based on whether payment was completed).

Payment questions need either:
1. Addition to choice-type handling if they should support "completed"/"pending" logic values
2. Custom payment-specific logic handling for file upload completion

## Validation and submission flow

**Likely** validation gap: Required payment questions are checked through the general FILE_TYPES validation, which only verifies that files exist. Payment questions conceptually require both payment completion AND screenshot upload as proof, but current validation doesn't distinguish between a user who hasn't started payment vs one who paid but forgot to upload proof.

## Type system integration

The payment type is properly added to the QuestionType union and appears in QUESTION_TYPES with its own "Payment" category. The database migration cleanly adds the enum value with proper IF NOT EXISTS handling.

</details>

<details>
<summary>File map</summary>

- `src/lib/question-types.ts` — Added 'payment' to type union, QUESTION_TYPES array, and FILE_TYPES
- `src/components/form-builder/types.ts` — Added paymentUrl field to QuestionConfig  
- `src/components/form-builder/QuestionCard.tsx` — Added payment config editor with URL input
- `src/routes/forms/$slug.tsx` — Added payment question rendering with Pay Now button and screenshot upload
- `src/lib/export-utils.ts` — Added payment-specific display logic for CSV/XLSX export
- `src/components/SubmissionDetailModal.tsx` — Added payment response display with screenshot preview
- `supabase/migrations/061_add_payment_question_type.sql` — Added payment enum value to question_type

</details>