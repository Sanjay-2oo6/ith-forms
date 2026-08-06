import { o as __toESM } from "../_runtime.mjs";
import { i as require_react } from "../_libs/dnd-kit__accessibility+react.mjs";
import { i as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { o as supabase } from "./ith-brand-DcxNWcJj.mjs";
import { T as LoaderCircle } from "../_libs/lucide-react.mjs";
import { t as AdminShell } from "./AdminShell-CDlfLDsd.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/profile-bhqikAP4.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Profile() {
	const [email, setEmail] = (0, import_react.useState)(null);
	const [displayName, setDisplayName] = (0, import_react.useState)(null);
	const [lastSignIn, setLastSignIn] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(true);
	(0, import_react.useEffect)(() => {
		(async () => {
			const { data } = await supabase.auth.getUser();
			const user = data.user;
			setEmail(user?.email ?? null);
			setLastSignIn(user?.last_sign_in_at ?? null);
			if (user) {
				const { data: admin } = await supabase.from("admin_users").select("display_name").eq("user_id", user.id).maybeSingle();
				const name = (admin?.display_name ?? "").trim();
				setDisplayName(name || null);
			}
			setLoading(false);
		})();
	}, []);
	const initials = (displayName || email || "A")[0].toUpperCase();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "p-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-2xl font-bold",
				children: "Profile"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: "Administrator account details."
			})]
		}), loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rounded-xl border border-border/60 bg-card p-6 max-w-md flex items-center gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-5 w-5 animate-spin text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-sm text-muted-foreground",
				children: "Loading profile…"
			})]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rounded-xl border border-border/60 bg-card p-6 max-w-md",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-4 mb-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0",
					children: initials
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "min-w-0",
					children: displayName ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-semibold truncate",
						children: displayName
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground truncate",
						children: email ?? "—"
					})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-semibold truncate",
						children: email ?? "—"
					})
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1.5 text-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted-foreground",
						children: "Role: "
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-semibold",
						children: "Administrator"
					})] }),
					lastSignIn && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted-foreground",
						children: "Last sign-in: "
					}), new Date(lastSignIn).toLocaleString()] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted-foreground",
						children: "Session: "
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-semibold text-green-400",
						children: "Active"
					})] })
				]
			})]
		})]
	}) });
}
//#endregion
export { Profile as component };
