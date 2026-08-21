import { o as __toESM } from "../_runtime.mjs";
import { i as require_react } from "../_libs/dnd-kit__accessibility+react.mjs";
import { i as require_jsx_runtime, r as useQueryClient, t as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { o as supabase } from "./ith-brand-DH88OzsJ.mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { A as FileText, C as Mail, F as Download, G as Calendar, N as ExternalLink, T as LoaderCircle, j as Eye, n as User, q as ArrowLeft, t as X } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as AdminShell } from "./AdminShell-B_d5Ah0c.mjs";
import { a as exportResponsesXlsx, i as displayAnswer, n as SUBMISSION_STATUSES, o as fetchTabular, r as buildOptionMap, t as DateFilterUnsupportedError } from "./responses-wGUBc76a.mjs";
import { t as formatDistanceToNow } from "../_libs/date-fns.mjs";
import { n as useConfirm } from "./ConfirmDialog-CpF41tKV.mjs";
import { t as Route } from "./responses-CrszhV73.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/responses-BzPl-EXy.js
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
var STATUS_COLORS$1 = {
	new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
	under_review: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
	approved: "bg-green-500/20 text-green-400 border-green-500/30",
	rejected: "bg-red-500/20 text-red-400 border-red-500/30",
	more_info_required: "bg-orange-500/20 text-orange-400 border-orange-500/30",
	archived: "bg-secondary text-secondary-foreground border-border"
};
function SubmissionDetailModal({ submission, questions, optionMap, onClose, onStatusChange }) {
	const [fileBusy, setFileBusy] = (0, import_react.useState)(null);
	async function handleStatusChange(newStatus) {
		if (onStatusChange) onStatusChange(newStatus);
	}
	async function openFile(file) {
		setFileBusy(`open:${file.file_path}`);
		try {
			const { data, error } = await supabase.storage.from("submission-files").createSignedUrl(file.file_path, 3600);
			if (error || !data?.signedUrl) {
				toast.error("Could not create a link to open this file.");
				return;
			}
			window.open(data.signedUrl, "_blank", "noopener,noreferrer");
		} finally {
			setFileBusy(null);
		}
	}
	async function downloadFile(file) {
		setFileBusy(`dl:${file.file_path}`);
		try {
			const { data, error } = await supabase.storage.from("submission-files").createSignedUrl(file.file_path, 3600, { download: file.file_name });
			if (error || !data?.signedUrl) {
				toast.error("Could not create a download link.");
				return;
			}
			const a = document.createElement("a");
			a.href = data.signedUrl;
			a.download = file.file_name;
			document.body.appendChild(a);
			a.click();
			a.remove();
		} finally {
			setFileBusy(null);
		}
	}
	const sortedQuestions = [...questions].sort((a, b) => a.position - b.position);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative w-full max-w-3xl max-h-[90vh] bg-card rounded-xl border border-border shadow-2xl flex flex-col",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between p-6 border-b border-border shrink-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-xl font-bold",
						children: "Submission Details"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground font-mono mt-1",
						children: submission.reference_id
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onClose,
						className: "p-2 rounded-lg hover:bg-secondary transition-colors",
						"aria-label": "Close modal",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "h-5 w-5" })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 overflow-y-auto p-6 space-y-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "rounded-lg border border-border bg-secondary/20 p-4 space-y-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start justify-between gap-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-2 flex-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 text-sm",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, { className: "h-4 w-4 text-muted-foreground shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-medium",
											children: submission.respondent_name || "Anonymous"
										})]
									}),
									submission.respondent_email && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 text-sm text-muted-foreground",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mail, { className: "h-4 w-4 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: submission.respondent_email })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 text-sm text-muted-foreground",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Calendar, { className: "h-4 w-4 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
											new Date(submission.submitted_at).toLocaleDateString(),
											" ",
											new Date(submission.submitted_at).toLocaleTimeString()
										] })]
									})
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "text-xs text-muted-foreground block mb-1",
								children: "Status"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								value: submission.status,
								onChange: (e) => handleStatusChange(e.target.value),
								className: `px-3 py-1.5 rounded-md text-xs font-medium border ${STATUS_COLORS$1[submission.status] || "bg-secondary"} cursor-pointer`,
								children: STATUSES.map((status) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: status,
									children: status.replace(/_/g, " ")
								}, status))
							})] })]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4",
						children: "Responses"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-6",
						children: sortedQuestions.map((question, idx) => {
							const answer = submission.answers?.[question.id];
							const questionFiles = submission.files?.filter((f) => f.question_id === question.id) || [];
							if ([
								"section_heading",
								"information_paragraph",
								"hidden"
							].includes(question.type)) return null;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "pb-6 border-b border-border/40 last:border-0",
								children: [
									(idx === 0 || sortedQuestions[idx - 1]?.section_title !== question.section_title) && question.section_title && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mb-3 pb-2 border-b border-border/20",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-xs font-semibold text-primary uppercase tracking-wider",
											children: question.section_title
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mb-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "font-semibold text-base text-foreground",
											children: question.label
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "text-xs text-muted-foreground mt-0.5",
											children: ["Type: ", question.type.replace(/_/g, " ")]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-2",
										children: answer ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-sm text-muted-foreground whitespace-pre-wrap bg-secondary/30 rounded-lg p-3 border border-border/40",
											children: displayAnswer(answer.value, question.type, optionMap?.[question.id])
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-sm text-muted-foreground italic",
											children: "No answer provided"
										})
									}),
									questionFiles.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-3 space-y-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-xs font-medium text-muted-foreground",
											children: "Attached files:"
										}), questionFiles.map((file) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/40",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "h-4 w-4 text-muted-foreground shrink-0" }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex-1 min-w-0",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
														className: "text-sm font-medium truncate",
														children: file.file_name
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
														className: "text-xs text-muted-foreground",
														children: [
															(file.file_size / 1024).toFixed(1),
															" KB · ",
															file.mime_type
														]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
													onClick: () => openFile(file),
													disabled: fileBusy !== null,
													className: "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border hover:bg-secondary transition-colors disabled:opacity-50",
													"aria-label": `Open ${file.file_name} in a new tab`,
													children: [fileBusy === `open:${file.file_path}` ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-3.5 w-3.5 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "h-3.5 w-3.5" }), " Open"]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
													onClick: () => downloadFile(file),
													disabled: fileBusy !== null,
													className: "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border hover:bg-secondary transition-colors disabled:opacity-50",
													"aria-label": `Download ${file.file_name}`,
													children: [fileBusy === `dl:${file.file_path}` ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-3.5 w-3.5 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "h-3.5 w-3.5" }), " Download"]
												})
											]
										}, file.file_path))]
									})
								]
							}, question.id);
						})
					})] })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex items-center justify-end gap-3 p-6 border-t border-border shrink-0",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onClose,
						className: "px-4 py-2 rounded-lg border border-border hover:bg-secondary transition-colors",
						children: "Close"
					})
				})
			]
		})
	});
}
function ResponsesFilterBar({ search, status, dateFrom, dateTo, onSearch, onStatus, onDateFrom, onDateTo }) {
	const hasDates = dateFrom !== "" || dateTo !== "";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-wrap gap-3 mb-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				value: search,
				onChange: (e) => onSearch(e.target.value),
				placeholder: "Search by name, email, reference ID…",
				className: "flex-1 min-w-56 h-10 rounded-lg border border-input bg-card px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
				value: status,
				onChange: (e) => onStatus(e.target.value),
				className: "h-10 rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: "all",
					children: "All statuses"
				}), SUBMISSION_STATUSES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: s,
					children: s.replace(/_/g, " ")
				}, s))]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "text-xs text-muted-foreground",
						htmlFor: "resp-date-from",
						children: "From"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						id: "resp-date-from",
						type: "date",
						value: dateFrom,
						max: dateTo || void 0,
						onChange: (e) => onDateFrom(e.target.value),
						className: "h-10 rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "text-xs text-muted-foreground",
						htmlFor: "resp-date-to",
						children: "To"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						id: "resp-date-to",
						type: "date",
						value: dateTo,
						min: dateFrom || void 0,
						onChange: (e) => onDateTo(e.target.value),
						className: "h-10 rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					}),
					hasDates && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => {
							onDateFrom("");
							onDateTo("");
						},
						className: "flex items-center gap-1 h-10 px-2.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors",
						title: "Clear date filter",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "h-3.5 w-3.5" }), " Clear dates"]
					})
				]
			})
		]
	});
}
var STATUS_COLORS = {
	new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
	under_review: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
	approved: "bg-green-500/20 text-green-400 border-green-500/30",
	rejected: "bg-red-500/20 text-red-400 border-red-500/30",
	more_info_required: "bg-orange-500/20 text-orange-400 border-orange-500/30",
	archived: "bg-secondary text-secondary-foreground border-border"
};
function ResponsesTable({ submissions, selected, onToggleSelect, onSelectAll, onView }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "rounded-lg border border-border bg-card overflow-hidden",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "overflow-x-auto",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
				className: "w-full text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
					className: "bg-secondary/50 border-b border-border",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-4 py-3 text-left w-12",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "checkbox",
								className: "accent-primary",
								checked: submissions.length > 0 && submissions.every((s) => selected.has(s.id)),
								onChange: (e) => onSelectAll(e.target.checked)
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-4 py-3 text-left font-semibold text-xs uppercase text-muted-foreground",
							children: "Reference ID"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-4 py-3 text-left font-semibold text-xs uppercase text-muted-foreground",
							children: "Status"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-4 py-3 text-left font-semibold text-xs uppercase text-muted-foreground",
							children: "Respondent"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-4 py-3 text-left font-semibold text-xs uppercase text-muted-foreground",
							children: "Submitted"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-4 py-3 text-center font-semibold text-xs uppercase text-muted-foreground w-32",
							children: "Actions"
						})
					] })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
					className: "divide-y divide-border",
					children: submissions.map((s, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: `hover:bg-secondary/20 transition-colors ${idx % 2 === 0 ? "bg-card" : "bg-secondary/5"}`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-3",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "checkbox",
									className: "accent-primary",
									checked: selected.has(s.id),
									onChange: () => onToggleSelect(s.id)
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-3",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono font-semibold text-primary",
									children: s.reference_id
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-3",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: `inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${STATUS_COLORS[s.status] ?? ""}`,
									children: s.status.replace(/_/g, " ")
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-3",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "max-w-[200px]",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "font-medium text-foreground truncate",
										children: s.respondent_name ?? "Anonymous"
									}), s.respondent_email && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-xs text-muted-foreground truncate",
										children: s.respondent_email
									})]
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
								className: "px-4 py-3 text-muted-foreground",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-sm",
									children: new Date(s.submitted_at).toLocaleDateString()
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-xs text-muted-foreground/70",
									children: [formatDistanceToNow(new Date(s.submitted_at)), " ago"]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-3 text-center",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => onView(s),
									className: "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "h-3.5 w-3.5" }), "View Details"]
								})
							})
						]
					}, s.id))
				})]
			})
		})
	});
}
function BulkActionsBar({ count, bulkStatus, applying, onBulkStatus, onApply, onClear }) {
	if (count === 0) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-3 mb-4 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "text-sm font-medium",
				children: [count, " selected"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
				value: bulkStatus,
				onChange: (e) => onBulkStatus(e.target.value),
				className: "h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring",
				children: SUBMISSION_STATUSES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: s,
					children: s.replace(/_/g, " ")
				}, s))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				onClick: onApply,
				disabled: applying,
				className: "flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60",
				children: [applying && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-3 w-3 animate-spin" }), " Apply Status"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: onClear,
				className: "px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary",
				children: "Clear Selection"
			})
		]
	});
}
function PaginationBar({ page, pageSize, total, shown, onPrev, onNext }) {
	if (total <= pageSize) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center justify-between mt-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: onPrev,
				disabled: page === 0,
				className: "flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors",
				children: "← Previous"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "text-sm text-muted-foreground",
				children: [
					"Page ",
					page + 1,
					" of ",
					Math.max(1, Math.ceil(total / pageSize)),
					" · ",
					shown,
					" shown"
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: onNext,
				disabled: (page + 1) * pageSize >= total,
				className: "flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors",
				children: "Next →"
			})
		]
	});
}
function ResponsesList() {
	const { confirm } = useConfirm();
	const { formId } = Route.useParams();
	const queryClient = useQueryClient();
	const [exporting, setExporting] = (0, import_react.useState)(false);
	const [filter, setFilter] = (0, import_react.useState)("all");
	const [search, setSearch] = (0, import_react.useState)("");
	const [debouncedSearch, setDebouncedSearch] = (0, import_react.useState)("");
	const [dateFrom, setDateFrom] = (0, import_react.useState)("");
	const [dateTo, setDateTo] = (0, import_react.useState)("");
	const [page, setPage] = (0, import_react.useState)(0);
	const [selected, setSelected] = (0, import_react.useState)(/* @__PURE__ */ new Set());
	const [bulkStatus, setBulkStatus] = (0, import_react.useState)("under_review");
	const [applying, setApplying] = (0, import_react.useState)(false);
	const [selectedSubmission, setSelectedSubmission] = (0, import_react.useState)(null);
	const dateWarningShown = (0, import_react.useRef)(false);
	(0, import_react.useEffect)(() => {
		const t = setTimeout(() => setDebouncedSearch(search), 300);
		return () => clearTimeout(t);
	}, [search]);
	(0, import_react.useEffect)(() => {
		setPage(0);
	}, [
		debouncedSearch,
		filter,
		dateFrom,
		dateTo
	]);
	const filters = {
		search: debouncedSearch,
		status: filter,
		dateFrom,
		dateTo
	};
	const { data: form } = useQuery({
		queryKey: ["form-meta", formId],
		queryFn: async () => {
			const { data, error } = await supabase.from("forms").select("title,slug").eq("id", formId).single();
			if (error) throw new Error(error.message);
			return data;
		},
		staleTime: 6e4
	});
	const { data: optionMap = {} } = useQuery({
		queryKey: ["option-map", formId],
		queryFn: async () => {
			const { data, error } = await supabase.from("form_questions").select("id,options").eq("form_id", formId);
			if (error) throw new Error(error.message);
			return buildOptionMap(data ?? []);
		},
		staleTime: 6e4
	});
	const { data, isLoading: loading, refetch } = useQuery({
		queryKey: [
			"responses-tabular",
			formId,
			page,
			debouncedSearch,
			filter,
			dateFrom,
			dateTo
		],
		queryFn: async () => {
			try {
				return await fetchTabular(formId, {
					limit: 50,
					offset: page * 50,
					...filters
				});
			} catch (err) {
				if (err instanceof DateFilterUnsupportedError) {
					if (!dateWarningShown.current) {
						dateWarningShown.current = true;
						toast.warning(err.message);
					}
					return err.fallbackData;
				}
				toast.error(err instanceof Error ? err.message : "Failed to load responses");
				throw err;
			}
		},
		staleTime: 15e3,
		placeholderData: (prev) => prev
	});
	(0, import_react.useEffect)(() => {
		setSelected(/* @__PURE__ */ new Set());
	}, [data]);
	const load = () => {
		queryClient.invalidateQueries({ queryKey: ["responses-tabular", formId] });
		refetch();
	};
	function toggleSelect(id) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}
	async function applyBulk() {
		const ids = [...selected];
		if (ids.length === 0) return;
		const label = bulkStatus.replace(/_/g, " ");
		if (!await confirm({
			title: "Change Submission Status",
			message: `Change status of ${ids.length} submission(s) to "${label}"?`,
			confirmLabel: "Change Status",
			variant: "default"
		})) return;
		setApplying(true);
		try {
			const actorEmail = (await supabase.auth.getUser()).data.user?.email ?? null;
			const targets = (data?.submissions ?? []).filter((s) => ids.includes(s.id) && s.status !== bulkStatus);
			if (targets.length > 0) {
				const { error } = await supabase.from("submissions").update({ status: bulkStatus }).in("id", targets.map((t) => t.id));
				if (error) {
					toast.error(error.message);
					return;
				}
				await supabase.from("submission_status_history").insert(targets.map((t) => ({
					submission_id: t.id,
					form_id: formId,
					from_status: t.status,
					to_status: bulkStatus
				})));
				await supabase.from("audit_logs").insert(targets.map((t) => ({
					action: "submission.status_changed",
					entity: "submission",
					entity_id: t.id,
					actor_email: actorEmail,
					metadata: {
						from: t.status,
						to: bulkStatus,
						bulk: true
					}
				})));
			}
			toast.success(`${targets.length} submission(s) moved to "${label}"`);
			load();
		} finally {
			setApplying(false);
		}
	}
	async function handleStatusChange(submissionId, newStatus) {
		const submission = data?.submissions.find((s) => s.id === submissionId);
		if (!submission) return;
		const actorEmail = (await supabase.auth.getUser()).data.user?.email ?? null;
		const { error } = await supabase.from("submissions").update({ status: newStatus }).eq("id", submissionId);
		if (error) {
			toast.error(error.message);
			return;
		}
		await supabase.from("submission_status_history").insert({
			submission_id: submissionId,
			form_id: formId,
			from_status: submission.status,
			to_status: newStatus
		});
		await supabase.from("audit_logs").insert({
			action: "submission.status_changed",
			entity: "submission",
			entity_id: submissionId,
			actor_email: actorEmail,
			metadata: {
				from: submission.status,
				to: newStatus
			}
		});
		toast.success("Status updated");
		load();
	}
	const subs = data?.submissions ?? [];
	const questions = data?.questions ?? [];
	const total = data?.total_count ?? 0;
	async function exportExcel() {
		setExporting(true);
		try {
			const count = await exportResponsesXlsx({
				formId,
				slug: form?.slug ?? null,
				filters,
				questions,
				optionMap
			});
			if (count === 0) {
				toast.error("No responses to export");
				return;
			}
			toast.success(`Exported ${count} response${count !== 1 ? "s" : ""}`);
		} catch (err) {
			if (err instanceof DateFilterUnsupportedError) {
				toast.warning(err.message);
				return;
			}
			toast.error(err instanceof Error ? err.message : "Export failed");
		} finally {
			setExporting(false);
		}
	}
	const hasFilters = debouncedSearch.trim() !== "" || filter !== "all" || dateFrom !== "" || dateTo !== "";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AdminShell, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3 mb-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/forms",
						className: "flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-sm hover:bg-secondary transition-colors shrink-0",
						"aria-label": "Back to forms",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "h-4 w-4" }), " Forms"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "text-xl font-bold",
							children: form?.title ?? "Responses"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs text-muted-foreground",
							children: [
								total,
								" matching submission",
								total !== 1 ? "s" : "",
								hasFilters ? " (filtered)" : ""
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: exportExcel,
						disabled: exporting || total === 0,
						className: "flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60",
						children: [
							exporting ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "h-4 w-4" }),
							"Export ",
							hasFilters ? "Filtered" : "All",
							" (",
							total,
							")"
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsesFilterBar, {
				search,
				status: filter,
				dateFrom,
				dateTo,
				onSearch: setSearch,
				onStatus: setFilter,
				onDateFrom: setDateFrom,
				onDateTo: setDateTo
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BulkActionsBar, {
				count: selected.size,
				bulkStatus,
				applying,
				onBulkStatus: setBulkStatus,
				onApply: applyBulk,
				onClear: () => setSelected(/* @__PURE__ */ new Set())
			}),
			loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex justify-center py-12",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-6 w-6 animate-spin text-muted-foreground" })
			}) : subs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rounded-xl border border-border/60 bg-card p-12 text-center text-muted-foreground text-sm",
				children: hasFilters ? "No submissions match your filters." : "No submissions yet."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsesTable, {
				submissions: subs,
				selected,
				onToggleSelect: toggleSelect,
				onSelectAll: (checked) => setSelected(checked ? new Set(subs.map((s) => s.id)) : /* @__PURE__ */ new Set()),
				onView: setSelectedSubmission
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PaginationBar, {
				page,
				pageSize: 50,
				total,
				shown: subs.length,
				onPrev: () => setPage((p) => Math.max(0, p - 1)),
				onNext: () => setPage((p) => p + 1)
			})] })
		]
	}), selectedSubmission && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SubmissionDetailModal, {
		submission: selectedSubmission,
		questions,
		optionMap,
		onClose: () => setSelectedSubmission(null),
		onStatusChange: (newStatus) => {
			handleStatusChange(selectedSubmission.id, newStatus);
			setSelectedSubmission(null);
		}
	})] });
}
//#endregion
export { ResponsesList as component };
