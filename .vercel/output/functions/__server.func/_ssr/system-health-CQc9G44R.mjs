import { o as __toESM } from "../_runtime.mjs";
import { t as supabase } from "./client-C_07D2FG.mjs";
import { i as require_react } from "../_libs/dnd-kit__accessibility+react.mjs";
import { i as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { B as CircleCheckBig, I as Database, T as LoaderCircle, V as CircleAlert, g as RefreshCw } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as AdminShell } from "./AdminShell-CsRAjfSE.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/system-health-CQc9G44R.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var INITIAL = [
	{
		label: "Database connection",
		status: "checking"
	},
	{
		label: "Response file storage",
		status: "checking"
	},
	{
		label: "Form asset storage",
		status: "checking"
	},
	{
		label: "Admin session",
		status: "checking"
	}
];
function SystemHealth() {
	const [checks, setChecks] = (0, import_react.useState)(INITIAL);
	const [running, setRunning] = (0, import_react.useState)(false);
	const [reconciling, setReconciling] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		runChecks();
	}, []);
	async function runChecks() {
		setRunning(true);
		setChecks(INITIAL.map((c) => ({
			...c,
			status: "checking"
		})));
		const results = await Promise.allSettled([
			supabase.from("forms").select("id").limit(1),
			supabase.storage.from("submission-files").list("", { limit: 1 }),
			supabase.storage.from("form-assets").list("", { limit: 1 }),
			supabase.auth.getUser()
		]);
		function ok(i) {
			const r = results[i];
			if (r.status !== "fulfilled") return false;
			return !r.value.error;
		}
		const sessionOk = results[3].status === "fulfilled" && !!results[3].value.data?.user;
		setChecks([
			{
				label: "Database connection",
				status: ok(0) ? "ok" : "error"
			},
			{
				label: "Response file storage",
				status: ok(1) ? "ok" : "error"
			},
			{
				label: "Form asset storage",
				status: ok(2) ? "ok" : "error"
			},
			{
				label: "Admin session",
				status: sessionOk ? "ok" : "error"
			}
		]);
		setRunning(false);
	}
	async function reconcileResponseCounts() {
		setReconciling(true);
		try {
			const { error } = await supabase.rpc("reconcile_response_counts");
			if (error) {
				toast.error(`Reconciliation failed: ${error.message}`);
				console.error("Reconcile error:", error);
			} else toast.success("Response counts reconciled successfully");
		} catch (err) {
			toast.error("Failed to reconcile response counts");
			console.error("Reconcile exception:", err);
		} finally {
			setReconciling(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "p-6 max-w-4xl",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between mb-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-2xl font-bold",
					children: "System Health & Tools"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "Monitor platform status and run maintenance tasks."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: runChecks,
					disabled: running,
					className: "flex items-center gap-2 px-3 py-2 rounded-md border border-border text-sm hover:bg-secondary transition-colors disabled:opacity-50",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: `h-4 w-4 ${running ? "animate-spin" : ""}` }), " Refresh"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "text-sm font-semibold mb-3 flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheckBig, { className: "h-4 w-4" }), "Health Checks"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "rounded-xl border border-border/60 bg-card divide-y divide-border/40",
					children: checks.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between px-5 py-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sm font-medium",
							children: c.label
						}), c.status === "checking" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin text-muted-foreground" }) : c.status === "ok" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sm font-semibold text-green-400",
							children: "OK"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sm font-semibold text-destructive",
							children: "ERROR"
						})]
					}, c.label))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
				className: "text-sm font-semibold mb-3 flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Database, { className: "h-4 w-4" }), "Maintenance Tools"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rounded-xl border border-border/60 bg-card divide-y divide-border/40",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "px-5 py-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-sm font-medium mb-1",
									children: "Reconcile Response Counts"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted-foreground mb-3",
									children: "Recalculates form.response_count from actual submission records. Run this if counts appear incorrect or after bulk deletions."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 text-xs text-muted-foreground",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { className: "h-3 w-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "May take 10-30 seconds for large datasets" })]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: reconcileResponseCounts,
							disabled: reconciling,
							className: "ml-4 flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 shrink-0",
							children: reconciling ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }), "Running..."] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Database, { className: "h-4 w-4" }), "Run Reconciliation"] })
						})]
					})
				})
			})] })
		]
	}) });
}
//#endregion
export { SystemHealth as component };
