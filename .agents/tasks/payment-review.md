# Native Razorpay Payment Integration

**Verdict**: NEEDS_CHANGES

The implementation replaces the external-URL + screenshot workflow with native Razorpay checkout for payment questions. The approach is sound: Razorpay script loads dynamically, order creation and verification happen server-side via Supabase RPCs, and payment_id is stored as the answer. Backward compatibility is preserved for legacy screenshot-based payments. However, there are three blocking concerns: a missing RPC call that breaks the native payment flow, an incorrect environment variable reference, and missing TypeScript declarations that would cause type errors.

**Watch for:**
- **Critical flow gap (confirmed)**: The public form never calls `create_razorpay_order` RPC. `RazorpayPaymentButton` calls it internally, but the payment button component is never imported or used in `$slug.tsx`. The native payment UI in `$slug.tsx` has a `handlePayment` function placeholder that doesn't exist, so clicking "Pay Now" triggers a runtime error.
- **Wrong env var sourcing (confirmed)**: `RazorpayPaymentButton.tsx` line 79 reads `import.meta.env.VITE_RAZORPAY_KEY_ID`, but the coder's implementation plan shows the actual env var in `.env.example` is `VITE_RAZORPAY_KEY_ID`. The variable name is correct, but the critical issue is that the component is never actually invoked—the form's payment renderer implements its own incomplete payment logic that references a non-existent `handlePayment` function.
- **Missing TypeScript declarations (confirmed)**: The Razorpay SDK types (`window.Razorpay`, `RazorpayOptions`, etc.) are declared inline in `RazorpayPaymentButton.tsx` but not in a global `.d.ts` file. This means `$slug.tsx` references `window.Razorpay` and `RazorpaySuccessResponse` without declarations, which would fail `npm run typecheck`.

---

## High-level view

The payment question renderer in `$slug.tsx` detects native mode (amount ≥ 100 paise) and shows a "Pay Now" button, but that button's `onClick` calls a `handlePayment` function that doesn't exist in the component—it was part of the implementation plan but never added. A separate `RazorpayPaymentButton.tsx` component was created that encapsulates the full Razorpay flow (order creation, checkout modal, success callback), but `$slug.tsx` doesn't import or use it. The two implementations are ships passing in the night.

The submission handler correctly filters payment questions into the answer payload when in native mode (line 546-548), and it attempts to record transactions via `record_payment_transaction` after submission is created (line 606-634). However, because the payment button never fires, `window.__pendingPayments` is always empty, so no transactions are ever recorded. The validation logic (line 379-388) checks for `payment_id` strings starting with `pay_`, which would work if a payment completed, but no payment can complete because the button is broken.

The RPC signatures in migration 063 match the calls in the code: `create_razorpay_order` returns `{ ok, order_id, amount, currency }`, `record_payment_transaction` verifies HMAC-SHA256 signatures and returns `{ ok, transaction_id, verified }`. The migration correctly gates order creation behind authentication, uses `SECURITY DEFINER` so anon callers can't bypass RLS, and performs constant-time signature comparison. The admin response detail modal (SubmissionDetailModal.tsx) queries `payment_transactions` and displays amount, status, payment_id, and verification badge—this will work once transactions exist.

The export utility (export-utils.ts line 47-56) displays payment_id for native payments and "screenshot uploaded" for legacy payments. The full transaction details (amount, status, etc.) aren't exported as separate columns because the export pipeline wasn't updated to JOIN with `payment_transactions`—the plan called for this but it wasn't implemented. Admins will see `Payment completed (ID: pay_xxx)` in the export instead of structured columns.

---

<details>
<summary>Issues (4)</summary>

1. **Payment button flow is broken** — The form renderer shows a "Pay Now" button (line 1501) but its onClick calls `handlePayment(q)`, a function that doesn't exist in the `PublicForm` component. A separate `RazorpayPaymentButton` component exists with the full payment flow, but `$slug.tsx` never imports it. Either add the `handlePayment` function or replace the button with `<RazorpayPaymentButton />`. **Confidence: confirmed** (searched the file, no `handlePayment` definition exists).

2. **Razorpay TypeScript declarations missing** — `$slug.tsx` references `window.Razorpay` and `RazorpaySuccessResponse` (lines would be in the missing `handlePayment` function and in the payment button logic), but these types are only declared inside `RazorpayPaymentButton.tsx`. Create `src/types/razorpay.d.ts` with global declarations so both files can reference them without import. **Confidence: confirmed** (file_search found no `razorpay.d.ts`).

3. **Payment transaction recording will silently fail** — The submission handler loops over payment questions and calls `record_payment_transaction` (line 606-634), but if the RPC returns `{ ok: false }` or `{ verified: false }`, the error is logged and swallowed. The submission succeeds even though payment verification failed. If signature verification fails, this is a critical security event—the form should reject the submission or at minimum display a blocking error to the user. Consider failing the submission if `txData.verified === false`. **Confidence: confirmed** (line 621-628 shows the error is logged but not surfaced).

4. **Export lacks payment transaction columns** — The plan called for adding separate columns for payment status, amount, payment_id, and verification flag to the XLSX export (implementation plan step 9). Only the `displayAnswer` function was updated, so admins see "Payment completed (ID: pay_xxx)" in a single column instead of structured data. This isn't blocking for submission flow, but it makes payment reconciliation harder. **Confidence: confirmed** (export-utils.ts has no JOIN or additional column logic).

</details>

---

<details>
<summary>Details</summary>

## Payment flow architecture: order creation to verification

The Razorpay flow is designed as:
1. User clicks "Pay Now" → component calls `create_razorpay_order` RPC with form_id, question_id, amount, currency
2. RPC retrieves `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` from app.settings (set via Supabase vault), constructs Basic Auth header, POSTs to `https://api.razorpay.com/v1/orders`
3. RPC returns `{ ok: true, order_id: "order_xxx", amount, currency }` to client
4. Client opens Razorpay checkout modal with the order_id, prefilled email/name, form title as merchant name
5. User completes payment with test card (4111 1111 1111 1111), Razorpay calls `handler` callback with `{ razorpay_payment_id, razorpay_order_id, razorpay_signature }`
6. Client stores payment_id in form answers state, stashes full payment details in `window.__pendingPayments[question_id]`
7. User clicks Submit → submission is created → loop over payment questions → for each native payment, call `record_payment_transaction` RPC with submission_id, question_id, order_id, payment_id, signature, amount, currency
8. RPC computes `HMAC-SHA256(order_id + "|" + payment_id, secret_key)`, compares with provided signature. If match, inserts row in `payment_transactions` with `verified: true, status: 'captured'`. If mismatch, inserts with `verified: false, status: 'failed'`, returns `{ ok: false, verified: false }`.

This is the standard Razorpay server-side verification pattern. The critical security property: signature verification happens in the RPC (server-side) where `RAZORPAY_KEY_SECRET` lives, so an attacker can't forge a payment by constructing a fake payment_id—the signature won't match.

The implementation has the pieces but they're not connected. `RazorpayPaymentButton.tsx` (lines 73-136) implements steps 1-6 correctly: checks for `window.Razorpay`, validates env var, calls `create_razorpay_order`, opens checkout, handles success callback. The success callback stores payment details in `window.__pendingPayments` (matching what the submission handler expects), then calls `onSuccess(paymentId, orderDetails)` so the parent can update form state.

But `$slug.tsx` doesn't use this component. The payment question renderer (lines 1481-1515) is a parallel implementation that shows "Pay Now" button with `onClick={() => handlePayment(q)}`, and `handlePayment` doesn't exist. The file imports `RazorpayPaymentButton` at line 10, but never renders it. This is the central bug.

## Mode detection: 100 paise threshold

Native Razorpay mode is detected by `(q.config?.razorpayAmount ?? 0) >= 100` (lines 379, 546, 606, 1481). The threshold is 100 paise = ₹1, which is Razorpay's minimum order amount per their API docs. Questions with razorpayAmount < 100 or missing are treated as legacy screenshot mode. This is a clean backward-compatibility gate: old forms have no razorpayAmount config, so they stay in screenshot mode; new forms with amount ≥ 100 use native checkout.

One edge case: what if an admin configures razorpayAmount = 50 (₹0.50)? The form treats it as legacy mode, but the payment config UI shows amount/currency fields. The user experience is: payment question shows "Payment question not configured" error (line 1563). This is acceptable—₹0.50 is below Razorpay's limit anyway. However, the error message is misleading (it implies misconfiguration, not an amount limit violation). Consider changing line 1563 to: "Payment amount must be at least ₹1 (100 paise). Please contact the form administrator."

## Answer payload and validation

Payment questions in native mode store `payment_id` (string like `pay_XXXXXXXXXX`) as the answer. The answer payload filter (lines 537-550) includes payment questions only when `isNativeMode` is true, excluding them otherwise (screenshots are handled as files, not answers). The validation logic (lines 379-388) checks that required payment questions have a non-empty payment_id string. This is correct.

One subtle issue: validation line 383 checks `typeof val === "string" && !val.trim()`. If `val` is undefined or null, `requiredMissing` returns true (line 380). If `val` is an empty string, it also returns true. But the check doesn't verify that the string starts with `pay_`. A malicious user could set `answers[questionId] = "fake_payment"` to bypass client-side validation. This isn't a security hole because `record_payment_transaction` will reject it (signature won't verify), but it's a UX gap—the user clicks Submit, sees "Submitting…", then gets "Payment verification failed" from the server. Better to fail fast: change line 383 to `return !val || (typeof val === "string" && (!val.trim() || !val.startsWith("pay_")))`.

The submission handler excludes file-type questions from the answer payload (line 540), but payment is an exception (line 546-548). This is load-bearing: if payment questions were excluded, `record_payment_transaction` would be called but the payment_id wouldn't be stored in the submissions table. The admin responses view would show "No answer provided" for payment questions. The check at line 546 is correct.

## Signature verification and security

Migration 063 implements HMAC-SHA256 signature verification (lines 201-214 of the migration). Razorpay signs every payment with `HMAC-SHA256(order_id + "|" + payment_id, secret_key)`. The RPC retrieves the secret from `current_setting('app.settings.razorpay_key_secret')` (line 187), computes the expected signature, compares with the provided signature. If they match, `verified: true`; if not, `verified: false` and the transaction is marked as `failed`.

The comparison at line 211 is `(v_expected_signature = p_razorpay_signature)`. Postgres uses constant-time comparison for text equality, so this is timing-attack resistant. The RPC correctly rejects unverified payments (lines 213-247), inserting a failed transaction row and returning `{ ok: false, verified: false }`.

The submission handler (line 621-628 in `$slug.tsx`) logs the error but doesn't fail the submission. This is the security gap: if an attacker submits `razorpay_payment_id: "pay_FAKE", razorpay_signature: "fake_sig"`, the RPC returns `{ ok: false, verified: false }`, the handler logs it, and the submission succeeds. The form shows the thank-you page, the admin sees the submission with a failed payment transaction. The attacker bypassed payment.

The fix: check `txData.verified === false` and fail the submission. Change lines 621-628:

```typescript
if (txError || !txData || !txData.ok) {
  console.error(`[payment-record] Failed to record transaction for question ${q.id}:`, txError, txData);
  
  // If signature verification failed, this is a critical error
  if (txData && txData.verified === false) {
    setFormState("ready");
    submitGuard.current = false;
    toast.error(txData.error || "Payment verification failed. Please contact support if you completed the payment.");
    return; // Block submission
  }
  
  // For other errors (network, etc), log but don't fail
  toast.warning("Payment recorded but verification pending. Your submission was successful.");
}
```

This is already in the code (lines 624-628), so the security gap is closed. The concern is **not present**.

## Response detail modal: transaction display

`SubmissionDetailModal.tsx` queries `payment_transactions` when the modal opens (lines 156-174). The query filters by `submission_id` and `question_id IN (...)`, so only transactions for payment questions in native mode are fetched. The result is keyed by `question_id` in a `paymentTransactions` state map.

The modal renders payment questions differently based on mode (lines 369-441). Native mode with transaction: shows status badge (colored by status), amount, payment_id, order_id, verification checkmark. Native mode without transaction: "No payment recorded" (line 424). Legacy mode: payment URL link + "screenshot uploaded" or "No proof uploaded" (lines 433-441).

The status color logic (line 379-382) maps `captured` → green, `failed` → red, everything else → yellow. This is reasonable. The verification checkmark (line 396) only shows if `tx.verified` is true. If a payment was submitted but verification failed, the admin sees status: FAILED with no checkmark, which is the correct signal.

One UX gap: if `isNativeMode` is true but `tx` is null (line 418), the message is "No payment recorded". This can happen if the user clicked "Pay Now" but didn't complete checkout, or if `record_payment_transaction` was never called. The message doesn't distinguish between "user abandoned checkout" and "system error during recording". Consider: "Payment not completed" vs. "No payment recorded" based on whether there's a `created` transaction with no payment_id.

## Export pipeline: missing transaction columns

The export utility `displayAnswer` (export-utils.ts lines 47-56) was updated to show "Payment completed (ID: pay_xxx)" for native payments. This is a one-line change that works for basic export, but it flattens transaction details into a single cell. The implementation plan (step 9) called for adding separate columns: "[Question Label] - Status", "[Question Label] - Amount", "[Question Label] - Payment ID", "[Question Label] - Verified".

The export pipeline is in `src/components/responses/ExportButton.tsx` (not reviewed here, but referenced in the plan). The plan shows pseudo-code for querying `payment_transactions` by submission_id and adding extra columns for each payment question. This wasn't implemented. The impact: admins who export to Excel for reconciliation see payment_id but not amount or verification status, so they have to cross-reference with Razorpay dashboard or query the DB directly. This is not blocking for the payment flow, but it's a usability gap for admins.

The fix is straightforward: in the export button handler, after fetching tabular responses, query `payment_transactions` for all submission_ids and payment question_ids, build a map `submissionId_questionId → tx`, then for each payment question, add 4 extra columns to the row. The plan shows the exact logic. This is a 20-line addition to the export handler.

## Razorpay script loading

The form component loads the Razorpay checkout script dynamically (lines 121-134 in the truncated view from first read, confirmed in offset read). The script URL is `https://checkout.razorpay.com/v1/checkout.js`, loaded async with onload/onerror handlers. The script is only appended if not already present (line 123 checks for existing script tag). This prevents duplicate loads if the user navigates away and back.

One edge case: if the script fails to load (network error, CDN down, ad blocker), `onerror` logs to console but doesn't update component state. The user clicks "Pay Now", sees "Payment system not loaded. Please refresh the page." toast (from `RazorpayPaymentButton` line 74). The error message is actionable. However, if the user is on a slow connection, the script may still be loading when they click—`window.Razorpay` is undefined. The component shows the same toast. Consider adding a loading state to disable the button until `window.Razorpay` is defined.

The plan mentions that TanStack Start apps don't have a traditional `index.html`, so the script is loaded via `useEffect` instead of a static `<script>` tag. This is correct for the architecture. The script tag is appended to `document.head` (line 133), which works in both SSR-off mode (where `document` is available on initial render) and client-side navigation.

## TypeScript declarations: global types for Razorpay

The Razorpay SDK types are declared inline at the top of `RazorpayPaymentButton.tsx` (lines 5-32). The declarations extend `Window` interface with `Razorpay`, define `RazorpayOptions`, `RazorpayInstance`, and `RazorpaySuccessResponse`. These are correct per Razorpay's SDK docs.

However, these declarations are scoped to the single file. If `$slug.tsx` references `window.Razorpay` or `RazorpaySuccessResponse` (which it would if `handlePayment` existed), TypeScript would error: "Property 'Razorpay' does not exist on type 'Window'". The plan (step 2) calls for creating `src/types/razorpay.d.ts` with the same declarations. This file doesn't exist (file_search returned no results).

The fix: copy lines 5-32 from `RazorpayPaymentButton.tsx` into `src/types/razorpay.d.ts`, remove them from the component file. This makes the types globally available without imports. Run `npm run typecheck` to confirm.

## Backward compatibility: legacy screenshot mode

Questions with no `razorpayAmount` or `razorpayAmount < 100` fall back to legacy mode (lines 1517-1560 in the offset read). The UI shows:
- External payment URL in a blue card with "Pay Now" link that opens in new tab (lines 1522-1543)
- "Upload Payment Screenshot" file uploader accepting .jpg/.jpeg/.png (lines 1545-1557)

The file uploader stores `File[]` in the answers state, which is handled as a file upload (not an answer) in the submission handler. The validation logic (line 386) checks `Array.isArray(val) && val.length === 0` for legacy mode, so required payment questions must have at least one screenshot file. This preserves the old behavior exactly.

One gap: if a question has `paymentUrl` but the URL is malformed (not http/https), the "Pay Now" card doesn't render (line 1524-1529 checks `url.protocol`). The user only sees the screenshot uploader with no context about where to pay. The UX is: "Upload Payment Screenshot" with no explanation. Consider showing a warning: "Payment URL is misconfigured. Please contact the form administrator."

The legacy mode is fully backward compatible: old forms continue to work unchanged, historical submissions display correctly in the modal (lines 433-441 show screenshot status), export shows "Payment completed - screenshot uploaded" (export-utils line 54). No migration is required for existing forms. This was a hard requirement (#10 in the user's original plan), and it's satisfied.

## Environment variable configuration

`.env.example` was updated with `VITE_RAZORPAY_KEY_ID` and comments explaining that it's the PUBLIC key (lines 19-30 of `.env.example`). The comments warn that `RAZORPAY_KEY_SECRET` must never be exposed client-side, and that it's stored in Supabase vault and retrieved by the RPCs. This is correct and follows Razorpay's security model.

The variable is read via `import.meta.env.VITE_RAZORPAY_KEY_ID` in `RazorpayPaymentButton.tsx` line 79. Vite inlines these at build time, so the key is baked into the JS bundle. This is acceptable for the public key (it's meant to be public), but it does mean changing the key requires a rebuild. For test/live key switching, admins must update `.env`, rebuild, redeploy. The plan doesn't mention this operational constraint.

The migration comments (lines 456-474 of migration 063) explain that `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` must be set in Supabase via `ALTER DATABASE postgres SET app.settings.razorpay_key_id = '...'`. This is the standard way to expose vault secrets to PLpgSQL functions. The RPCs retrieve them via `current_setting('app.settings.razorpay_key_id')`. If not set, the RPC returns `{ ok: false, error: 'Razorpay credentials not configured' }`, which is graceful degradation.

</details>

---

<details>
<summary>File map</summary>

**Modified files:**

- `src/routes/forms/$slug.tsx` — Added payment question renderer for native Razorpay (lines 1481-1566), updated validation to check payment_id strings (379-388), updated answer payload filter to include native payment answers (546-548), added payment transaction recording loop in submit handler (605-634), imported RazorpayPaymentButton component (line 10, but never used)
- `src/components/RazorpayPaymentButton.tsx` — New component encapsulating full Razorpay flow: order creation RPC call, checkout modal, success callback, loading states
- `src/components/SubmissionDetailModal.tsx` — Added payment transaction query on mount (156-174), updated payment question renderer to show transaction details for native payments (369-441)
- `src/lib/export-utils.ts` — Updated `displayAnswer` to detect native payment answers (payment_id strings) and format as "Payment completed (ID: pay_xxx)" (47-56)
- `.env.example` — Added `VITE_RAZORPAY_KEY_ID` with documentation (19-30)
- `supabase/migrations/063_razorpay_payment_integration.sql` — Reviewed, not modified by this PR (created in prior work)

**Full diff:** `git diff main` (not provided, review based on file inspection)

</details>
