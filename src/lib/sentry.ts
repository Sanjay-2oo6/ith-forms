/**
 * Sentry Configuration
 *
 * This module initializes error tracking for both frontend and backend.
 * Frontend: Captures JavaScript errors, network errors, React component errors
 * Backend: Captures server-side exceptions, database errors, RPC failures
 *
 * Setup:
 * 1. Create free account at https://sentry.io
 * 2. Create new project (select React for frontend)
 * 3. Copy DSN to VITE_SENTRY_DSN and SENTRY_DSN environment variables
 * 4. Deploy to production — errors will appear in Sentry dashboard
 *
 * No code changes needed — Sentry integration is automatic via this module
 */

/**
 * Initialize Sentry for browser (frontend)
 * Called from src/client.tsx
 */
export async function initSentryBrowser() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.debug("[Sentry] VITE_SENTRY_DSN not set — error tracking disabled");
    return;
  }

  try {
    const Sentry = await import("@sentry/react");

    // @ts-ignore - Sentry.init has dynamic config
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      integrations: [],
      // Performance monitoring: sample 10% of transactions
      tracesSampleRate: 0.1,
      // Ignore common noise
      ignoreErrors: [
        // Browser extensions and ads
        "top.GLOBALS",
        "chrome-extension://",
        "moz-extension://",
      ],
    });

    console.debug("[Sentry] Browser error tracking initialized");
  } catch (error) {
    console.error("[Sentry] Failed to initialize browser tracking", error);
  }
}

/**
 * Initialize Sentry for Node.js (backend)
 * Called from src/server.ts
 */
export async function initSentryServer() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.debug("[Sentry] SENTRY_DSN not set — error tracking disabled");
    return;
  }

  try {
    const Sentry = await import("@sentry/node");

    // @ts-ignore - Sentry.init has dynamic config
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || "production",
      // Sample 10% of transactions
      tracesSampleRate: 0.1,
      // Capture all unhandled exceptions
      attachStacktrace: true,
    });

    console.debug("[Sentry] Server error tracking initialized");

    // Return Sentry instance for manual error capture
    return Sentry;
  } catch (error) {
    console.error("[Sentry] Failed to initialize server tracking", error);
  }
}

/**
 * Helper: Capture structured error with context
 * Usage: captureError(error, { form_id: "123", user_email: "test@example.com" })
 */
export async function captureError(
  error: Error,
  context?: Record<string, any>
) {
  if (typeof window !== "undefined") {
    // Browser context
    try {
      const Sentry = await import("@sentry/react");
      if (context) {
        // @ts-ignore
        Sentry.captureException(error, { extra: context });
      } else {
        // @ts-ignore
        Sentry.captureException(error);
      }
    } catch (_) {
      console.error(error);
    }
  } else {
    // Server context
    try {
      const Sentry = await import("@sentry/node");
      if (context) {
        // @ts-ignore
        Sentry.captureException(error, { extra: context });
      } else {
        // @ts-ignore
        Sentry.captureException(error);
      }
    } catch (_) {
      console.error(error);
    }
  }
}

/**
 * Helper: Log message with severity level
 * Usage: captureMessage("Form submitted", "info", { form_id: "123" })
 */
export async function captureMessage(
  message: string,
  level: "fatal" | "error" | "warning" | "info" | "debug" = "info",
  context?: Record<string, any>
) {
  try {
    const Sentry = typeof window !== "undefined"
      ? await import("@sentry/react")
      : await import("@sentry/node");

    if (context) {
      // @ts-ignore
      Sentry.captureMessage(message, { level, extra: context });
    } else {
      // @ts-ignore
      Sentry.captureMessage(message, level);
    }
  } catch (_) {
    console.log(message);
  }
}
