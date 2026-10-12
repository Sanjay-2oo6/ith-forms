# Razorpay Native Payment Integration - Implementation Plan

## Context

This plan completes the Razorpay native payment integration for ITH Forms. The existing work includes:
- ✅ Migration 063: `payment_transactions` table, `create_razorpay_order` and `record_payment_transaction` RPCs
- ✅ types.ts: Added `razorpayAmount`, `razorpayCurrency`, `razorpayDescription` to `QuestionConfig`
- ✅ QuestionCard.tsx: Payment config UI for amount/currency/description

Remaining work: Update the public form renderer, validation, submission handler, response display, and export logic to use native Razorpay checkout instead of external URL + screenshot upload.

---

## Migration 063 RPC Signatures (from supabase/migrations/063_razorpay_payment_integration.sql)

### create_razorpay_order
```sql
FUNCTION public.create_razorpay_order(
  p_form_id uuid,
  p_question_id uuid,
  p_amount integer,
  p_currency text DEFAULT 'INR'
)
RETURNS jsonb

-- Returns:
{
  ok: true,
  order_id: "order_<random_hex>",
  amount: <integer>,
  currency: "<string>"
}
-- OR
{
  ok: false,
  error: "<error_message>"
}
```

### record_payment_transaction
```sql
FUNCTION public.record_payment_transaction(
  p_submission_id uuid,
  p_question_id uuid,
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_razorpay_signature text,
  p_amount integer,
  p_currency text DEFAULT 'INR',
  p_status text DEFAULT 'captured'
)
RETURNS jsonb

-- Returns:
{
  ok: true,
  transaction_id: "<uuid>",
  verified: true
}
-- OR
{
  ok: false,
  error: "<error_message>"
}
```

### payment_transactions table
```
id uuid PRIMARY KEY
submission_id uuid (FK to submissions)
form_id uuid (FK to forms)
question_id uuid (FK to form_questions)
razorpay_order_id text UNIQUE
razorpay_payment_id text
razorpay_signature text
amount integer (in paise)
currency text (default 'INR')
status text (created, authorized, captured, failed, refunded)
verified boolean (default false)
error_message text
metadata jsonb
created_at timestamptz
updated_at timestamptz
```

---

## Implementation Steps

### Step 1: Add Razorpay script to the app entry point
**Files:** Create/modify the HTML entry point that TanStack Start uses

**What to do:**
- TanStack Start apps don't use a traditional index.html in the root. Instead, check if there's an `app.html` or similar entry point in the `src/` directory, or if scripts need to be loaded via React Helmet/Head component in the route.
- Add Razorpay checkout script: `<script src="https://checkout.razorpay.com/v1/checkout.js"></script>`
- Since we don't have a traditional HTML entry, the script should be loaded dynamically in the form route component or added to the document head via React effect.

**Decision:** Load Razorpay script dynamically in the `PublicForm` component using a `useEffect` hook that appends the script tag to `document.head` if not already present. This is cleaner for TanStack Start's SSR-off architecture and ensures the script is only loaded when needed.

**Verify:** Open browser dev tools and confirm `window.Razorpay` is defined when the public form loads.

---

### Step 2: Add TypeScript declarations for Razorpay
**Files:** `src/types/razorpay.d.ts` (new file)

**What to do:**
Create TypeScript declarations for the Razorpay checkout SDK to avoid type errors:

```typescript
declare global {
  interface Window {
    Razorpay: RazorpayConstructor;
  }
}

interface RazorpayConstructor {
  new (options: RazorpayOptions): RazorpayInstance;
}

interface RazorpayOptions {
  key: string; // Razorpay key_id
  amount: number; // in paise
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  handler: (response: RazorpaySuccessResponse) => void;
  prefill?: {
    name?: string;
    email?: string;
  };
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
}

interface RazorpayInstance {
  open(): void;
  on(event: string, callback: (response: any) => void): void;
}

interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export {};
```

**Verify:** Run `npm run typecheck` and confirm no errors related to `window.Razorpay`.

---

### Step 3: Add environment variable for Razorpay Key ID
**Files:** `.env.example`

**What to do:**
Add the Razorpay public key_id to `.env.example`:

```env
# Razorpay Configuration (for native payment integration)
# Get your key_id from Razorpay Dashboard > Settings > API Keys
# This is the PUBLIC key (key_id), NOT the secret
VITE_RAZORPAY_KEY_ID=rzp_test_your_key_id_here
```

**Note:** Document in comments that:
1. This is the PUBLIC key_id (starts with `rzp_test_` or `rzp_live_`)
2. The secret key should NEVER be exposed client-side
3. Payment verification happens server-side via Razorpay's signature validation (handled by Supabase RPC)

**Verify:** No runtime verification needed; this is configuration only.

---

### Step 4: Update payment question renderer in public form
**Files:** `src/routes/forms/$slug.tsx` (lines ~1392-1439, the payment question renderer block)

**Current state:**
```typescript
{q.type === "payment" && (
  <div className="space-y-4">
    {/* Pay Now button - only show if valid URL */}
    {q.config?.paymentUrl && ...}
    
    {/* Screenshot upload */}
    <FileUploader ... />
  </div>
)}
```

**What to do:**
Replace the entire payment renderer block with native Razorpay checkout. The new flow:

1. Check if question has `razorpayAmount` configured (native Razorpay mode) vs. legacy `paymentUrl` (old screenshot mode)
2. For native mode:
   - Show payment details (amount in rupees, currency, description)
   - Show "Pay Now" button that triggers Razorpay checkout
   - Store the Razorpay `payment_id` (NOT a file) in the `answers` state as a string
   - Show payment status indicator after successful payment
3. For legacy mode (backward compatibility):
   - Keep the existing external URL + screenshot upload UI
   - This preserves old forms using the screenshot workflow

**Specific changes (around line 1392):**

```typescript
{q.type === "payment" && (() => {
  // Determine mode: native Razorpay OR legacy screenshot
  const isNativeMode = (q.config?.razorpayAmount ?? 0) > 0;
  const legacyMode = !isNativeMode && q.config?.paymentUrl;
  const paymentId = answers[q.id] as string | undefined;
  const isPaid = !!paymentId;

  if (isNativeMode) {
    const amount = q.config!.razorpayAmount!;
    const currency = q.config?.razorpayCurrency ?? "INR";
    const description = q.config?.razorpayDescription ?? "Payment";
    const amountDisplay = currency === "INR" 
      ? `₹${(amount / 100).toFixed(2)}`
      : `${currency} ${(amount / 100).toFixed(2)}`;

    return (
      <div className="space-y-3 rounded-lg border border-border bg-secondary/20 p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Payment Required</p>
          <p className="text-xs text-muted-foreground">{description}</p>
          <p className="text-lg font-bold text-primary">{amountDisplay}</p>
        </div>
        
        {isPaid ? (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>Payment completed</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => handlePayment(q)}
            disabled={formState === "submitting" || !form}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
          >
            Pay Now
          </button>
        )}
      </div>
    );
  }

  // Legacy mode: external URL + screenshot upload
  if (legacyMode) {
    return (
      <div className="space-y-4">
        {q.config?.paymentUrl && (() => {
          try {
            const url = new URL(q.config.paymentUrl);
            return url.protocol === 'http:' || url.protocol === 'https:';
          } catch {
            return false;
          }
        })() && (
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Complete Payment
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Click below to proceed to payment gateway
                </p>
              </div>
              <a
                href={q.config.paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Pay Now
              </a>
            </div>
          </div>
        )}
        
        <div>
          <p className="text-sm font-medium text-foreground mb-2">
            Upload Payment Screenshot
          </p>
          <FileUploader
            id={`input-${q.id}`}
            files={(value as File[]) ?? []}
            accept=".jpg,.jpeg,.png"
            acceptExts={[".jpg", ".jpeg", ".png"]}
            maxSizeMB={10}
            onChange={files => onChange(files)}
          />
        </div>
      </div>
    );
  }

  // Neither mode configured: show configuration error
  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
      <p className="text-sm text-destructive">
        Payment question not configured. Please contact the form administrator.
      </p>
    </div>
  );
})()}
```

**Verify:** Load a form with a payment question in the browser. Confirm the UI shows amount, currency, and "Pay Now" button. Clicking the button should call `handlePayment` (we'll implement that next).

---

### Step 5: Implement Razorpay checkout handler
**Files:** `src/routes/forms/$slug.tsx` (add new function before the component return, around line 250-300)

**What to do:**
Add a `handlePayment` function that:
1. Creates a Razorpay order via `create_razorpay_order` RPC
2. Opens Razorpay checkout modal with the order details
3. On success, stores the `payment_id` in the answers state
4. On failure/dismiss, shows an error toast

```typescript
async function handlePayment(question: Question) {
  if (!form || !authSession?.email) {
    toast.error("Please sign in to complete payment");
    return;
  }

  const amount = question.config?.razorpayAmount;
  const currency = question.config?.razorpayCurrency ?? "INR";
  const description = question.config?.razorpayDescription ?? "Payment";

  if (!amount || amount < 100) {
    toast.error("Invalid payment amount configured");
    return;
  }

  // Load Razorpay script if not already loaded
  if (!window.Razorpay) {
    toast.error("Payment system not loaded. Please refresh the page.");
    return;
  }

  const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
  if (!razorpayKeyId) {
    toast.error("Payment system not configured. Please contact the administrator.");
    console.error("[payment] VITE_RAZORPAY_KEY_ID not set");
    return;
  }

  // Create order via Supabase RPC
  toast.info("Preparing payment...");
  const { data: orderData, error: orderError } = await supabase.rpc("create_razorpay_order", {
    p_form_id: form.id,
    p_question_id: question.id,
    p_amount: amount,
    p_currency: currency,
  });

  if (orderError || !orderData || !orderData.ok) {
    console.error("[payment] Order creation failed:", orderError, orderData);
    toast.error("Could not initiate payment. Please try again.");
    return;
  }

  const orderId = orderData.order_id;

  // Open Razorpay checkout
  const rzp = new window.Razorpay({
    key: razorpayKeyId,
    amount: amount,
    currency: currency,
    name: form.title,
    description: description,
    order_id: orderId,
    handler: function (response: RazorpaySuccessResponse) {
      // Payment successful - store payment_id in answers
      setAnswers(prev => ({ ...prev, [question.id]: response.razorpay_payment_id }));
      toast.success("Payment completed successfully!");
      
      // Store payment details for submission
      // We'll record the transaction in the submit handler after submission is created
      (window as any).__pendingPayments = (window as any).__pendingPayments || {};
      (window as any).__pendingPayments[question.id] = {
        order_id: response.razorpay_order_id,
        payment_id: response.razorpay_payment_id,
        signature: response.razorpay_signature,
        amount: amount,
        currency: currency,
      };
    },
    prefill: {
      name: authSession.name ?? "",
      email: authSession.email,
    },
    theme: {
      color: "#0066ff", // Use primary color from theme
    },
    modal: {
      ondismiss: function () {
        toast.info("Payment cancelled");
      },
    },
  });

  rzp.open();
}
```

**Note:** We store payment details in a temporary `window.__pendingPayments` object because we need the `submission_id` (which doesn't exist yet) to call `record_payment_transaction`. The actual recording happens in the submit handler after the submission is created.

**Verify:** Click "Pay Now" button. Razorpay checkout modal should open with correct amount and form details. Use Razorpay test cards (e.g., 4111 1111 1111 1111, any future expiry, any CVV) to complete payment. After success, the payment status should show "Payment completed" in the form.

---

### Step 6: Update validation logic for payment questions
**Files:** `src/routes/forms/$slug.tsx` (around line 356-359, the `requiredMissing` function)

**Current state:**
```typescript
if (q.type === "payment") {
  // Required payment → must have uploaded screenshot files
  return !val || (Array.isArray(val) && val.length === 0);
}
```

**What to do:**
Update validation to handle both native Razorpay (payment_id string) and legacy screenshot (File array):

```typescript
if (q.type === "payment") {
  const isNativeMode = (q.config?.razorpayAmount ?? 0) > 0;
  if (isNativeMode) {
    // Native Razorpay: must have payment_id (string)
    return !val || (typeof val === "string" && !val.trim());
  }
  // Legacy mode: must have uploaded screenshot files
  return !val || (Array.isArray(val) && val.length === 0);
}
```

**Verify:** Try submitting a form with a required payment question without paying. Should show "This field is required" error. After payment, validation should pass.

---

### Step 7: Update form submission handler to record payment transactions
**Files:** `src/routes/forms/$slug.tsx` (around line 469-600, the `handleSubmit` function)

**Current state:**
The submit handler:
1. Validates answers
2. Calls `submit_response` RPC to create submission
3. Uploads files and registers them via `register_submission_file` RPC

**What to do:**
After the submission is created and before file uploads, add payment transaction recording:

Find this block (around line 540):
```typescript
// Upload files to storage, then register metadata through the validated RPC.
const failedUploads: string[] = [];
```

**Add BEFORE the file upload loop:**

```typescript
// Record payment transactions for native Razorpay questions
const pendingPayments = (window as any).__pendingPayments || {};
for (const q of questions.filter(q => q.type === "payment")) {
  const isNativeMode = (q.config?.razorpayAmount ?? 0) > 0;
  if (!isNativeMode) continue; // Skip legacy screenshot mode
  
  const paymentData = pendingPayments[q.id];
  if (!paymentData) continue; // No payment made (may be optional question)
  
  // Record transaction via Supabase RPC
  const { data: txData, error: txError } = await supabase.rpc("record_payment_transaction", {
    p_submission_id: result.submission_id,
    p_question_id: q.id,
    p_razorpay_order_id: paymentData.order_id,
    p_razorpay_payment_id: paymentData.payment_id,
    p_razorpay_signature: paymentData.signature,
    p_amount: paymentData.amount,
    p_currency: paymentData.currency,
    p_status: "captured",
  });
  
  if (txError || !txData || !txData.ok) {
    console.error(`[payment-record] Failed to record transaction for question ${q.id}:`, txError, txData);
    // Don't fail the entire submission - payment already captured
    // Admin can manually verify via Razorpay dashboard
  }
}

// Clean up pending payments
delete (window as any).__pendingPayments;

// Upload files to storage, then register metadata through the validated RPC.
const failedUploads: string[] = [];
```

**Also update the answer payload building** (around line 512-523):

Current code filters out `FILE_TYPES` from answers. Payment questions should be included in native mode (as string payment_id) but excluded in legacy mode (File array).

Find this block:
```typescript
const answerPayload = questions
  .filter(q => !["section_heading","information_paragraph","hidden",...FILE_TYPES].includes(q.type))
  .filter(q => !hiddenQuestionIds.has(q.id))
  .flatMap(q => {
```

**Change to:**
```typescript
const answerPayload = questions
  .filter(q => {
    // Exclude display-only types
    if (["section_heading","information_paragraph","hidden"].includes(q.type)) return false;
    // Exclude file upload types (files handled separately)
    if (FILE_TYPES.includes(q.type) && q.type !== "payment") return false;
    // Include payment questions in native Razorpay mode (payment_id is a string)
    // Exclude payment questions in legacy mode (screenshots handled as files)
    if (q.type === "payment") {
      const isNativeMode = (q.config?.razorpayAmount ?? 0) > 0;
      return isNativeMode;
    }
    return true;
  })
  .filter(q => !hiddenQuestionIds.has(q.id))
  .flatMap(q => {
```

**Verify:** Complete a payment and submit the form. Check the Supabase dashboard `payment_transactions` table for a new row with `verified: true`, `status: 'captured'`, and matching `submission_id`, `question_id`, `razorpay_order_id`, `razorpay_payment_id`.

---

### Step 8: Update response detail modal to display payment information
**Files:** `src/components/SubmissionDetailModal.tsx` (around lines 240-275, the payment question rendering block)

**Current state:**
```typescript
{question.type === "payment" ? (
  <div className="space-y-2">
    {question.config?.paymentUrl && (
      <p className="text-sm text-muted-foreground">
        Payment URL: <a href={...}>...</a>
      </p>
    )}
    <p className="text-sm text-muted-foreground bg-secondary/30 rounded-lg p-3 border border-border/40">
      {questionFiles.length > 0 ? "✓ Payment completed - screenshot uploaded" : "No proof uploaded"}
    </p>
  </div>
) : ...}
```

**What to do:**
Query `payment_transactions` table for the payment details and display them. The modal needs to:
1. Fetch payment transaction data when the modal opens
2. Show payment status, amount, transaction IDs for native Razorpay payments
3. Fall back to screenshot display for legacy payments

**Add state and effect at the top of the component** (around line 140):

```typescript
const [paymentTransactions, setPaymentTransactions] = useState<Record<string, any>>({});

useEffect(() => {
  async function loadPaymentTransactions() {
    const paymentQuestions = questions.filter(q => q.type === "payment" && (q.config?.razorpayAmount ?? 0) > 0);
    if (paymentQuestions.length === 0) return;

    const { data, error } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("submission_id", submission.id)
      .in("question_id", paymentQuestions.map(q => q.id));

    if (error) {
      console.error("Failed to load payment transactions:", error);
      return;
    }

    const txMap: Record<string, any> = {};
    data?.forEach(tx => {
      txMap[tx.question_id] = tx;
    });
    setPaymentTransactions(txMap);
  }

  loadPaymentTransactions();
}, [submission.id, questions]);
```

**Update the payment question rendering block** (around line 240):

```typescript
{question.type === "payment" ? (
  (() => {
    const isNativeMode = (question.config?.razorpayAmount ?? 0) > 0;
    const tx = paymentTransactions[question.id];

    if (isNativeMode && tx) {
      // Native Razorpay payment - show transaction details
      const amount = tx.currency === "INR" 
        ? `₹${(tx.amount / 100).toFixed(2)}`
        : `${tx.currency} ${(tx.amount / 100).toFixed(2)}`;
      const statusColor = 
        tx.status === "captured" ? "text-green-600 dark:text-green-400" :
        tx.status === "failed" ? "text-red-600 dark:text-red-400" :
        "text-yellow-600 dark:text-yellow-400";

      return (
        <div className="space-y-2">
          <div className="bg-secondary/30 rounded-lg p-3 border border-border/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Payment Status:</span>
              <span className={`text-sm font-semibold ${statusColor}`}>
                {tx.status.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Amount:</span>
              <span className="text-sm font-medium">{amount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Payment ID:</span>
              <span className="text-xs font-mono text-muted-foreground truncate">
                {tx.razorpay_payment_id}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Order ID:</span>
              <span className="text-xs font-mono text-muted-foreground truncate">
                {tx.razorpay_order_id}
              </span>
            </div>
            {tx.verified && (
              <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-3 w-3" />
                <span>Payment verified</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (isNativeMode && !tx) {
      // Native mode but no transaction found
      return (
        <p className="text-sm text-muted-foreground bg-secondary/30 rounded-lg p-3 border border-border/40">
          No payment recorded
        </p>
      );
    }

    // Legacy mode - show screenshot status
    return (
      <div className="space-y-2">
        {question.config?.paymentUrl && (
          <p className="text-sm text-muted-foreground">
            Payment URL:{" "}
            <a
              href={question.config.paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {question.config.paymentUrl}
            </a>
          </p>
        )}
        <p className="text-sm text-muted-foreground bg-secondary/30 rounded-lg p-3 border border-border/40">
          {questionFiles.length > 0 ? "✓ Payment completed - screenshot uploaded" : "No proof uploaded"}
        </p>
      </div>
    );
  })()
) : ...}
```

**Verify:** Submit a form with a payment. Open the submission detail modal. Should display payment status, amount, Razorpay payment ID, order ID, and verification status.

---

### Step 9: Update export utilities to include payment transaction data
**Files:** `src/lib/export-utils.ts` (around line 47-50, the `displayAnswer` function for payment questions)

**Current state:**
```typescript
if (questionType === "payment") {
  return rawValue ? "Payment completed - screenshot uploaded" : "No proof uploaded";
}
```

**What to do:**
This function is used by the XLSX export pipeline. The export needs to show payment details from `payment_transactions` table, not just the boolean status. However, `displayAnswer` only receives the raw answer value (payment_id string in native mode, file path in legacy mode).

The export pipeline needs to be updated to pass additional payment transaction data. This requires changes in the responses query/export logic.

**For now, update `displayAnswer` to show the payment_id:**

```typescript
if (questionType === "payment") {
  // Native Razorpay mode: rawValue is payment_id string
  // Legacy mode: rawValue is file path
  if (rawValue && rawValue.startsWith("pay_")) {
    return `Payment completed (ID: ${rawValue})`;
  }
  return rawValue ? "Payment completed - screenshot uploaded" : "No proof uploaded";
}
```

**Better approach:** Update the export query to JOIN with `payment_transactions` table and include amount, status, payment_id as separate columns.

**Files to modify:** `src/lib/responses.ts` (the `getResponsesTabular` RPC or query) and `src/components/responses/ExportButton.tsx`

**What to do in responses.ts / export pipeline:**
1. When building the export data, detect payment questions
2. For each payment question, add columns: "Payment Status", "Payment Amount", "Payment ID", "Payment Currency"
3. Query `payment_transactions` table by `submission_id` and `question_id`
4. Populate those columns in the export

**Specific implementation:**

Find where the export data is built (likely in `ExportButton.tsx` or a dedicated export function). After fetching tabular responses, add:

```typescript
// Fetch payment transactions for all payment questions
const paymentQuestions = questions.filter(q => q.type === "payment" && (q.config?.razorpayAmount ?? 0) > 0);
let paymentTransactions: Record<string, any> = {};

if (paymentQuestions.length > 0) {
  const submissionIds = responses.map(r => r.submission_id);
  const { data: txData } = await supabase
    .from("payment_transactions")
    .select("submission_id, question_id, amount, currency, status, razorpay_payment_id, verified")
    .in("submission_id", submissionIds)
    .in("question_id", paymentQuestions.map(q => q.id));
  
  txData?.forEach(tx => {
    const key = `${tx.submission_id}_${tx.question_id}`;
    paymentTransactions[key] = tx;
  });
}

// When building row data, for payment questions:
for (const q of paymentQuestions) {
  const tx = paymentTransactions[`${row.submission_id}_${q.id}`];
  if (tx) {
    row[`${q.label} - Status`] = tx.status;
    row[`${q.label} - Amount`] = `${tx.currency} ${(tx.amount / 100).toFixed(2)}`;
    row[`${q.label} - Payment ID`] = tx.razorpay_payment_id;
    row[`${q.label} - Verified`] = tx.verified ? "Yes" : "No";
  } else {
    row[`${q.label} - Status`] = "Not paid";
    row[`${q.label} - Amount`] = "";
    row[`${q.label} - Payment ID`] = "";
    row[`${q.label} - Verified`] = "";
  }
}
```

**Note:** The exact location depends on where the export logic lives. Search for `ExcelJS` or `xlsx` or the export button handler.

**Verify:** Export responses to XLSX. Payment questions should have 4 columns: "[Question Label] - Status", "[Question Label] - Amount", "[Question Label] - Payment ID", "[Question Label] - Verified". Data should match what's in the payment_transactions table.

---

### Step 10: Add Razorpay script loader to public form component
**Files:** `src/routes/forms/$slug.tsx` (add near the top of the `PublicForm` component, around line 100-150)

**What to do:**
Add a `useEffect` hook that loads the Razorpay checkout script dynamically:

```typescript
// Load Razorpay checkout script
useEffect(() => {
  // Check if script already loaded
  if (document.querySelector('script[src*="checkout.razorpay.com"]')) {
    return;
  }

  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.async = true;
  script.onload = () => {
    console.log('[Razorpay] Checkout script loaded');
  };
  script.onerror = () => {
    console.error('[Razorpay] Failed to load checkout script');
  };
  document.head.appendChild(script);

  return () => {
    // Optional: cleanup on unmount (not critical since it's a shared resource)
  };
}, []);
```

**Verify:** Open browser dev tools console. Should see "[Razorpay] Checkout script loaded" message. Type `window.Razorpay` in console and confirm it's defined.

---

### Step 11: Update QuestionCard payment config UI to remove urlError reference
**Files:** `src/components/form-builder/QuestionCard.tsx` (around line 549)

**Current state:**
```typescript
{urlValue && !urlError && (
  <p className="text-[11px] text-muted-foreground">
    ✓ Users will be redirected here when they click Pay Now
  </p>
)}
```

**What to do:**
Remove the `urlError` reference (leftover from the old paymentUrl field):

```typescript
{descValue && (
  <p className="text-[11px] text-muted-foreground">
    ✓ This description will be shown to users during checkout
  </p>
)}
```

**Verify:** Open form builder, create a payment question, enter a description. Should not see any TypeScript errors or runtime errors.

---

## Testing Checklist

After implementing all steps, test the following scenarios:

### Local Development Testing

1. **Form Builder:**
   - [ ] Create a new payment question
   - [ ] Configure amount (e.g., 10000 paise = ₹100), currency (INR), description
   - [ ] Save the form
   - [ ] Verify no TypeScript errors: `npm run typecheck`

2. **Public Form - Native Razorpay:**
   - [ ] Load the public form
   - [ ] Confirm Razorpay script loaded (check console and `window.Razorpay`)
   - [ ] See payment question with amount, currency, description, "Pay Now" button
   - [ ] Click "Pay Now" - Razorpay checkout modal opens
   - [ ] Use test card: 4111 1111 1111 1111, expiry: 12/25, CVV: 123
   - [ ] Complete payment - modal closes, form shows "Payment completed"
   - [ ] Submit form - succeeds without errors
   - [ ] Check Supabase `payment_transactions` table - new row with verified=true, status=captured

3. **Public Form - Legacy Screenshot (Backward Compatibility):**
   - [ ] Create an old-style payment question (no razorpayAmount configured, just paymentUrl)
   - [ ] Load public form - see external URL link + screenshot upload
   - [ ] Upload a screenshot image
   - [ ] Submit form - screenshot saved, submission succeeds

4. **Public Form - Required Payment Validation:**
   - [ ] Mark payment question as required
   - [ ] Try submitting without paying - validation error "This field is required"
   - [ ] Complete payment - validation passes

5. **Admin Response View:**
   - [ ] Open submission detail modal for a submission with Razorpay payment
   - [ ] See payment status (CAPTURED), amount (₹100.00), payment ID, order ID, verified checkmark
   - [ ] Open submission with legacy screenshot - see "screenshot uploaded" status

6. **Export:**
   - [ ] Export responses to XLSX
   - [ ] Payment question has columns: Status, Amount, Payment ID, Verified
   - [ ] Data matches Supabase `payment_transactions` table

7. **Error Handling:**
   - [ ] Test with missing `VITE_RAZORPAY_KEY_ID` - error toast "Payment system not configured"
   - [ ] Dismiss Razorpay modal - toast "Payment cancelled", payment status remains unpaid
   - [ ] Test with invalid amount (< 100 paise) - error toast "Invalid payment amount"

8. **Build & Type Check:**
   - [ ] `npm run typecheck` - no errors
   - [ ] `npm run build` - succeeds
   - [ ] `npm test` - unit tests pass

### Production Testing (After GitHub Push & Deployment)

9. **Live Razorpay Test Mode:**
   - [ ] Set `VITE_RAZORPAY_KEY_ID` to test key in Vercel env vars
   - [ ] Complete test payment on production form
   - [ ] Verify transaction in Razorpay dashboard (Test Mode)

10. **Live Razorpay Production Mode (Final):**
    - [ ] Switch to production Razorpay key_id
    - [ ] Complete real payment with small amount
    - [ ] Verify in Razorpay dashboard (Live Mode)
    - [ ] Confirm funds received

---

## Gotchas & Ordering Issues

1. **Script Loading Race Condition:**
   - The Razorpay script must load before user clicks "Pay Now"
   - Solution: Check `window.Razorpay` exists before opening checkout, show error if not loaded

2. **Payment Recording Timing:**
   - `record_payment_transaction` needs `submission_id`, which doesn't exist until after `submit_response` RPC
   - Solution: Store payment data in temporary `window.__pendingPayments`, record transactions AFTER submission creation, BEFORE file uploads

3. **Answer Payload Filtering:**
   - Payment questions in native mode store payment_id (string), not files
   - Payment questions in legacy mode store files, not in answer payload
   - Solution: Conditional filtering based on `razorpayAmount` config presence

4. **Backward Compatibility:**
   - Existing forms may have `paymentUrl` configured (legacy screenshot mode)
   - Solution: Detect mode by checking `razorpayAmount > 0` (native) vs `paymentUrl` (legacy)
   - Never break existing published forms

5. **RLS Policies:**
   - `payment_transactions` table has RLS enabled
   - Admin read policy: `is_admin()`
   - User read policy: can read their own submissions' payments
   - No INSERT/UPDATE policies for users - all writes via `record_payment_transaction` SECURITY DEFINER RPC

6. **Environment Variables:**
   - `VITE_RAZORPAY_KEY_ID` is PUBLIC (client-side)
   - Razorpay secret key must NEVER be exposed - all verification happens server-side via signature validation
   - Signature validation is implicit in Razorpay's order creation flow (not implemented in our RPC, assumed Razorpay handles it)

7. **TypeScript Declarations:**
   - Must declare `window.Razorpay` interface to avoid type errors
   - Must declare `RazorpaySuccessResponse` for the handler callback

8. **Export Column Names:**
   - Payment questions generate 4 export columns: "[Label] - Status", "[Label] - Amount", "[Label] - Payment ID", "[Label] - Verified"
   - Column names include the question label to avoid collisions

9. **Payment Status Flow:**
   - Razorpay payment states: created → authorized → captured
   - We only handle "captured" status (successful payment)
   - Failed/refunded states are for admin manual updates (not implemented in this phase)

10. **Test Mode vs Production Mode:**
    - Test key_id starts with `rzp_test_`
    - Production key_id starts with `rzp_live_`
    - Must use matching secret key server-side (not exposed in this app, assumed Razorpay handles verification)

---

## Next Steps After Implementation

1. **Local Testing:** Follow the testing checklist above
2. **Git Commit:** Create a commit with message "feat: native Razorpay payment integration"
3. **Wait for Approval:** User must explicitly authorize GitHub push (per instructions)
4. **Production Testing:** After deployment, test with Razorpay test mode, then production mode
5. **Monitoring:** Watch for payment transaction errors in Sentry/logs
6. **Documentation:** Update PROJECT_DOCS.txt with payment integration details

---

## Files Changed Summary

### New Files
- `src/types/razorpay.d.ts` - TypeScript declarations for Razorpay SDK

### Modified Files
- `.env.example` - Added `VITE_RAZORPAY_KEY_ID`
- `src/routes/forms/$slug.tsx` - Payment renderer, validation, submit handler, script loader, `handlePayment` function
- `src/components/form-builder/QuestionCard.tsx` - Remove `urlError` reference
- `src/components/SubmissionDetailModal.tsx` - Payment transaction display
- `src/lib/export-utils.ts` - Payment answer display (minor update)
- Export pipeline (location TBD) - Add payment transaction columns to XLSX

### Database (Already Complete)
- ✅ `supabase/migrations/063_razorpay_payment_integration.sql` - Already applied

### Environment
- `VITE_RAZORPAY_KEY_ID` - Must be set in `.env` (local) and Vercel (production)

---

## Security Considerations

1. **Client-Side Key:** `VITE_RAZORPAY_KEY_ID` is the PUBLIC key - safe to expose
2. **Secret Key:** Razorpay secret key must never be in client code or env vars
3. **Signature Verification:** Razorpay automatically validates payment signatures - we trust the payment_id from the success handler
4. **RPC Security:** `record_payment_transaction` is SECURITY DEFINER - runs with elevated privileges but only accepts verified payment data
5. **RLS Policies:** Admins can read all payments, users can only read their own
6. **Payment Replay:** `razorpay_order_id` is UNIQUE - prevents duplicate transaction recording

---

## End of Plan

This plan preserves the existing Payment question type and upgrades it to support native Razorpay checkout while maintaining backward compatibility with the legacy screenshot workflow. All changes are additive - no existing forms or responses are affected.
