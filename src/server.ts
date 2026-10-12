import { initSentryServer } from "./lib/sentry";

// Initialize server-side error tracking
await initSentryServer();

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry
    );
  }
  return serverEntryPromise;
}

/**
 * Create Razorpay order via POST /api/razorpay/create-order
 */
async function handleRazorpayCreateOrder(request: Request): Promise<Response | null> {
  if (!request.url.includes("/api/razorpay/create-order")) return null;
  if (request.method !== "POST") return null;

  console.log("[payment] Received order creation request");

  try {
    const body = await request.json() as Record<string, unknown>;
    console.log("[payment] Request body:", body);

    // Validate
    const amount = body.amount as number;
    const currency = body.currency as string;
    const formId = body.formId as string;
    const questionId = body.questionId as string;
    const userEmail = body.userEmail as string | undefined;

    if (!amount || amount < 100) {
      return Response.json(
        { message: "Invalid amount. Minimum is 100 paise (₹1)." },
        { status: 400 }
      );
    }

    if (!currency || !formId || !questionId) {
      return Response.json(
        { message: "Missing required fields: currency, formId, questionId" },
        { status: 400 }
      );
    }

    // Get credentials from environment
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error("[payment] Razorpay credentials not configured");
      return Response.json(
        { message: "Payment system not configured" },
        { status: 500 }
      );
    }

    // Create order on Razorpay API
    // Receipt must be <= 56 chars, so use a hash instead of full IDs + timestamp
    const receipt = `${Date.now().toString(36).slice(-6)}`;
    const orderPayload = {
      amount: amount,
      currency: currency,
      receipt: receipt,
      notes: {
        form_id: formId,
        question_id: questionId,
        user_email: userEmail || "unknown",
      },
    };

    // Basic auth header
    const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString(
      "base64"
    );

    const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(orderPayload),
    });

    if (!orderResponse.ok) {
      const errorData = await orderResponse.json() as Record<string, unknown>;
      console.error("[payment] Razorpay API error:", errorData);
      return Response.json(
        { 
          message: `Order creation failed: ${
            (errorData.error as Record<string, string>)?.description || "Unknown error"
          }` 
        },
        { status: 400 }
      );
    }

    const orderData = await orderResponse.json() as Record<string, unknown>;

    // Return order details
    return Response.json({
      orderId: orderData.id,
      amount: orderData.amount,
      currency: orderData.currency,
    });
  } catch (err) {
    console.error("[payment] Error creating order:", err);
    return Response.json(
      { message: "Failed to create payment order" },
      { status: 500 }
    );
  }
}

/**
 * OAuth Redirect Proxy: Hide Supabase URL from Google OAuth consent screen
 * 
 * When Google redirects back after OAuth approval, it includes query params.
 * We intercept certain OAuth provider callbacks and proxy them through our
 * custom domain to avoid exposing the Supabase project URL to users.
 */
async function handleOAuthProxy(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  
  // Check if this is a Supabase auth callback (from Google OAuth)
  if (url.pathname === "/auth/v1/callback") {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
    if (!supabaseUrl) return null;
    
    try {
      // Forward to Supabase's callback endpoint
      const proxiedUrl = new URL(url.href);
      proxiedUrl.hostname = new URL(supabaseUrl).hostname;
      proxiedUrl.protocol = new URL(supabaseUrl).protocol;
      
      const proxiedRequest = new Request(proxiedUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
      
      const response = await fetch(proxiedRequest);
      
      // Supabase redirects to our app with the session. Re-route back through
      // our custom domain if needed. The Location header will already have it
      // set correctly since Supabase uses the Site URL we configured.
      return response;
    } catch (error) {
      console.error("[OAuth Proxy] Error proxying to Supabase:", error);
      return null;
    }
  }
  
  return null;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    // Try Razorpay order creation first
    const razorpayResponse = await handleRazorpayCreateOrder(request);
    if (razorpayResponse) return razorpayResponse;

    // Try OAuth proxy
    const oauthResponse = await handleOAuthProxy(request);
    if (oauthResponse) return oauthResponse;
    
    // Fall back to normal app routing
    const handler = await getServerEntry();
    return handler.fetch(request, env, ctx);
  },
};
