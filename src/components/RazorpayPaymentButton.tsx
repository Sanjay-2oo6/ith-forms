import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

// Razorpay SDK types
declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
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
    // Validate Razorpay SDK loaded
    if (!window.Razorpay) {
      toast.error("Payment system not loaded. Please refresh the page.");
      return;
    }

    // Validate environment configuration
    const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
    if (!razorpayKeyId) {
      toast.error("Payment system not configured. Please contact the administrator.");
      console.error("[payment] VITE_RAZORPAY_KEY_ID not set");
      return;
    }

    // Validate amount
    if (!amount || amount < 100) {
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
          amount: amount, // Amount in paise
          currency: currency,
          formId: formId,
          questionId: questionId,
          userEmail: userEmail,
        }),
      });

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        console.error("[payment] Order creation failed:", errorData);
        throw new Error(`Order creation failed: ${errorData?.message || "Unknown error"}`);
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
          // Payment successful - now verify and record on backend
          console.log("[payment] Payment successful:", response.razorpay_payment_id);
          
          try {
            // Record payment transaction with signature verification
            const { data: recordData, error: recordError } = await supabase.rpc(
              "record_payment_transaction",
              {
                p_submission_id: formId, // Use form ID as temporary identifier
                p_question_id: questionId,
                p_razorpay_order_id: response.razorpay_order_id,
                p_razorpay_payment_id: response.razorpay_payment_id,
                p_razorpay_signature: response.razorpay_signature,
                p_amount: amount,
                p_currency: currency,
                p_status: "captured",
              }
            );

            if (recordError) {
              console.error("[payment] Recording failed:", recordError);
              // Even if recording fails, payment was successful
              // User can retry or contact support
              toast.warning("Payment received but verification delayed. Your payment will be processed shortly.");
            } else if (recordData?.ok) {
              console.log("[payment] Transaction recorded:", recordData);
              toast.success("Payment completed and verified!");
            } else {
              console.error("[payment] Verification failed:", recordData?.error);
              toast.warning("Payment received but verification failed. Please contact support.");
            }
          } catch (err) {
            console.error("[payment] Error recording transaction:", err);
            toast.warning("Payment received but recording failed. Please contact support if needed.");
          }

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
