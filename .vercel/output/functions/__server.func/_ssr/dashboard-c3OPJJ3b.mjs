import { o as __toESM } from "../_runtime.mjs";
import { i as require_react } from "../_libs/dnd-kit__accessibility+react.mjs";
import { i as require_jsx_runtime, t as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { o as supabase } from "./ith-brand-Df5jtyU6.mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { B as CircleAlert, W as Calendar, _ as Plus, g as RefreshCw } from "../_libs/lucide-react.mjs";
import { t as AdminShell } from "./AdminShell-B0BieESN.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/dashboard-c3OPJJ3b.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function trendDayLabel(date) {
	return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function buildTrendSeries(days, counts) {
	const series = [];
	const today = /* @__PURE__ */ new Date();
	today.setHours(0, 0, 0, 0);
	for (let i = days - 1; i >= 0; i--) {
		const d = new Date(today);
		d.setDate(today.getDate() - i);
		const label = trendDayLabel(d);
		series.push({
			day: label,
			count: counts.get(label) ?? 0
		});
	}
	return series;
}
function normalizeTrendRows(rows) {
	return rows.map((row) => ({
		day: String(row.day_label ?? row.day ?? ""),
		count: Number(row.count ?? 0)
	}));
}
async function fetchDailyTrend(trendDays) {
	const days = Math.max(1, Math.min(trendDays, 90));
	const modern = await supabase.rpc("get_daily_submission_trend", { p_days: days });
	if (!modern.error && modern.data) {
		const points = normalizeTrendRows(modern.data);
		if (points.length > 0) return points;
	}
	const start = /* @__PURE__ */ new Date();
	start.setHours(0, 0, 0, 0);
	start.setDate(start.getDate() - (days - 1));
	const legacy = await supabase.rpc("get_daily_submission_trend", { p_start_date: start.toISOString() });
	if (!legacy.error && legacy.data) {
		const counts = /* @__PURE__ */ new Map();
		for (const row of legacy.data) {
			const rawDay = String(row.day ?? row.day_label ?? "");
			const parsed = rawDay.includes("/") ? rawDay : trendDayLabel(/* @__PURE__ */ new Date(`${rawDay}T00:00:00`));
			counts.set(parsed, Number(row.count ?? 0));
		}
		return buildTrendSeries(days, counts);
	}
	const formsRes = await supabase.from("forms").select("id").is("deleted_at", null);
	if (formsRes.error) throw new Error(formsRes.error.message);
	const liveIds = (formsRes.data ?? []).map((f) => f.id);
	if (liveIds.length === 0) return buildTrendSeries(days, /* @__PURE__ */ new Map());
	const subsRes = await supabase.from("submissions").select("submitted_at").in("form_id", liveIds).gte("submitted_at", start.toISOString());
	if (subsRes.error) throw new Error(subsRes.error.message);
	const counts = /* @__PURE__ */ new Map();
	for (const row of subsRes.data ?? []) {
		const label = trendDayLabel(new Date(row.submitted_at));
		counts.set(label, (counts.get(label) ?? 0) + 1);
	}
	return buildTrendSeries(days, counts);
}
async function fetchDashboardStats(period) {
	const pDays = period === "all" ? 0 : period;
	const statsRes = await supabase.rpc("get_dashboard_stats", { p_days: pDays });
	if (!statsRes.error && statsRes.data) return statsRes.data;
	const legacyDays = period === "all" ? 36500 : period;
	const legacyRes = await supabase.rpc("get_dashboard_stats", { p_days: legacyDays });
	if (legacyRes.error) throw new Error(legacyRes.error.message);
	return legacyRes.data;
}
async function fetchDashboard(period) {
	const trendDays = period === 7 ? 7 : 30;
	const formsRes = await supabase.from("forms").select("id").is("deleted_at", null);
	if (formsRes.error) throw new Error(formsRes.error.message);
	const liveIds = (formsRes.data ?? []).map((f) => f.id);
	const [stats, trend, recentRes] = await Promise.all([
		fetchDashboardStats(period),
		fetchDailyTrend(trendDays),
		liveIds.length > 0 ? supabase.from("submissions").select("id,reference_id,respondent_name,submitted_at,form_id").in("form_id", liveIds).order("submitted_at", { ascending: false }).limit(8) : Promise.resolve({
			data: [],
			error: null
		})
	]);
	return {
		stats,
		recent: recentRes.data ?? [],
		trend
	};
}
function Dashboard() {
	const [period, setPeriod] = (0, import_react.useState)("all");
	const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
		queryKey: ["dashboard", period],
		queryFn: () => fetchDashboard(period),
		staleTime: 3e4
	});
	const stats = data?.stats ?? null;
	const recent = data?.recent ?? [];
	const trend = data?.trend ?? [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "p-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between mb-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-2xl font-bold",
				children: "Dashboard"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: "Live overview of ITH-FORMS activity."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 px-2 py-1 rounded-lg border border-border bg-card",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Calendar, { className: "h-4 w-4 text-muted-foreground" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setPeriod("all"),
								className: `px-3 py-1 rounded text-xs font-medium transition-colors ${period === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`,
								children: "All"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setPeriod(7),
								className: `px-3 py-1 rounded text-xs font-medium transition-colors ${period === 7 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`,
								children: "Last Week"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setPeriod(30),
								className: `px-3 py-1 rounded text-xs font-medium transition-colors ${period === 30 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`,
								children: "Last Month"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => refetch(),
						disabled: isFetching,
						className: "flex items-center gap-2 px-3 py-2 rounded-md border border-border text-sm hover:bg-secondary transition-colors disabled:opacity-50",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: `h-4 w-4 ${isFetching ? "animate-spin" : ""}` }), " Refresh"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/forms/new",
						className: "flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "h-4 w-4" }), " New form"]
					})
				]
			})]
		}), isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid grid-cols-2 lg:grid-cols-4 gap-4",
			children: [...Array(8)].map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "rounded-xl border border-border/60 bg-card p-5 h-24 animate-pulse" }, i))
		}) : isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center animate-fade-up",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { className: "h-6 w-6 text-destructive mx-auto mb-2" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm font-medium mb-1",
					children: "Couldn't load dashboard data"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground mb-4",
					children: error?.message
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => refetch(),
					className: "px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90",
					children: "Try again"
				})
			]
		}) : stats ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: "TOTAL FORMS",
						value: stats.total_forms,
						variant: "primary"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: "PUBLISHED",
						value: stats.published_forms,
						variant: "success"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: "CLOSED",
						value: stats.closed_forms,
						variant: "warning"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: "ARCHIVED",
						value: stats.archived_forms,
						variant: "muted"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: period === "all" ? "ALL SUBMISSIONS" : period === 7 ? "SUBMISSIONS (7D)" : "SUBMISSIONS (30D)",
						value: stats.total_submissions,
						variant: "primary"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: "ACTIVE FORMS",
						value: stats.active_forms,
						variant: "success",
						subtitle: period === "all" ? "Received responses in period" : period === 7 ? "Received responses in 7 days" : "Received responses in 30 days"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: "TODAY",
						value: stats.today_submissions,
						variant: "info"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: "PENDING REVIEW",
						value: stats.new_submissions + stats.under_review,
						variant: "warning"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-4 lg:grid-cols-2 mb-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-border/60 bg-card p-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
						className: "text-sm font-semibold mb-4",
						children: ["Submission Trend", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-xs text-muted-foreground font-normal ml-2",
							children: [
								"(",
								period === "all" ? "Last 30 days" : period === 7 ? "Last 7 days" : "Last 30 days",
								")"
							]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrendChart, { data: trend })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-border/60 bg-card p-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
						className: "text-sm font-semibold mb-4",
						children: ["Submission Status", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-xs text-muted-foreground font-normal ml-2",
							children: [
								"(",
								period === "all" ? "All time" : period === 7 ? "Last 7 days" : "Last 30 days",
								")"
							]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBreakdown, { stats })]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl border border-border/60 bg-card p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-sm font-semibold mb-4",
					children: "Recent Submissions"
				}), recent.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground py-8 text-center",
					children: "No submissions yet."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "space-y-0 divide-y divide-border/40",
					children: recent.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/forms/$formId/responses/$submissionId",
						params: {
							formId: s.form_id,
							submissionId: s.id
						},
						className: "flex items-center justify-between py-3 hover:text-primary transition-colors group",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-mono font-semibold group-hover:text-primary transition-colors",
							children: s.reference_id
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted-foreground",
							children: s.respondent_name ?? "Anonymous"
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-xs text-muted-foreground",
							children: [
								new Date(s.submitted_at).toLocaleDateString(),
								" ",
								new Date(s.submitted_at).toLocaleTimeString()
							]
						})]
					}, s.id))
				})]
			})
		] }) : null]
	}) });
}
function StatCard({ label, value, variant = "default", subtitle }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `rounded-xl border ${{
			default: "border-border/60",
			primary: "border-primary/40 bg-primary/5",
			success: "border-green-500/40 bg-green-500/5",
			warning: "border-yellow-500/40 bg-yellow-500/5",
			info: "border-blue-500/40 bg-blue-500/5",
			muted: "border-border/40"
		}[variant]} bg-card p-5`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] font-semibold text-muted-foreground tracking-wide mb-2",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-4xl font-bold mb-1",
				children: value
			}),
			subtitle && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[10px] text-muted-foreground",
				children: subtitle
			})
		]
	});
}
function TrendChart({ data }) {
	const peak = Math.max(0, ...data.map((d) => d.count));
	const max = Math.max(1, peak);
	const W = 600, H = 120, gap = 4;
	const bw = data.length > 0 ? (W - gap * (data.length - 1)) / data.length : W;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		viewBox: `0 0 ${W} ${H}`,
		className: "w-full h-28",
		role: "img",
		"aria-label": "Submissions per day",
		children: data.map((d, i) => {
			const h = d.count === 0 ? 2 : Math.max(4, d.count / max * (H - 12));
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				x: i * (bw + gap),
				y: H - h,
				width: bw,
				height: h,
				rx: 2,
				fill: d.count === 0 ? "#D9D2C5" : "#8C3514",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("title", { children: `${d.day}: ${d.count} submission${d.count !== 1 ? "s" : ""}` })
			}, i);
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex justify-between text-[10px] text-muted-foreground mt-1",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: data[0]?.day ?? "" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
				"Peak: ",
				peak,
				"/day"
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: data[data.length - 1]?.day ?? "" })
		]
	})] });
}
function StatusBreakdown({ stats }) {
	const items = [
		{
			label: "New",
			count: stats.new_submissions,
			color: "#336B8E"
		},
		{
			label: "Under Review",
			count: stats.under_review,
			color: "#D39A20"
		},
		{
			label: "Approved",
			count: stats.approved,
			color: "#3E7B3C"
		},
		{
			label: "Rejected",
			count: stats.rejected,
			color: "#B93A32"
		}
	];
	const total = items.reduce((sum, item) => sum + item.count, 0);
	if (total === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted-foreground py-12 text-center",
		children: "No submissions in this period."
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "space-y-3",
		children: items.map((item) => {
			const percentage = total > 0 ? item.count / total * 100 : 0;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between text-sm mb-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "h-2.5 w-2.5 rounded-full shrink-0",
						style: { background: item.color }
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted-foreground",
						children: item.label
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-semibold",
						children: item.count
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-xs text-muted-foreground",
						children: [
							"(",
							percentage.toFixed(0),
							"%)"
						]
					})]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "h-2 rounded-full bg-secondary overflow-hidden",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-full rounded-full transition-all",
					style: {
						width: `${percentage}%`,
						background: item.color
					}
				})
			})] }, item.label);
		})
	});
}
//#endregion
export { Dashboard as component };
