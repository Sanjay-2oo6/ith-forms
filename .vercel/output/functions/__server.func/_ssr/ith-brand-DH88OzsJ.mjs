import { o as __toESM } from "../_runtime.mjs";
import { i as require_react } from "../_libs/dnd-kit__accessibility+react.mjs";
import { i as require_jsx_runtime, t as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { t as createClient } from "../_libs/supabase__supabase-js.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ith-brand-DH88OzsJ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
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
var DEFAULT_APP_SETTINGS = {
	app_name: "ITH-FORMS",
	org_name: "InnoTech-Hub",
	powered_by: "Powered by InnoTech-Hub",
	default_appearance: "dark",
	default_confirmation_message: "Your response has been submitted successfully."
};
async function fetchAppSettings() {
	if (typeof window === "undefined") return DEFAULT_APP_SETTINGS;
	try {
		const { data, error } = await supabase.from("app_settings").select("app_name,org_name,powered_by,default_appearance,default_confirmation_message").eq("id", 1).maybeSingle();
		if (error || !data) return DEFAULT_APP_SETTINGS;
		return {
			...DEFAULT_APP_SETTINGS,
			...data
		};
	} catch {
		return DEFAULT_APP_SETTINGS;
	}
}
function useAppSettings() {
	const { data } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchAppSettings,
		staleTime: 5 * 6e4
	});
	return data ?? DEFAULT_APP_SETTINGS;
}
var BRAND_NAME = DEFAULT_APP_SETTINGS.app_name;
var BRAND_POWERED = DEFAULT_APP_SETTINGS.powered_by;
function useBranding() {
	const settings = useAppSettings();
	return {
		appName: settings.app_name,
		orgName: settings.org_name,
		poweredBy: settings.powered_by
	};
}
var IthLogo = (0, import_react.memo)(function IthLogo({ size = 40, withWordmark = true }) {
	const { appName, poweredBy } = useBranding();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
			src: "/ith-logo.svg",
			alt: `${appName} logo`,
			style: {
				width: size,
				height: size
			},
			className: "shrink-0",
			onError: (e) => {
				e.currentTarget.style.display = "none";
			}
		}), withWordmark && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "leading-none",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-bold leading-none tracking-tight",
				children: appName
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[10px] opacity-60 mt-0.5",
				children: poweredBy
			})]
		})]
	});
});
//#endregion
export { fetchAppSettings as a, useAppSettings as c, IthLogo as i, useBranding as l, BRAND_POWERED as n, supabase as o, DEFAULT_APP_SETTINGS as r, supabaseConfigError as s, BRAND_NAME as t };
