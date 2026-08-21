import { o as __toESM } from "../_runtime.mjs";
import { i as require_react } from "../_libs/dnd-kit__accessibility+react.mjs";
import { i as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { c as useAppSettings, i as IthLogo, o as supabase } from "./ith-brand-DH88OzsJ.mjs";
import { u as useRouterState, v as Link, y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { A as FileText, E as LayoutDashboard, J as Activity, b as Moon, d as Settings, k as Folder, l as Shield, n as User, o as Sun, w as LogOut } from "../_libs/lucide-react.mjs";
import { t as useTheme } from "./use-theme-eySlBD0O.mjs";
import { n as toast } from "../_libs/sonner.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/AdminShell-B_d5Ah0c.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/** Shared admin logout with audit logging. */
async function adminLogout() {
	const { data: { user } } = await supabase.auth.getUser();
	if (user) await supabase.from("audit_logs").insert({
		action: "admin.logout",
		entity: "auth",
		entity_id: user.id,
		metadata: { email: user.email }
	});
	await supabase.auth.signOut();
	toast.success("Signed out");
}
var NAV = [
	{
		to: "/dashboard",
		label: "Dashboard",
		icon: LayoutDashboard
	},
	{
		to: "/forms",
		label: "Forms",
		icon: FileText
	},
	{
		to: "/files",
		label: "Files",
		icon: Folder
	},
	{
		to: "/audit",
		label: "Audit log",
		icon: Shield
	},
	{
		to: "/system-health",
		label: "System health",
		icon: Activity
	},
	{
		to: "/profile",
		label: "Profile",
		icon: User
	},
	{
		to: "/settings",
		label: "Settings",
		icon: Settings
	}
];
var ShellContext = (0, import_react.createContext)(false);
function AdminShell({ children }) {
	if ((0, import_react.useContext)(ShellContext)) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShellChrome, { children });
}
function ShellChrome({ children }) {
	const navigate = useNavigate();
	const { location } = useRouterState();
	const [email, setEmail] = (0, import_react.useState)(null);
	const { theme, toggle: toggleTheme } = useTheme(useAppSettings().default_appearance);
	(0, import_react.useEffect)(() => {
		supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
		const { data: sub } = supabase.auth.onAuthStateChange((event) => {
			if (event === "SIGNED_OUT") navigate({ to: "/admin/login" });
		});
		return () => sub.subscription.unsubscribe();
	}, [navigate]);
	async function handleLogout() {
		await adminLogout();
		navigate({ to: "/admin/login" });
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShellContext.Provider, {
		value: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "min-h-screen flex bg-sidebar",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "w-56 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "p-5 border-b border-sidebar-border",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IthLogo, { size: 36 })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
						className: "flex-1 p-3 space-y-1 overflow-y-auto",
						children: NAV.map(({ to, label, icon: Icon }) => {
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to,
								className: `flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-medium transition-colors ${location.pathname === to || location.pathname.startsWith(to + "/") ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "h-4 w-4 shrink-0" }), label]
							}, to);
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "p-3 border-t border-sidebar-border space-y-1",
						children: [
							email && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "px-3 py-1 text-xs text-sidebar-foreground/50 truncate",
								children: email
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: toggleTheme,
								className: "flex items-center gap-3 w-full px-3 py-2.5 rounded-full text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground transition-colors",
								title: `Switch to ${theme === "dark" ? "light" : "dark"} mode`,
								children: [theme === "dark" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sun, { className: "h-4 w-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Moon, { className: "h-4 w-4" }), theme === "dark" ? "Light mode" : "Dark mode"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: handleLogout,
								className: "flex items-center gap-3 w-full px-3 py-2.5 rounded-full text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground transition-colors",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, { className: "h-4 w-4" }), "Sign out"]
							})
						]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
				className: "flex-1 overflow-auto bg-background text-foreground md:my-2 md:mr-2 md:rounded-2xl md:border md:border-border/60",
				children
			})]
		})
	});
}
//#endregion
export { AdminShell as t };
