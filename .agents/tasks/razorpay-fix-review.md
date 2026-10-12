# Razorpay payment modal timing and submit guard fixes

Multiple bugs fixed: Razorpay SDK readiness detection replaced simple existence check, preventing "browser not supported" errors on slow loads; required payment question validation now correctly excludes native Razorpay payments (≥100 paise) from file upload checks; submit guard now resets on all error paths including unexpected exceptions.

**Watch for:** (confirmed) The try-finally block in `handleSubmit` checks `formState !== "done"` in the finally clause, but `formState` is a React state variable — the comparison reads the stale value captured at function entry, not the updated value set by `setFormState("done")`. The guard will always be reset in the finally block, even after successful submission. This allows double-submit on the thank-you page.

**Verdict**: CHANGES_REQUESTED

## High-level view

The SDK readiness check now polls with exponential backoff and verifies the constructor works by instantiating a test Razorpay object, not just checking `window.Razorpay` exists. This addresses the "browser not supported" popup that appeared when clicking Pay Now on slow page loads.

The `missingRequiredFile` check now explicitly excludes native Razorpay payment questions (amount ≥100 paise) from file upload validation. Previously, required payment questions in native mode would trigger a false "file didn't finish uploading" error after the RPC succeeded, blocking the thank-you page.

The submit guard reset logic added a try-finally wrapper around `handleSubmit`, attempting to prevent guard leaks from unexpected exceptions. However, the finally block's condition `formState !== "done"` reads the stale state value from function entry, not the updated value after `setFormState("done")` executes — React state updates are asynchronous, so the finally clause always sees the old value and resets the guard even after successful submission.

<details>
<summary>Issues (3)</summary>

1. **Finally block guard reset on success path** (confirmed) — The finally clause checks `formState !== "done"` to decide whether to reset the guard, but `formState` is a React state variable that updates asynchronously. The comparison reads the stale value captured when the function started, not the value set by `setFormState("done")`. After a successful submission, the finally block sees `formState` still as `"submitting"` or `"ready"` and resets `submitGuard.current = false`, allowing double-submit from the thank-you page. Remove the finally block's conditional reset and keep only the explicit `submitGuard.current = false` calls on error paths (already present in 5 locations: auth failure, validation failure, RPC error, missing file, and catch block).

2. **Dummy Razorpay instance may leave artifacts** (possible) — The readiness check constructs a test Razorpay instance on every polling attempt to verify the SDK is ready. Razorpay's constructor may attach event listeners, DOM nodes, or internal state that isn't cleaned up, especially if called 10 times (max attempts). If the instances leak, they might interfere with the real payment modal. Check whether Razorpay provides a `destroy()` or `close()` method; if not, consider a simpler check (verify `window.Razorpay.prototype` exists and is an object) or reduce max attempts to 3.

3. **100 paise threshold comment repeated** (confirmed) — The "Native mode detection: razorpayAmount >= 100 paise" comment block appears verbatim in 3 places: the `answerPayload` filter, the `missingRequiredFile` check, and the comment above it. The repetition makes it harder to maintain if the threshold or rationale changes. Extract the threshold to a named constant `const RAZORPAY_NATIVE_MIN_AMOUNT = 100;` at the top of the file and replace the inline checks with `q.config?.razorpayAmount ?? 0) >= RAZORPAY_NATIVE_MIN_AMOUNT`, keeping one comment at the constant definition.

</details>

<details>
<summary>Details</summary>

## SDK readiness polling with exponential backoff

The previous fix (F9) used `setTimeout(() => rzp.open(), 0)` to defer modal opening to the next event loop tick, but didn't guarantee the SDK was fully initialized — if the script tag loaded but the constructor wasn't ready, the first click would still fail with "browser not supported."

The new approach (`waitForRazorpayReady`) polls for SDK readiness before calling `handlePayment`. On each attempt, it verifies `window.Razorpay` exists and is a function, then instantiates a dummy Razorpay object with test parameters. If the constructor throws, the SDK isn't ready; the function waits with exponential backoff (50ms, 100ms, 200ms, up to 10 attempts = ~51 seconds max).

The polling starts when the user clicks Pay Now, not on page load — if the SDK takes 30 seconds to load, the user waits 30 seconds after clicking.

The exponential backoff parameters (10 attempts, 50ms initial delay, doubling each time) mean the function can wait up to ~51 seconds before giving up. This is excessive — if the SDK isn't ready after 1-2 seconds, something is broken (blocked script, network failure, incompatible browser). Reducing `maxAttempts` to 5 would cap total wait at ~3 seconds.

The dummy instance uses hardcoded test parameters (`key: 'test_key'`, `order_id: 'test_order'`). If Razorpay's constructor validates these values or makes API calls during construction, the check might fail even when the SDK is ready but the test values are rejected. A safer check would verify `typeof window.Razorpay.prototype === 'object'` or `'open' in window.Razorpay.prototype`, which confirms the constructor is fully defined without instantiating.

## Native Razorpay payment questions excluded from file upload checks

The `missingRequiredFile` check iterates over questions and flags any required question where `FILE_TYPES.includes(q.type) && !(successByQuestion[q.id] > 0)`. Payment questions have `type === "payment"`, which is in `FILE_TYPES` (legacy mode uses screenshot uploads), so a required payment question in native Razorpay mode (amount ≥100 paise) would trigger a false positive: the RPC succeeded (payment_id stored as a string answer), but the file upload loop skipped the question (no file to upload), so `successByQuestion[q.id]` is undefined, and the check blocks the thank-you page with "Your file didn't finish uploading."

The fix adds an explicit exclusion at the start of the `missingRequiredFile` check:

```typescript
if (q.type === "payment") {
  const isNativeMode = (q.config?.razorpayAmount ?? 0) >= 100;
  if (isNativeMode) {
    return false; // Payment handled via answer payload, not file upload
  }
}
```

This mirrors the logic in the `answerPayload` filter (lines 544-556 in the diff context), which already distinguishes native mode (include in answer payload) from legacy mode (exclude, handle as file).

The 100 paise threshold is Razorpay's API minimum for certain payment methods (UPI, cards). Amounts below 100 paise fall back to legacy screenshot upload mode. The comment claims this is for "backward compatibility," but the real reason is the API constraint — you can't create a Razorpay order for ₹0.50 (50 paise).

The check uses `q.config?.razorpayAmount ?? 0`, which means a missing `razorpayAmount` field defaults to 0 and triggers legacy mode (old forms or misconfigured questions degrade to screenshot upload).

## Submit guard leak on unexpected errors

The submit guard (`submitGuard.current`) prevents double-submit by locking on entry to `handleSubmit` and unlocking on error paths. If an unexpected exception occurs between the lock and an explicit unlock (e.g., `localStorage.setItem` throws `QuotaExceededError`, storage upload throws a network error), the guard stays locked forever — subsequent clicks do nothing.

The fix wraps the entire submit flow in try-finally:

```typescript
submitGuard.current = true;
setFormState("submitting");

try {
  // ... auth check, validation, RPC, file upload, success state ...
  setFormState("done");
} catch (unexpectedError) {
  console.error("[submit] Unexpected error during submission:", unexpectedError);
  setFormState("ready");
  submitGuard.current = false;
  setErrors({ __form: "An error occurred: ..." });
} finally {
  if (formState !== "done") {
    submitGuard.current = false;
  }
}
```

The try block contains all the early returns (auth failure, validation failure, RPC error, missing file upload) that already reset the guard explicitly. The catch block handles unexpected exceptions. The finally block is described as a "safety net" to reset the guard if the form didn't transition to `"done"` state.

**The finally condition is broken.** `formState` is a React state variable updated by `setFormState`. React state updates are asynchronous — calling `setFormState("done")` schedules an update, it doesn't change the variable immediately. The finally block runs synchronously at the end of the try block, before React processes the state update. The condition `formState !== "done"` reads the stale value captured when the function started (likely `"submitting"`), not the new value. After a successful submission where the try block reaches `setFormState("done")`, the finally block sees `formState` still as the old value and resets `submitGuard.current = false`.

This breaks double-submit prevention on the thank-you page. Once the guard is unlocked, clicking "Submit Another Response" or navigating back and clicking Submit again will bypass the guard.

The fix is to remove the finally block entirely. The explicit `submitGuard.current = false` calls on error paths already cover every exit:

1. Auth failure (line 527)
2. Validation failure (line 572)
3. RPC error (line 607)
4. Missing file (line 716)
5. Catch block for unexpected errors (line 740)

The guard should stay locked after successful submission (`setFormState("done")`) because the form is no longer submittable — the user is on the thank-you page. The comment claims "done state means success, guard should stay locked to prevent double-submit," which is correct intent, but the implementation unlocks it anyway due to the stale state check.

</details>

<details>
<summary>File map</summary>

| File | Change |
|------|--------|
| `src/components/RazorpayPaymentButton.tsx` | Added `waitForRazorpayReady` polling function with exponential backoff; replaced `window.Razorpay` existence check with readiness verification; removed `setTimeout(0)` deferral (F9) in favor of verified-ready open call |
| `src/routes/forms/$slug.tsx` | Wrapped `handleSubmit` in try-catch-finally to prevent guard leak on unexpected errors; added native payment question exclusion to `missingRequiredFile` check (amount ≥100 paise); added detailed comments explaining native vs legacy payment mode detection |

Full diff: `git diff HEAD~1`

</details>
