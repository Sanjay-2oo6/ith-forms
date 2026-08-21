import { o as __toESM } from "../_runtime.mjs";
import { i as require_react } from "../_libs/dnd-kit__accessibility+react.mjs";
import { i as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { o as supabase } from "./ith-brand-DH88OzsJ.mjs";
import { T as LoaderCircle, g as RefreshCw } from "../_libs/lucide-react.mjs";
import { t as AdminShell } from "./AdminShell-B_d5Ah0c.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/audit-Bq08WdED.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var AUDIT_ACTION_LABELS = {
	"admin.login": "Admin signed in",
	"admin.logout": "Admin signed out",
	"form.created": "Form created",
	"form.published": "Form published",
	"form.unpublished": "Form unpublished",
	"form.deleted": "Form deleted",
	"form.restored": "Form restored",
	"form.updated": "Form updated",
	"theme.updated": "Theme updated",
	"submission.status_changed": "Submission status changed",
	"submission.exported": "Responses exported"
};
function auditActionLabel(action) {
	return AUDIT_ACTION_LABELS[action] ?? action.replace(/[._]/g, " ");
}
function AuditLog() {
	const [logs, setLogs] = (0, import_react.useState)([]);
	const [entityNames, setEntityNames] = (0, import_react.useState)({});
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [page, setPage] = (0, import_react.useState)(0);
	const [search, setSearch] = (0, import_react.useState)("");
	const [debouncedSearch, setDebouncedSearch] = (0, import_react.useState)("");
	const [actionFilter, setActionFilter] = (0, import_react.useState)("all");
	const PAGE_SIZE = 50;
	(0, import_react.useEffect)(() => {
		const t = setTimeout(() => setDebouncedSearch(search), 300);
		return () => clearTimeout(t);
	}, [search]);
	(0, import_react.useEffect)(() => {
		setPage(0);
	}, [debouncedSearch, actionFilter]);
	(0, import_react.useEffect)(() => {
		load();
	}, [
		page,
		debouncedSearch,
		actionFilter
	]);
	async function load() {
		setLoading(true);
		let q = supabase.from("audit_logs").select("id,action,entity,entity_id,actor_email,created_at").order("created_at", { ascending: false });
		if (actionFilter !== "all") q = q.ilike("action", `${actionFilter}%`);
		if (debouncedSearch.trim()) {
			const term = `%${debouncedSearch.trim()}%`;
			q = q.or(`action.ilike.${term},actor_email.ilike.${term},entity.ilike.${term}`);
		}
		const { data } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
		const rows = data ?? [];
		setLogs(rows);
		setLoading(false);
		resolveEntityNames(rows);
	}
	const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	async function resolveEntityNames(rows) {
		const formIds = [...new Set(rows.filter((r) => r.entity === "form" && r.entity_id && UUID_RE.test(r.entity_id)).map((r) => r.entity_id))];
		const subIds = [...new Set(rows.filter((r) => r.entity === "submission" && r.entity_id && UUID_RE.test(r.entity_id)).map((r) => r.entity_id))];
		const [formsRes, subsRes] = await Promise.all([formIds.length ? supabase.from("forms").select("id,title").in("id", formIds) : Promise.resolve({ data: [] }), subIds.length ? supabase.from("submissions").select("id,reference_id").in("id", subIds) : Promise.resolve({ data: [] })]);
		const names = {};
		for (const f of formsRes.data ?? []) names[f.id] = f.title;
		for (const s of subsRes.data ?? []) names[s.id] = s.reference_id;
		setEntityNames(names);
	}
	function entityDisplay(log) {
		if (!log.entity) return "—";
		if (log.entity_id && entityNames[log.entity_id]) return `${log.entity} · ${entityNames[log.entity_id]}`;
		return log.entity_id ? `${log.entity} · ${log.entity_id.slice(0, 8)}` : log.entity;
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between mb-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-2xl font-bold",
					children: "Audit log"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "Every administrator action is recorded for accountability."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: load,
					disabled: loading,
					className: "flex items-center gap-2 px-3 py-2 rounded-md border border-border text-sm hover:bg-secondary transition-colors disabled:opacity-50",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: `h-4 w-4 ${loading ? "animate-spin" : ""}` }), " Refresh"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex gap-3 mb-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					value: search,
					onChange: (e) => setSearch(e.target.value),
					placeholder: "Search action, actor, entity…",
					className: "flex-1 h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
					value: actionFilter,
					onChange: (e) => setActionFilter(e.target.value),
					className: "h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "all",
							children: "All actions"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "admin.",
							children: "Auth"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "form.",
							children: "Forms"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "submission.",
							children: "Submissions"
						})
					]
				})]
			}),
			loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex justify-center py-12",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "animate-spin text-muted-foreground" })
			}) : logs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rounded-xl border border-border/60 bg-card p-12 text-center text-muted-foreground text-sm",
				children: "No audit log entries match your filters."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl border border-border/60 bg-card overflow-hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-b border-border/60 bg-secondary/30",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground",
								children: "WHEN"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground",
								children: "ACTOR"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground",
								children: "ACTION"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground",
								children: "ENTITY"
							})
						]
					}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: logs.map((log, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: `border-b border-border/30 ${i % 2 === 0 ? "" : "bg-secondary/10"}`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap",
								children: new Date(log.created_at).toLocaleString()
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-2.5 text-xs",
								children: log.actor_email ?? "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-2.5 text-xs font-semibold",
								title: log.action,
								children: auditActionLabel(log.action)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-2.5 text-xs text-muted-foreground",
								children: entityDisplay(log)
							})
						]
					}, log.id)) })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between px-4 py-3 border-t border-border/60",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setPage((p) => Math.max(0, p - 1)),
							disabled: page === 0,
							className: "px-3 py-1 rounded text-sm border border-border hover:bg-secondary disabled:opacity-40",
							children: "← Prev"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-xs text-muted-foreground",
							children: ["Page ", page + 1]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setPage((p) => p + 1),
							disabled: logs.length < PAGE_SIZE,
							className: "px-3 py-1 rounded text-sm border border-border hover:bg-secondary disabled:opacity-40",
							children: "Next →"
						})
					]
				})]
			})
		]
	}) });
}
//#endregion
export { AuditLog as component };
