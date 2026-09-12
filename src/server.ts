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
    // Try OAuth proxy first
    const oauthResponse = await handleOAuthProxy(request);
    if (oauthResponse) return oauthResponse;
    
    // Fall back to normal app routing
    const handler = await getServerEntry();
    return handler.fetch(request, env, ctx);
  },
};
