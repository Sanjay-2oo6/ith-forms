import { o as __toESM } from "./_runtime.mjs";
import { t as supabase } from "./_ssr/client-C_07D2FG.mjs";
import { i as require_react } from "./_libs/dnd-kit__accessibility+react.mjs";
import { i as require_jsx_runtime, r as useQueryClient, t as useQuery } from "./_libs/react+tanstack__react-query.mjs";
import { v as Link } from "./_libs/@tanstack/react-router+[...].mjs";
import { T as LoaderCircle, f as Send, q as ArrowLeft } from "./_libs/lucide-react.mjs";
import { t as Route } from "./_submissionId-B5fXaVHC.mjs";
import { n as toast } from "./_libs/sonner.mjs";
import { t as AdminShell } from "./_ssr/AdminShell-CsRAjfSE.mjs";
import { i as displayAnswer, r as buildOptionMap } from "./_ssr/responses-DwM8ULVf.mjs";
import { n as format } from "./_libs/date-fns.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_submissionId-CmXd5mrQ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var STATUSES = [
	"new",
	"under_review",
	"approved",
	"rejected",
	"more_info_required",
	"archived"
];
var STATUS_COLORS = {
	new: "bg-blue-500/20 text-blue-400",
	under_review: "bg-yellow-500/20 text-yellow-400",
	approved: "bg-green-500/20 text-green-400",
	rejected: "bg-red-500/20 text-red-400",
	more_info_required: "bg-orange-500/20 text-orange-400",
	archived: "bg-secondary text-secondary-foreground"
};
function SubmissionDetail() {
	const { formId, submissionId } = Route.useParams();
	const queryClient = useQueryClient();
	const [newNote, setNewNote] = (0, import_react.useState)("");
	const [addingNote, setAddingNote] = (0, import_react.useState)(false);
	const [changingStatus, setChangingStatus] = (0, import_react.useState)(false);
	const { data: optionMap = {} } = useQuery({
		queryKey: ["option-map", formId],
		queryFn: async () => {
			const { data, error } = await supabase.from("form_questions").select("id,options").eq("form_id", formId);
			if (error) throw new Error(error.message);
			return buildOptionMap(data ?? []);
		},
		staleTime: 6e4
	});
	const { data: detail, isLoading: loading } = useQuery({
		queryKey: ["submission-detail", submissionId],
		queryFn: async () => {
			const { data, error } = await supabase.rpc("get_submission_detail", { p_submission_id: submissionId });
			if (error) {
				console.error("Failed to load submission:", error);
				toast.error(error.message);
				throw new Error(error.message);
			}
			return data ?? null;
		},
		staleTime: 3e4
	});
	const sub = detail?.submission ?? null;
	const answers = detail?.answers ?? [];
	const notes = detail?.notes ?? [];
	const history = detail?.history ?? [];
	const invalidate = () => queryClient.invalidateQueries({ queryKey: ["submission-detail", submissionId] });
	async function changeStatus(newStatus) {
		if (!sub || newStatus === sub.status) return;
		setChangingStatus(true);
		const { error } = await supabase.from("submissions").update({ status: newStatus }).eq("id", submissionId);
		if (error) {
			toast.error(error.message);
			setChangingStatus(false);
			return;
		}
		const actorEmail = (await supabase.auth.getUser()).data.user?.email ?? null;
		await supabase.from("submission_status_history").insert({
			submission_id: submissionId,
			form_id: formId,
			from_status: sub.status,
			to_status: newStatus
		});
		supabase.from("audit_logs").insert({
			action: "submission.status_changed",
			entity: "submission",
			entity_id: submissionId,
			actor_email: actorEmail,
			metadata: {
				from: sub.status,
				to: newStatus
			}
		}).then(({ error }) => {
			if (error) console.error("[audit] insert failed:", error.code, error.message);
		});
		toast.success(`Status changed to "${newStatus.replace(/_/g, " ")}"`);
		setChangingStatus(false);
		queryClient.invalidateQueries({ queryKey: ["responses-tabular", formId] });
		invalidate();
	}
	async function addNote(e) {
		e.preventDefault();
		if (!newNote.trim()) return;
		setAddingNote(true);
		const { error } = await supabase.from("submission_notes").insert({
			submission_id: submissionId,
			form_id: formId,
			body: newNote.trim()
		});
		if (error) {
			toast.error(error.message);
			setAddingNote(false);
			return;
		}
		setNewNote("");
		setAddingNote(false);
		invalidate();
	}
	if (loading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex justify-center py-16",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "animate-spin" })
	}) });
	if (!sub) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "p-6 text-muted-foreground",
		children: "Submission not found."
	}) });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "p-6 max-w-3xl",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-3 mb-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/forms/$formId/responses",
				params: { formId },
				className: "p-1.5 rounded-md hover:bg-secondary transition-colors",
				"aria-label": "Back to responses list",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "h-4 w-4" })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-xl font-bold font-mono",
						children: sub.reference_id
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: `text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[sub.status] ?? ""}`,
						children: sub.status.replace(/_/g, " ")
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-muted-foreground",
					children: [
						sub.respondent_name ?? "Anonymous",
						sub.respondent_email ? ` · ${sub.respondent_email}` : "",
						" · submitted ",
						format(new Date(sub.submitted_at), "d MMM yyyy, HH:mm")
					]
				})]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-6 lg:grid-cols-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "lg:col-span-2 space-y-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-border/60 bg-card p-5 space-y-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-semibold text-sm",
						children: "Answers"
					}), answers.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground",
						children: "No answers recorded."
					}) : answers.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground mb-0.5",
						children: a.question_label ?? "Question"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm",
						children: a.value ? displayAnswer(a.value, a.question_type, optionMap[a.question_id]) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-muted-foreground italic",
							children: "—"
						})
					})] }, a.id))]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-border/60 bg-card p-5 space-y-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-semibold text-sm",
							children: "Internal Notes"
						}),
						notes.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border-l-2 border-primary/40 pl-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm whitespace-pre-wrap",
								children: n.body
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] text-muted-foreground mt-1",
								children: format(new Date(n.created_at), "d MMM yyyy, HH:mm")
							})]
						}, n.id)),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
							onSubmit: addNote,
							className: "flex gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
								value: newNote,
								onChange: (e) => setNewNote(e.target.value),
								rows: 2,
								placeholder: "Add internal note…",
								className: "flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "submit",
								disabled: addingNote || !newNote.trim(),
								className: "self-end px-3 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-60",
								children: addingNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, { className: "h-4 w-4" })
							})]
						})
					]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-border/60 bg-card p-4 space-y-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-semibold text-sm",
						children: "Change Status"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-1.5",
						children: STATUSES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => changeStatus(s),
							disabled: changingStatus || s === sub.status,
							className: `w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${s === sub.status ? STATUS_COLORS[s] + " font-medium" : "hover:bg-secondary text-muted-foreground hover:text-foreground"} disabled:opacity-60`,
							children: s.replace(/_/g, " ")
						}, s))
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-border/60 bg-card p-4 space-y-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-semibold text-sm",
						children: "Status History"
					}), history.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: "No transitions yet."
					}) : history.map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-foreground",
							children: [h.from_status ? `${h.from_status.replace(/_/g, " ")} → ` : "", h.to_status.replace(/_/g, " ")]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted-foreground",
							children: format(new Date(h.changed_at), "d MMM, HH:mm")
						})]
					}, h.id))]
				})]
			})]
		})]
	}) });
}
//#endregion
export { SubmissionDetail as component };
