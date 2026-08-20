import { createClient } from "@supabase/supabase-js";

// Values are inlined at BUILD time from VITE_-prefixed env vars (local .env
// or the CI/host build environment, e.g. Netlify dashboard variables scoped
// to "Builds"). If the build runs without them, these are empty strings and
// supabase-js throws a cryptic "supabaseUrl is required" on first use — so we
// detect that here and surface a clear, actionable message instead.
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

const missingEnv: string[] = [
  ...(SUPABASE_URL ? [] : ["VITE_SUPABASE_URL"]),
  ...(SUPABASE_ANON_KEY ? [] : ["VITE_SUPABASE_ANON_KEY"]),
];

/** True when both required Supabase env vars were present at build time. */
export const isSupabaseConfigured = missingEnv.length === 0;

// Debug logging (remove after fixing)
if (typeof window !== "undefined") {
  console.log("[Supabase Config]", {
    configured: isSupabaseConfigured,
    urlLength: SUPABASE_URL.length,
    keyLength: SUPABASE_ANON_KEY.length,
    missing: missingEnv,
  });
}

/** Human-readable configuration error, or null when correctly configured. */
export const supabaseConfigError: string | null = isSupabaseConfigured
  ? null
  : `Missing required environment variable${missingEnv.length > 1 ? "s" : ""}: ${missingEnv.join(", ")}. ` +
    `These must be set in the deployment's build environment (e.g. Vercel Settings → Environment Variables), ` +
    `then redeploy with a cleared cache.`;

function createSupabaseClient() {
  if (!isSupabaseConfigured) {
    // Fail with an actionable message rather than supabase-js's opaque
    // "supabaseUrl is required". The app-level guard (see __root.tsx) renders
    // a friendly screen before any code reaches this point in normal use.
    throw new Error(`[ITH-FORMS configuration] ${supabaseConfigError}`);
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: typeof window !== "undefined",
      autoRefreshToken: typeof window !== "undefined",
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;
let _supabaseError: Error | null = null;

// Lazy proxy — client is only instantiated on first use (never during SSR module eval)
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    // On server-side: never initialize
    if (typeof window === "undefined") {
      return undefined;
    }
    
    if (_supabaseError) {
      throw _supabaseError;
    }
    if (!_supabase) {
      try {
        _supabase = createSupabaseClient();
      } catch (err) {
        _supabaseError = err instanceof Error ? err : new Error(String(err));
        throw _supabaseError;
      }
    }
    return Reflect.get(_supabase, prop, receiver);
  },
});
