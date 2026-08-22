import { o as __toESM } from "../_runtime.mjs";
import { t as supabase } from "./client-C_07D2FG.mjs";
import { i as require_react } from "../_libs/dnd-kit__accessibility+react.mjs";
import { i as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { b as useSearch, y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/callback-B5CpB3B1.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function AuthCallback() {
	const navigate = useNavigate();
	const search = useSearch({ strict: false });
	const slug = search.slug || search.redirectTo?.split("/forms/")[1] || "";
	(0, import_react.useEffect)(() => {
		handleCallback();
	}, []);
	async function handleCallback() {
		try {
			console.log("[auth/callback] Starting OAuth callback handler");
			const { data, error } = await supabase.auth.getSession();
			if (error) {
				console.error("[auth/callback] Session error:", error);
				redirectToForm();
				return;
			}
			if (!data?.session?.user) {
				console.warn("[auth/callback] No user session found after callback");
				redirectToForm();
				return;
			}
			const user = data.session.user;
			const email = user.email;
			const name = user.user_metadata?.full_name || user.user_metadata?.name || "User";
			if (!email) {
				console.error("[auth/callback] No email in user metadata");
				redirectToForm();
				return;
			}
			console.log("[auth/callback] User authenticated:", {
				email,
				name,
				userId: user.id
			});
			const authState = {
				email,
				name,
				verified: true,
				userId: user.id,
				provider: "google",
				timestamp: Date.now()
			};
			sessionStorage.setItem("ith_forms_auth", JSON.stringify(authState));
			console.log("[auth/callback] Auth state stored in sessionStorage");
			redirectToForm();
		} catch (error) {
			console.error("[auth/callback] Unexpected error:", error);
			redirectToForm();
		}
	}
	function redirectToForm() {
		if (slug && slug.trim()) {
			console.log("[auth/callback] Redirecting to form:", slug);
			navigate({ to: `/forms/${slug}` });
		} else {
			console.log("[auth/callback] No slug found, redirecting to home");
			navigate({ to: "/" });
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex items-center justify-center min-h-screen bg-background",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-4 flex justify-center",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-12 w-12 animate-spin rounded-full border-4 border-border border-t-primary" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-lg font-semibold text-foreground mb-2",
					children: "Signing you in..."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "Please wait while we process your authentication."
				})
			]
		})
	});
}
//#endregion
export { AuthCallback as component };
