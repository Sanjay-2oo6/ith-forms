import { i as require_jsx_runtime, n as QueryClientProvider } from "../_libs/react+tanstack__react-query.mjs";
import { t as QueryClient } from "../_libs/tanstack__query-core.mjs";
import { i as IthLogo, n as BRAND_POWERED, o as supabase, s as supabaseConfigError, t as BRAND_NAME } from "./ith-brand-Df5jtyU6.mjs";
import { _ as createRootRouteWithContext, c as HeadContent, g as createFileRoute, h as lazyRouteComponent, j as redirect, m as Outlet, p as createRouter, s as Scripts, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as Route$13 } from "../_referenceId-DrlmAU0p.mjs";
import { h as RotateCcw, i as TriangleAlert, p as SearchX } from "../_libs/lucide-react.mjs";
import { t as Route$14 } from "../_submissionId-C7aLzeCg.mjs";
import { t as Toaster } from "../_libs/sonner.mjs";
import { t as ConfirmProvider } from "./ConfirmDialog-CpF41tKV.mjs";
import { t as Route$15 } from "./edit-DXU5Z_Ba.mjs";
import { t as Route$16 } from "./responses-DrOzcyai.mjs";
import { t as Route$17 } from "./theme-CIM4s4dK.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-BqmCHLV2.js
var import_jsx_runtime = require_jsx_runtime();
/**
* Shown app-wide when required build-time configuration is missing (e.g. the
* Supabase env vars weren't present in the deployment's build). Renders
* instead of the app so misconfiguration is obvious and actionable rather
* than surfacing as a cryptic runtime crash on first Supabase use.
*
* Uses static branding constants (not the settings-driven hook) because that
* hook itself depends on Supabase, which is exactly what's unavailable here.
*/
function ConfigError({ message }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "min-h-screen grid place-items-center bg-background text-foreground px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-lg text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-destructive/10 border border-destructive/30",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "h-7 w-7 text-destructive" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-2xl font-bold mb-2",
					children: "Configuration required"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm text-muted-foreground mb-6",
					children: [BRAND_NAME, " can’t start because it’s missing required settings."]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-border/60 bg-card p-5 text-left space-y-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-medium text-destructive",
						children: message
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-xs text-muted-foreground space-y-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "To fix this on Netlify:" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
								className: "list-decimal list-inside space-y-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
										"Open ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-medium text-foreground",
											children: "Site settings → Environment variables"
										}),
										"."
									] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
										"Add ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
											className: "px-1 rounded bg-secondary",
											children: "VITE_SUPABASE_URL"
										}),
										" and",
										" ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
											className: "px-1 rounded bg-secondary",
											children: "VITE_SUPABASE_ANON_KEY"
										}),
										" ",
										"with the scope set to include ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-medium text-foreground",
											children: "Builds"
										}),
										"."
									] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
										"Trigger a redeploy with ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-medium text-foreground",
											children: "Clear cache and deploy site"
										}),
										"."
									] })
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "pt-1",
								children: "The values come from your Supabase project’s API settings. The anon key is public by design (row-level security governs access); never use the service-role key here."
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-6 text-[11px] text-muted-foreground",
					children: BRAND_POWERED
				})
			]
		})
	});
}
var Route$12 = createRootRouteWithContext()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: "ITH-FORMS — Powered by InnoTech-Hub" }
		],
		links: [
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,600&display=swap"
			}
		]
	}),
	shellComponent: RootShell,
	component: RootComponent
});
function RootShell({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		className: "dark",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", {
			className: "min-h-screen bg-background text-foreground antialiased",
			children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})]
		})]
	});
}
function RootComponent() {
	const { queryClient } = Route$12.useRouteContext();
	if (supabaseConfigError) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConfigError, { message: supabaseConfigError });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryClientProvider, {
		client: queryClient,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ConfirmProvider, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
			richColors: true,
			position: "top-right"
		})] })
	});
}
var $$splitComponentImporter$10 = () => import("./route-BdzdP89S.mjs");
var ADMIN_GUARD_CACHE_MS = 6e4;
var verifiedAdmin = null;
var Route$11 = createFileRoute("/_admin")({
	ssr: false,
	beforeLoad: async () => {
		const { data, error } = await supabase.auth.getUser();
		if (error || !data.user) {
			verifiedAdmin = null;
			await supabase.auth.signOut();
			throw redirect({ to: "/admin/login" });
		}
		if (verifiedAdmin?.user.id === data.user.id && verifiedAdmin.expiresAt > Date.now()) return { user: verifiedAdmin.user };
		const { data: admin } = await supabase.from("admin_users").select("id").eq("user_id", data.user.id).eq("is_active", true).maybeSingle();
		if (!admin) {
			verifiedAdmin = null;
			await supabase.auth.signOut();
			throw redirect({ to: "/admin/login" });
		}
		verifiedAdmin = {
			user: data.user,
			expiresAt: Date.now() + ADMIN_GUARD_CACHE_MS
		};
		return { user: data.user };
	},
	component: lazyRouteComponent($$splitComponentImporter$10, "component")
});
var Route$10 = createFileRoute("/")({ beforeLoad: () => {
	throw redirect({ to: "/admin/login" });
} });
var $$splitComponentImporter$9 = () => import("../_slug-X-JaF5zi.mjs");
var Route$9 = createFileRoute("/forms/$slug")({
	ssr: false,
	component: lazyRouteComponent($$splitComponentImporter$9, "component")
});
var $$splitComponentImporter$8 = () => import("./login-4D6mFkaW.mjs");
var Route$8 = createFileRoute("/admin/login")({
	ssr: false,
	component: lazyRouteComponent($$splitComponentImporter$8, "component")
});
var $$splitComponentImporter$7 = () => import("./system-health-B9JX23Ts.mjs");
var Route$7 = createFileRoute("/_admin/system-health")({
	ssr: false,
	component: lazyRouteComponent($$splitComponentImporter$7, "component")
});
var $$splitComponentImporter$6 = () => import("./settings-DvJfJiPz.mjs");
var Route$6 = createFileRoute("/_admin/settings")({
	ssr: false,
	component: lazyRouteComponent($$splitComponentImporter$6, "component")
});
var $$splitComponentImporter$5 = () => import("./profile-Df0F6T4b.mjs");
var Route$5 = createFileRoute("/_admin/profile")({
	ssr: false,
	component: lazyRouteComponent($$splitComponentImporter$5, "component")
});
var $$splitComponentImporter$4 = () => import("./files-FR6ExELG.mjs");
var Route$4 = createFileRoute("/_admin/files")({
	ssr: false,
	component: lazyRouteComponent($$splitComponentImporter$4, "component")
});
var $$splitComponentImporter$3 = () => import("./dashboard-c3OPJJ3b.mjs");
var Route$3 = createFileRoute("/_admin/dashboard")({
	ssr: false,
	component: lazyRouteComponent($$splitComponentImporter$3, "component")
});
var $$splitComponentImporter$2 = () => import("./audit-BGUczU__.mjs");
var Route$2 = createFileRoute("/_admin/audit")({
	ssr: false,
	component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
var $$splitComponentImporter$1 = () => import("./forms-DHhtEkPs.mjs");
var Route$1 = createFileRoute("/_admin/forms/")({
	ssr: false,
	component: lazyRouteComponent($$splitComponentImporter$1, "component")
});
var $$splitComponentImporter = () => import("./new-DLQ_hevu.mjs");
var Route = createFileRoute("/_admin/forms/new")({
	ssr: false,
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
var AdminRouteRoute = Route$11.update({
	id: "/_admin",
	getParentRoute: () => Route$12
});
var IndexRoute = Route$10.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$12
});
var ViewResponseReferenceIdRoute = Route$13.update({
	id: "/view-response/$referenceId",
	path: "/view-response/$referenceId",
	getParentRoute: () => Route$12
});
var FormsSlugRoute = Route$9.update({
	id: "/forms/$slug",
	path: "/forms/$slug",
	getParentRoute: () => Route$12
});
var AdminLoginRoute = Route$8.update({
	id: "/admin/login",
	path: "/admin/login",
	getParentRoute: () => Route$12
});
var AdminSystemHealthRoute = Route$7.update({
	id: "/system-health",
	path: "/system-health",
	getParentRoute: () => AdminRouteRoute
});
var AdminSettingsRoute = Route$6.update({
	id: "/settings",
	path: "/settings",
	getParentRoute: () => AdminRouteRoute
});
var AdminProfileRoute = Route$5.update({
	id: "/profile",
	path: "/profile",
	getParentRoute: () => AdminRouteRoute
});
var AdminFilesRoute = Route$4.update({
	id: "/files",
	path: "/files",
	getParentRoute: () => AdminRouteRoute
});
var AdminDashboardRoute = Route$3.update({
	id: "/dashboard",
	path: "/dashboard",
	getParentRoute: () => AdminRouteRoute
});
var AdminAuditRoute = Route$2.update({
	id: "/audit",
	path: "/audit",
	getParentRoute: () => AdminRouteRoute
});
var AdminFormsIndexRoute = Route$1.update({
	id: "/forms/",
	path: "/forms/",
	getParentRoute: () => AdminRouteRoute
});
var AdminFormsNewRoute = Route.update({
	id: "/forms/new",
	path: "/forms/new",
	getParentRoute: () => AdminRouteRoute
});
var AdminFormsFormIdThemeRoute = Route$17.update({
	id: "/forms/$formId/theme",
	path: "/forms/$formId/theme",
	getParentRoute: () => AdminRouteRoute
});
var AdminFormsFormIdEditRoute = Route$15.update({
	id: "/forms/$formId/edit",
	path: "/forms/$formId/edit",
	getParentRoute: () => AdminRouteRoute
});
var AdminFormsFormIdResponsesIndexRoute = Route$16.update({
	id: "/forms/$formId/responses/",
	path: "/forms/$formId/responses/",
	getParentRoute: () => AdminRouteRoute
});
var AdminRouteRouteChildren = {
	AdminAuditRoute,
	AdminDashboardRoute,
	AdminFilesRoute,
	AdminProfileRoute,
	AdminSettingsRoute,
	AdminSystemHealthRoute,
	AdminFormsNewRoute,
	AdminFormsIndexRoute,
	AdminFormsFormIdEditRoute,
	AdminFormsFormIdThemeRoute,
	AdminFormsFormIdResponsesSubmissionIdRoute: Route$14.update({
		id: "/forms/$formId/responses/$submissionId",
		path: "/forms/$formId/responses/$submissionId",
		getParentRoute: () => AdminRouteRoute
	}),
	AdminFormsFormIdResponsesIndexRoute
};
var rootRouteChildren = {
	IndexRoute,
	AdminRouteRoute: AdminRouteRoute._addFileChildren(AdminRouteRouteChildren),
	AdminLoginRoute,
	FormsSlugRoute,
	ViewResponseReferenceIdRoute
};
var routeTree = Route$12._addFileChildren(rootRouteChildren)._addFileTypes();
function StateShell({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "min-h-screen grid place-items-center bg-background px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-md text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-6 flex justify-center",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IthLogo, { size: 48 })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "rounded-2xl border border-border/60 bg-card p-8",
					children
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-6 text-[11px] text-muted-foreground",
					children: BRAND_POWERED
				})
			]
		})
	});
}
function AppErrorFallback({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(StateShell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "h-8 w-8 text-destructive mx-auto mb-3" }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "text-lg font-bold mb-1",
			children: "Something went wrong"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted-foreground mb-4",
			children: "An unexpected error occurred. Reloading usually fixes it — if it keeps happening, contact the administrator."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-[11px] font-mono text-muted-foreground/70 mb-5 break-all",
			children: error?.message ?? "Unknown error"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			onClick: () => window.location.reload(),
			className: "inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "h-4 w-4" }), " Reload page"]
		})
	] });
}
function NotFoundPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(StateShell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SearchX, { className: "h-8 w-8 text-muted-foreground mx-auto mb-3" }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "text-lg font-bold mb-1",
			children: "Page not found"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted-foreground mb-5",
			children: "The page you're looking for doesn't exist or has moved."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/",
			className: "inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90",
			children: "Go to home"
		})
	] });
}
var serverQueryClient;
var getRouter = () => {
	return createRouter({
		routeTree,
		context: { queryClient: typeof window === "undefined" ? serverQueryClient ??= new QueryClient({ defaultOptions: { queries: {
			staleTime: 6e4,
			gcTime: 3e5
		} } }) : new QueryClient({ defaultOptions: { queries: {
			staleTime: 3e4,
			gcTime: 3e5
		} } }) },
		scrollRestoration: true,
		defaultPreloadStaleTime: 0,
		defaultErrorComponent: AppErrorFallback,
		defaultNotFoundComponent: NotFoundPage
	});
};
//#endregion
export { getRouter };
