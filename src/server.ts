type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// Content-Security-Policy + hardening headers applied to every response.
// script-src NEEDS 'unsafe-inline' WITHOUT any nonce: TanStack Start streams
// inline hydration <script> tags that we cannot stamp a nonce onto, and per
// the CSP spec the mere presence of a nonce makes browsers IGNORE
// 'unsafe-inline' — which blanks the whole app (verified: AwaitInner
// hydration crash). Do not re-add a nonce unless the framework renderer
// gains nonce support. Full analysis + revisit criteria: docs/security.md.
// In development we also allow 'unsafe-eval' + HMR websockets for Vite.
function buildSecurityHeaders(): Record<string, string> {
  const isDev = process.env.NODE_ENV === "development";

  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";

  const connectSrc = isDev
    ? "connect-src 'self' https://*.supabase.co wss://*.supabase.co ws://localhost:* ws://192.168.*:*"
    : "connect-src 'self' https://*.supabase.co wss://*.supabase.co";

  const CSP = [
    "default-src 'self'",
    scriptSrc,
    // Google Fonts stylesheet is served from fonts.googleapis.com
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    // Google Fonts files are served from fonts.gstatic.com
    "font-src 'self' data: https://fonts.gstatic.com",
    connectSrc,
    // Same-origin iframes are required for the admin form preview. Cross-site
    // embedding remains blocked by both CSP and X-Frame-Options below.
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");

  return {
    "Content-Security-Policy": CSP,
    "X-Frame-Options": "SAMEORIGIN",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  };
}

function withSecurityHeaders(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(buildSecurityHeaders())) headers.set(k, v);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

// GET /health — machine-readable liveness + DB reachability probe for uptime
// monitors. Uses the anon key (safe: RLS applies) to ping the REST endpoint.
async function healthCheck(): Promise<Response> {
  let db = false;
  try {
    const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (base && key) {
      const r = await fetch(`${base}/rest/v1/forms?select=id&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(5000),
      });
      db = r.ok;
    }
  } catch {
    db = false;
  }
  return new Response(
    JSON.stringify({ ok: true, db, ts: new Date().toISOString() }),
    {
      status: db ? 200 : 503,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    },
  );
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      if (new URL(request.url).pathname === "/health") {
        return withSecurityHeaders(await healthCheck());
      }
      const handler = await getServerEntry();
      const res = await handler.fetch(request, env, ctx);
      if (res.status >= 500) {
        try {
          const bodyText = await res.clone().text();
          console.error("[Server 500 Response]", {
            url: request.url,
            status: res.status,
            body: bodyText,
          });
        } catch {
          // ignore clone error
        }
      }
      return withSecurityHeaders(res);
    } catch (error) {
      console.error("[Server Exception Error]", {
        url: request.url,
        method: request.method,
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        } : String(error),
      });
      return withSecurityHeaders(new Response("Internal Server Error", { status: 500 }));
    }
  },
};
