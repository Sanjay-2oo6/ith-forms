import { t as createClient } from "../_libs/supabase__supabase-js.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/client-C_07D2FG.js
var SUPABASE_URL = "https://zkaeourngxwykkhapotj.supabase.co".trim();
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprYWVvdXJuZ3h3eWtraGFwb3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNjg4MDEsImV4cCI6MjEwMDc0NDgwMX0.73H3JRqvojytktdNdI1T7w13Pg7f5mcEClNw8daQnCs".trim();
var missingEnv = [...[], ...[]];
/** True when both required Supabase env vars were present at build time. */
var isSupabaseConfigured = missingEnv.length === 0;
if (typeof window !== "undefined") console.log("[Supabase Config]", {
	configured: isSupabaseConfigured,
	urlLength: 40,
	keyLength: 208,
	missing: missingEnv
});
/** Human-readable configuration error, or null when correctly configured. */
var supabaseConfigError = isSupabaseConfigured ? null : `Missing required environment variable${missingEnv.length > 1 ? "s" : ""}: ${missingEnv.join(", ")}. These must be set in the deployment's build environment (e.g. Vercel Settings → Environment Variables), then redeploy with a cleared cache.`;
function createSupabaseClient() {
	if (!isSupabaseConfigured) throw new Error(`[ITH-FORMS configuration] ${supabaseConfigError}`);
	return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: {
		storage: typeof window !== "undefined" ? localStorage : void 0,
		persistSession: typeof window !== "undefined",
		autoRefreshToken: typeof window !== "undefined"
	} });
}
var _supabase;
var _supabaseError = null;
var supabase = new Proxy({}, { get(_, prop, receiver) {
	if (typeof window === "undefined") return;
	if (_supabaseError) throw _supabaseError;
	if (!_supabase) try {
		_supabase = createSupabaseClient();
	} catch (err) {
		_supabaseError = err instanceof Error ? err : new Error(String(err));
		throw _supabaseError;
	}
	return Reflect.get(_supabase, prop, receiver);
} });
//#endregion
export { supabaseConfigError as n, supabase as t };
