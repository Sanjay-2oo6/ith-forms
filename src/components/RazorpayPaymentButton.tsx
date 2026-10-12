import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

// Razorpay SDK types
declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

/**
 * F10: Wait for Razorpay SDK to be fully initialized and ready.
 * The script may load (window.Razorpay exists) but the constructor may not be
 * fully ready on heavily loaded pages or slow devices, causing "browser not supported" errors.
 * 
 * This polls with exponential backoff, verifying the SDK constructor and prototype
 * are fully defined before opening the payment modal.
 * 
 * NOTE: Razorpay SDK includes device fingerprinting for fraud detection that may attempt
 * to load resources from localhost URLs. ERR_CONNECTION_REFUSED errors in the console
 * are expected Razorpay behavior and do not affect payment functionality.
 */
async function waitForRazorpayReady(maxAttempts = 5, initialDelayMs = 100): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    // Check that Razorpay exists, is a function, and has a fully defined prototype
    // This verifies the SDK is loaded and initialized without creating test instances
    if (
      window.Razorpay &&
      typeof window.Razorpay === 'function' &&
      typeof window.Razorpay.prototype === 'object' &&
      'open' in window.Razorpay.prototype
    ) {
      console.log(`[payment] Razorpay SDK ready after ${i} attempts`);
      return true;
    }
    
    // Not ready yet - exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms (max ~3.1s total)
    console.log(`[payment] Razorpay SDK not ready, attempt ${i + 1}/${maxAttempts}`);
    const delay = initialDelayMs * Math.pow(2, i);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  return false;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
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
}

interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayPaymentButtonProps {
  formId: string;
  formTitle: string;
  questionId: string;
  amount: number;
  currency: string;
  description: string;
  userEmail?: string;
  userName?: string;
  onSuccess: (paymentId: string, orderDetails: RazorpaySuccessResponse) => void;
  disabled?: boolean;
}

export function RazorpayPaymentButton({
  formId,
  formTitle,
  questionId,
  amount,
  currency,
  description,
  userEmail,
  userName,
  onSuccess,
  disabled,
}: RazorpayPaymentButtonProps) {
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  async function handlePayment() {
    // F10: Wait for SDK to be fully ready (not just loaded)
    // On heavily loaded pages or slow devices, the SDK may exist but not be fully initialized
    const isReady = await waitForRazorpayReady();
    if (!isReady) {
      toast.error("Payment system is still loading. Please wait a moment and try again.");
      return;
    }

    // Validate environment configuration
    const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
    if (!razorpayKeyId) {
      toast.error("Payment system not configured. Please contact the administrator.");
      console.error("[payment] VITE_RAZORPAY_KEY_ID not set");
      return;
    }

    // Validate amount (Razorpay supports amounts as low as 1 paise)
    if (!amount || amount < 1) {
      toast.error("Invalid payment amount configured");
      return;
    }

    setIsCreatingOrder(true);

    try {
      // Create order via backend API (secure: secret key never exposed to frontend)
      console.log("[payment] Creating order with amount:", amount);
      
      const orderResponse = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amount,
          currency: currency,
          formId: formId,
          questionId: questionId,
          userEmail: userEmail,
        }),
      });

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        console.error("[payment] Order creation failed:", errorData);
        throw new Error(errorData?.message || "Order creation failed");
      }

      const orderData = await orderResponse.json();
      const orderId = orderData.orderId;
      console.log("[payment] Order created:", orderId);
      console.log("[payment] Order data:", orderData);

      setIsCreatingOrder(false);
      setIsProcessing(true);

      // Now open Razorpay checkout with the created order
      const rzp = new window.Razorpay({
        key: razorpayKeyId,
        order_id: orderId,
        amount: amount,
        currency: currency,
        name: formTitle,
        description: description,
        handler: async function (response: RazorpaySuccessResponse) {
          // Payment successful - verification will happen during form submission
          console.log("[payment] Payment successful:", response.razorpay_payment_id);
          
          toast.success("Payment completed successfully!");
          
          setIsProcessing(false);
          onSuccess(response.razorpay_payment_id, response);
        },
        prefill: {
          name: userName ?? "",
          email: userEmail ?? "",
        },
        theme: {
          color: "#0066ff",
        },
        modal: {
          ondismiss: function () {
            setIsProcessing(false);
            toast.info("Payment cancelled");
          },
        },
      });

      // F10: SDK is verified ready by waitForRazorpayReady(), safe to open immediately
      rzp.open();
    } catch (err) {
      console.error("[payment] Error:", err);
      toast.error(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.");
      setIsCreatingOrder(false);
      setIsProcessing(false);
    }
  }

  const isLoading = isCreatingOrder || isProcessing;

  return (
    <button
      type="button"
      onClick={handlePayment}
      disabled={disabled || isLoading}
      className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2"
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      {isCreatingOrder ? "Preparing..." : isProcessing ? "Processing..." : "Pay Now"}
    </button>
  );
}
