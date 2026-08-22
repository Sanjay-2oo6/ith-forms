import { o as __toESM } from "../_runtime.mjs";
import { t as supabase } from "./client-C_07D2FG.mjs";
import { i as require_react } from "../_libs/dnd-kit__accessibility+react.mjs";
import { i as require_jsx_runtime, t as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { v as Link, y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { g as require_react_dom } from "../_libs/@dnd-kit/core+[...].mjs";
import { C as Mail, F as Download, K as BookOpen, L as Copy, M as EyeOff, N as ExternalLink, P as EllipsisVertical, R as CopyPlus, S as MessageCircle, W as Check, _ as Plus, a as Trash2, f as Send, j as Eye, t as X, u as Share2, v as Pencil } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as AdminShell } from "./AdminShell-CsRAjfSE.mjs";
import { n as useConfirm } from "./ConfirmDialog-CpF41tKV.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/forms-Be3__-TB.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_react_dom = /* @__PURE__ */ __toESM(require_react_dom());
/**
* Duplicate a form: metadata + sections + questions (options, config,
* positions) + theme. The copy is always created as a DRAFT with a unique
* "<slug>-copy[-n]" slug and zero responses — submissions are never copied.
*
* Runs entirely through the admin's authenticated Supabase session, so RLS
* (admin-only writes) applies exactly as it does in the form builder.
* Returns the new form's id.
*/
async function duplicateForm(formId) {
	const [fRes, sRes, qRes, tRes] = await Promise.all([
		supabase.from("forms").select("*").eq("id", formId).single(),
		supabase.from("form_sections").select("*").eq("form_id", formId).order("position"),
		supabase.from("form_questions").select("*").eq("form_id", formId).order("position"),
		supabase.from("form_themes").select("*").eq("form_id", formId).maybeSingle()
	]);
	if (fRes.error || !fRes.data) throw new Error(fRes.error?.message ?? "Form not found");
	const src = fRes.data;
	const sections = sRes.data ?? [];
	const questions = qRes.data ?? [];
	const baseSlug = `${src.slug}-copy`;
	const { data: taken } = await supabase.from("forms").select("slug").like("slug", `${baseSlug}%`);
	const takenSet = new Set((taken ?? []).map((r) => r.slug));
	let newSlug = baseSlug;
	for (let n = 2; takenSet.has(newSlug); n++) newSlug = `${baseSlug}-${n}`;
	const { data: newForm, error: insErr } = await supabase.from("forms").insert({
		title: `${src.title} (Copy)`,
		slug: newSlug,
		description: src.description ?? null,
		category: src.category ?? null,
		status: "draft",
		opens_at: src.opens_at ?? null,
		closes_at: src.closes_at ?? null,
		max_responses: src.max_responses ?? null,
		allow_anonymous: src.allow_anonymous ?? true,
		consent_text: src.consent_text ?? null,
		confirmation_title: src.confirmation_title ?? null,
		confirmation_message: src.confirmation_message ?? null
	}).select("id").single();
	if (insErr || !newForm) throw new Error(insErr?.message ?? "Failed to create the duplicate form");
	const newFormId = newForm.id;
	const t = tRes.data;
	const { error: themeErr } = await supabase.from("form_themes").insert(t ? {
		form_id: newFormId,
		preset: t.preset,
		primary_color: t.primary_color,
		background_color: t.background_color,
		card_color: t.card_color,
		font_family: t.font_family,
		border_radius: t.border_radius,
		form_width: t.form_width,
		bg_image_path: t.bg_image_path,
		bg_overlay_opacity: t.bg_overlay_opacity
	} : {
		form_id: newFormId,
		preset: "ith-default"
	});
	if (themeErr) throw new Error(themeErr.message);
	const sectionIdMap = /* @__PURE__ */ new Map();
	for (const sec of sections) {
		const { data: newSec, error: secErr } = await supabase.from("form_sections").insert({
			form_id: newFormId,
			title: sec.title,
			description: sec.description,
			position: sec.position
		}).select("id").single();
		if (secErr || !newSec) throw new Error(secErr?.message ?? `Failed to copy section "${sec.title}"`);
		sectionIdMap.set(sec.id, newSec.id);
	}
	if (questions.length > 0) {
		const rows = questions.map((q) => ({
			form_id: newFormId,
			section_id: sectionIdMap.get(q.section_id) ?? [...sectionIdMap.values()][0],
			type: q.type,
			label: q.label,
			description: q.description ?? null,
			placeholder: q.placeholder ?? null,
			required: q.required ?? false,
			default_value: q.default_value ?? null,
			options: q.options ?? [],
			config: q.config ?? {},
			position: q.position ?? 0
		}));
		let { error: qErr } = await supabase.from("form_questions").insert(rows);
		if (qErr && (qErr.code === "42703" || /config/i.test(qErr.message))) {
			const legacyRows = rows.map(({ config: _config, ...rest }) => rest);
			({error: qErr} = await supabase.from("form_questions").insert(legacyRows));
		}
		if (qErr) throw new Error(qErr.message);
	}
	await supabase.from("audit_logs").insert({
		action: "form.created",
		entity: "form",
		entity_id: newFormId,
		metadata: {
			title: `${src.title} (Copy)`,
			duplicated_from: formId
		}
	});
	return newFormId;
}
/**
* Accessible "⋮" dropdown for row actions.
* - Portaled to <body> with viewport coordinates (immune to transformed /
*   overflow ancestors — same lesson as the question-type picker).
* - Outside click + Escape close; focus returns to the trigger.
* - ArrowUp/Down/Home/End roving focus; Enter/Space activates.
* - ARIA menu/menuitem semantics; flips upward near the bottom edge.
*/
function MoreMenu({ items, label = "More actions" }) {
	const [rect, setRect] = (0, import_react.useState)(null);
	const triggerRef = (0, import_react.useRef)(null);
	const menuRef = (0, import_react.useRef)(null);
	const open = rect !== null;
	function close(returnFocus = true) {
		setRect(null);
		if (returnFocus) triggerRef.current?.focus();
	}
	(0, import_react.useEffect)(() => {
		if (!open) return;
		const onDocClick = (e) => {
			if (menuRef.current?.contains(e.target)) return;
			if (triggerRef.current?.contains(e.target)) return;
			close(false);
		};
		const onKey = (e) => {
			if (e.key === "Escape") {
				e.stopPropagation();
				close();
			}
		};
		document.addEventListener("mousedown", onDocClick);
		document.addEventListener("keydown", onKey);
		requestAnimationFrame(() => {
			menuRef.current?.querySelector("[role=menuitem]:not(:disabled)")?.focus();
		});
		return () => {
			document.removeEventListener("mousedown", onDocClick);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);
	function onMenuKeyDown(e) {
		const focusables = [...menuRef.current?.querySelectorAll("[role=menuitem]:not(:disabled)") ?? []];
		const idx = focusables.indexOf(document.activeElement);
		if (e.key === "ArrowDown") {
			e.preventDefault();
			focusables[(idx + 1) % focusables.length]?.focus();
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			focusables[(idx - 1 + focusables.length) % focusables.length]?.focus();
		} else if (e.key === "Home") {
			e.preventDefault();
			focusables[0]?.focus();
		} else if (e.key === "End") {
			e.preventDefault();
			focusables[focusables.length - 1]?.focus();
		} else if (e.key === "Tab") close(false);
	}
	const MENU_W = 208;
	const style = rect ? (() => {
		const estH = 44 * items.filter((i) => i.type !== "separator").length + 16;
		return {
			position: "fixed",
			...window.innerHeight - rect.bottom - 8 < estH ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 },
			left: Math.max(8, Math.min(rect.right - MENU_W, window.innerWidth - MENU_W - 8)),
			width: MENU_W,
			zIndex: 60
		};
	})() : {};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		ref: triggerRef,
		type: "button",
		"aria-haspopup": "menu",
		"aria-expanded": open,
		"aria-label": label,
		onClick: (e) => {
			const r = e.currentTarget.getBoundingClientRect();
			setRect((prev) => prev ? null : r);
		},
		className: "flex items-center justify-center h-[26px] w-8 rounded-md text-xs border border-border hover:bg-secondary transition-colors",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EllipsisVertical, { className: "h-3.5 w-3.5" })
	}), open && (0, import_react_dom.createPortal)(/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref: menuRef,
		role: "menu",
		"aria-label": label,
		onKeyDown: onMenuKeyDown,
		style,
		className: "rounded-xl border border-border bg-card shadow-xl p-1.5 space-y-0.5",
		children: items.map((item, i) => item.type === "separator" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			role: "separator",
			className: "my-1 h-px bg-border/60"
		}, i) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			role: "menuitem",
			type: "button",
			disabled: item.disabled,
			onClick: () => {
				close(false);
				item.onSelect();
			},
			className: `flex w-full items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-left transition-colors disabled:opacity-50 ${item.destructive ? "text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10" : "hover:bg-secondary focus-visible:bg-secondary"} outline-none`,
			children: [item.icon && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(item.icon, { className: "h-3.5 w-3.5 shrink-0" }), item.label]
		}, i))
	}), document.body)] });
}
var STATUS_COLORS = {
	draft: "bg-secondary text-secondary-foreground",
	published: "bg-green-500/20 text-green-400",
	closed: "bg-yellow-500/20 text-yellow-400",
	archived: "bg-muted text-muted-foreground"
};
function ShareModal({ url, title, onClose }) {
	const canvasRef = (0, import_react.useRef)(null);
	const [message, setMessage] = (0, import_react.useState)("");
	const [copied, setCopied] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (canvasRef.current) {
			const cvs = canvasRef.current;
			import("../_libs/qrcode.mjs").then((n) => /* @__PURE__ */ __toESM(n.t())).then((mod) => {
				mod.default.toCanvas(cvs, url, {
					width: 220,
					margin: 2,
					color: {
						dark: "#1A1A1A",
						light: "#FCFAF5"
					}
				});
			});
		}
	}, [url]);
	const shareText = message.trim() ? `${message.trim()}\n\n${title}\n${url}` : `${title}\n${url}`;
	const enc = encodeURIComponent;
	const apps = [
		{
			key: "whatsapp",
			label: "WhatsApp",
			icon: MessageCircle,
			color: "#25D366",
			href: `https://wa.me/?text=${enc(shareText)}`
		},
		{
			key: "gmail",
			label: "Gmail",
			icon: Mail,
			color: "#EA4335",
			href: `https://mail.google.com/mail/?view=cm&fs=1&su=${enc(title)}&body=${enc(shareText)}`
		},
		{
			key: "email",
			label: "Email",
			icon: Mail,
			color: "#5E5E5E",
			href: `mailto:?subject=${enc(title)}&body=${enc(shareText)}`
		},
		{
			key: "telegram",
			label: "Telegram",
			icon: Send,
			color: "#229ED9",
			href: `https://t.me/share/url?url=${enc(url)}&text=${enc(message.trim() || title)}`
		},
		{
			key: "twitter",
			label: "X",
			icon: Share2,
			color: "#1A1A1A",
			href: `https://twitter.com/intent/tweet?text=${enc(message.trim() || title)}&url=${enc(url)}`
		},
		{
			key: "linkedin",
			label: "LinkedIn",
			icon: Share2,
			color: "#0A66C2",
			href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`
		}
	];
	function copyLink() {
		navigator.clipboard.writeText(url);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	}
	function downloadQr() {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const a = document.createElement("a");
		a.download = `qr-${title.toLowerCase().replace(/\s+/g, "-")}.png`;
		a.href = canvas.toDataURL("image/png");
		a.click();
	}
	async function nativeShare() {
		if (navigator.share) try {
			await navigator.share({
				title,
				text: message.trim() || title,
				url
			});
		} catch {}
		else {
			copyLink();
			toast.success("Link copied — paste it anywhere to share");
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto",
		onClick: onClose,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative rounded-2xl border border-border bg-card text-card-foreground p-6 shadow-2xl animate-fade-up w-full max-w-md my-8",
			onClick: (e) => e.stopPropagation(),
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: onClose,
					className: "absolute top-4 right-4 p-1 hover:text-destructive transition-colors",
					"aria-label": "Close",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "h-4 w-4" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-semibold mb-1 pr-6",
					children: "Share form"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground mb-4 truncate",
					children: title
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex justify-center mb-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "rounded-xl border border-border p-2 bg-card",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
							ref: canvasRef,
							className: "block"
						})
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 mb-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							readOnly: true,
							value: url,
							className: "flex-1 h-9 rounded-md border border-input bg-background px-3 text-xs font-mono truncate focus:outline-none"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: copyLink,
							title: "Copy link",
							className: "h-9 px-3 rounded-md border border-border text-xs hover:bg-secondary transition-colors flex items-center gap-1.5",
							children: [copied ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "h-3.5 w-3.5 text-green-600" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "h-3.5 w-3.5" }), copied ? "Copied" : "Copy"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: downloadQr,
							title: "Download QR code",
							className: "h-9 px-2.5 rounded-md border border-border text-xs hover:bg-secondary transition-colors",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "h-3.5 w-3.5" })
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "text-xs font-medium mb-1.5 block",
						children: "Add a message (optional)"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
						value: message,
						onChange: (e) => setMessage(e.target.value),
						rows: 2,
						placeholder: "e.g. Please register for our workshop by Friday…",
						className: "w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid grid-cols-4 gap-2 mb-3",
					children: apps.map((app) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						href: app.href,
						target: "_blank",
						rel: "noopener noreferrer",
						className: "flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-secondary transition-colors",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "h-10 w-10 rounded-full grid place-items-center text-white shrink-0",
							style: { background: app.color },
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(app.icon, { className: "h-5 w-5" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] text-muted-foreground",
							children: app.label
						})]
					}, app.key))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: nativeShare,
					className: "w-full h-10 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Share2, { className: "h-4 w-4" }), " More share options"]
				})
			]
		})
	});
}
function FormsList() {
	const { confirm } = useConfirm();
	const navigate = useNavigate();
	const [search, setSearch] = (0, import_react.useState)("");
	const [statusFilter, setStatusFilter] = (0, import_react.useState)("all");
	const [showTrash, setShowTrash] = (0, import_react.useState)(false);
	const [shareForm, setShareForm] = (0, import_react.useState)(null);
	const [duplicatingId, setDuplicatingId] = (0, import_react.useState)(null);
	const { data: forms = [], isLoading: loading, refetch } = useQuery({
		queryKey: ["forms-list", showTrash],
		queryFn: async () => {
			let q = supabase.from("forms").select("id,slug,title,status,response_count,max_responses,created_at,deleted_at").order("created_at", { ascending: false });
			if (showTrash) q = q.not("deleted_at", "is", null);
			else q = q.is("deleted_at", null);
			const { data } = await q;
			return data ?? [];
		},
		staleTime: 15e3
	});
	const load = () => refetch();
	const filtered = forms.filter((f) => {
		if (statusFilter !== "all" && f.status !== statusFilter) return false;
		if (search) {
			const q = search.toLowerCase();
			return f.title.toLowerCase().includes(q) || f.slug.toLowerCase().includes(q);
		}
		return true;
	});
	async function softDelete(id) {
		if (!await confirm({
			title: "Delete Form",
			message: "Are you sure you want to move this form to deleted?",
			confirmLabel: "Delete",
			variant: "destructive"
		})) return;
		const form = forms.find((f) => f.id === id);
		const { error } = await supabase.from("forms").update({
			status: "deleted",
			deleted_at: (/* @__PURE__ */ new Date()).toISOString()
		}).eq("id", id);
		if (error) {
			toast.error(error.message);
			return;
		}
		await supabase.from("audit_logs").insert({
			action: "form.deleted",
			entity: "form",
			entity_id: id,
			metadata: { title: form?.title || "Unknown" }
		});
		toast.success("Form deleted");
		load();
	}
	async function restoreForm(id) {
		const form = forms.find((f) => f.id === id);
		const { error } = await supabase.from("forms").update({
			status: "draft",
			deleted_at: null
		}).eq("id", id);
		if (error) {
			toast.error(error.message);
			return;
		}
		await supabase.from("audit_logs").insert({
			action: "form.restored",
			entity: "form",
			entity_id: id,
			metadata: { title: form?.title || "Unknown" }
		});
		toast.success("Form restored");
		load();
	}
	async function togglePublish(f) {
		if (f.status === "published") {
			const { error } = await supabase.from("forms").update({
				status: "draft",
				published_at: null
			}).eq("id", f.id);
			if (error) {
				toast.error(error.message);
				return;
			}
			await supabase.from("audit_logs").insert({
				action: "form.unpublished",
				entity: "form",
				entity_id: f.id,
				metadata: { title: f.title }
			});
			toast.success("Form unpublished");
		} else {
			const [{ data: sections }, { data: qs }] = await Promise.all([supabase.from("form_sections").select("id").eq("form_id", f.id), supabase.from("form_questions").select("type").eq("form_id", f.id)]);
			if (!sections?.length) {
				toast.error("Add at least one section before publishing this form.");
				return;
			}
			if ((qs ?? []).filter((q) => ![
				"section_heading",
				"information_paragraph",
				"hidden"
			].includes(q.type)).length === 0) {
				toast.error("Add at least one question before publishing this form.");
				return;
			}
			const { error } = await supabase.from("forms").update({
				status: "published",
				published_at: (/* @__PURE__ */ new Date()).toISOString()
			}).eq("id", f.id);
			if (error) {
				toast.error(error.message);
				return;
			}
			await supabase.from("audit_logs").insert({
				action: "form.published",
				entity: "form",
				entity_id: f.id,
				metadata: { title: f.title }
			});
			toast.success("Form published");
		}
		load();
	}
	async function handleDuplicate(f) {
		if (!await confirm({
			title: "Duplicate Form",
			message: `Create a draft copy of "${f.title}" with all sections, questions, and theme? Responses are not copied.`,
			confirmLabel: "Duplicate",
			variant: "default"
		})) return;
		setDuplicatingId(f.id);
		try {
			const newId = await duplicateForm(f.id);
			toast.success("Form duplicated — opening the copy");
			navigate({
				to: "/forms/$formId/edit",
				params: { formId: newId }
			});
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to duplicate form");
		} finally {
			setDuplicatingId(null);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AdminShell, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between mb-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-2xl font-bold",
					children: "Forms"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "Create, publish, and manage every form."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/forms/new",
					className: "flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "h-4 w-4" }), " New form"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex gap-3 mb-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: search,
						onChange: (e) => setSearch(e.target.value),
						placeholder: "Search title or slug",
						className: "flex-1 h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						value: statusFilter,
						onChange: (e) => setStatusFilter(e.target.value),
						className: "h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "all",
								children: "All statuses"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "draft",
								children: "Draft"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "published",
								children: "Published"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "closed",
								children: "Closed"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "archived",
								children: "Archived"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => setShowTrash((v) => !v),
						className: `h-9 px-3 rounded-md border text-sm transition-colors ${showTrash ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"}`,
						children: showTrash ? "Back to forms" : "Trash"
					})
				]
			}),
			loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-3",
				children: [...Array(3)].map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-16 rounded-xl bg-card animate-pulse" }, i))
			}) : filtered.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl border border-border/60 bg-card p-12 text-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-muted-foreground mb-4",
					children: showTrash ? "Trash is empty." : forms.length === 0 ? "No forms yet." : "No forms match your filters."
				}), !showTrash && forms.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/forms/new",
					className: "inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "h-4 w-4" }), " Create your first form"]
				})]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-3",
				children: filtered.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-4 rounded-xl border border-border/60 bg-card px-5 py-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1 min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 mb-0.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-semibold truncate",
								children: f.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: `shrink-0 text-[11px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${STATUS_COLORS[f.status] ?? ""}`,
								children: f.status
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs text-muted-foreground",
							children: [
								"/forms/",
								f.slug,
								" ·",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
									to: "/forms/$formId/responses",
									params: { formId: f.id },
									className: "hover:text-primary hover:underline transition-colors",
									title: "View responses",
									children: [
										f.response_count,
										" response",
										f.response_count !== 1 ? "s" : "",
										f.max_responses ? ` / ${f.max_responses}` : ""
									]
								})
							]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex items-center gap-1 shrink-0 flex-wrap justify-end",
						children: !showTrash ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/forms/$formId/responses",
								params: { formId: f.id },
								className: "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border hover:bg-secondary transition-colors",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, { className: "h-3.5 w-3.5" }), " Responses"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/forms/$formId/edit",
								params: { formId: f.id },
								className: "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border hover:bg-secondary transition-colors",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "h-3.5 w-3.5" }), " Edit"]
							}),
							f.status === "published" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => setShareForm(f),
								className: "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border hover:bg-secondary transition-colors",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Share2, { className: "h-3.5 w-3.5" }), " Share"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
								href: `/forms/${f.slug}`,
								target: "_blank",
								rel: "noopener noreferrer",
								className: "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border hover:bg-secondary transition-colors",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "h-3.5 w-3.5" }), " Open"]
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MoreMenu, {
								label: `More actions for ${f.title}`,
								items: [
									{
										label: duplicatingId === f.id ? "Duplicating…" : "Duplicate",
										icon: CopyPlus,
										disabled: duplicatingId !== null,
										onSelect: () => handleDuplicate(f)
									},
									f.status === "published" ? {
										label: "Unpublish",
										icon: EyeOff,
										onSelect: () => togglePublish(f)
									} : {
										label: "Publish",
										icon: Eye,
										onSelect: () => togglePublish(f)
									},
									{ type: "separator" },
									{
										label: "Delete",
										icon: Trash2,
										destructive: true,
										onSelect: () => softDelete(f.id)
									}
								]
							})
						] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => restoreForm(f.id),
							className: "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border text-primary hover:bg-primary/10 transition-colors",
							children: "Restore"
						})
					})]
				}, f.id))
			})
		]
	}), shareForm && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShareModal, {
		url: `${window.location.origin}/forms/${shareForm.slug}`,
		title: shareForm.title,
		onClose: () => setShareForm(null)
	})] });
}
//#endregion
export { FormsList as component };
