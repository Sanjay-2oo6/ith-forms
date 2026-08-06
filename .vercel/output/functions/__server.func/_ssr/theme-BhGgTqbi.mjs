import { o as __toESM } from "../_runtime.mjs";
import { i as require_react } from "../_libs/dnd-kit__accessibility+react.mjs";
import { i as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { o as supabase } from "./ith-brand-DcxNWcJj.mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { K as ArrowLeft, T as LoaderCircle, U as Check, a as Trash2, c as Smartphone, r as Upload, x as Monitor } from "../_libs/lucide-react.mjs";
import { t as themeContainerStyle } from "./theme-utils-CZ5WP4IV.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as AdminShell } from "./AdminShell-CDlfLDsd.mjs";
import { t as Route } from "./theme-CtQfVqgq.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/theme-BhGgTqbi.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var PRESETS = [
	{
		key: "ith-default",
		label: "ITH Default",
		primary: "#4f9cf9",
		background: "#131530",
		card: "#1b1e40"
	},
	{
		key: "professional",
		label: "Professional",
		primary: "#1d4ed8",
		background: "#f1f5f9",
		card: "#ffffff"
	},
	{
		key: "academic",
		label: "Academic",
		primary: "#7c2d12",
		background: "#f5f1e8",
		card: "#fffdf7"
	},
	{
		key: "minimal",
		label: "Minimal",
		primary: "#171717",
		background: "#ffffff",
		card: "#fafafa"
	},
	{
		key: "dark",
		label: "Dark",
		primary: "#8b5cf6",
		background: "#09090b",
		card: "#18181b"
	}
];
var FONTS = [
	{
		label: "System (default)",
		value: ""
	},
	{
		label: "Serif",
		value: "Georgia, 'Times New Roman', serif"
	},
	{
		label: "Monospace",
		value: "'Courier New', monospace"
	}
];
var RADII = [
	{
		label: "Sharp (0px)",
		value: "0px"
	},
	{
		label: "Subtle (8px)",
		value: "0.5rem"
	},
	{
		label: "Default (12px)",
		value: "0.75rem"
	},
	{
		label: "Round (16px)",
		value: "1rem"
	}
];
var WIDTHS = [{
	label: "Narrow (640px)",
	value: "640"
}, {
	label: "Wide (768px)",
	value: "768"
}];
var DEFAULT_THEME = (formId) => ({
	form_id: formId,
	preset: "ith-default",
	primary_color: "#4f9cf9",
	background_color: "#131530",
	card_color: "#1b1e40",
	font_family: null,
	border_radius: null,
	form_width: null,
	bg_image_path: null,
	bg_overlay_opacity: .5
});
function ThemeEditor() {
	const { formId } = Route.useParams();
	const [form, setForm] = (0, import_react.useState)(null);
	const [theme, setTheme] = (0, import_react.useState)(null);
	const [saving, setSaving] = (0, import_react.useState)(false);
	const [uploading, setUploading] = (0, import_react.useState)(false);
	const [mobilePreview, setMobilePreview] = (0, import_react.useState)(false);
	const fileRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		(async () => {
			const [fRes, tRes] = await Promise.all([supabase.from("forms").select("title").eq("id", formId).single(), supabase.from("form_themes").select("*").eq("form_id", formId).maybeSingle()]);
			if (fRes.data) setForm(fRes.data);
			setTheme(tRes.data ?? DEFAULT_THEME(formId));
		})();
	}, [formId]);
	function patch(p) {
		setTheme((t) => t ? {
			...t,
			...p,
			preset: p.preset ?? "custom"
		} : t);
	}
	function applyPreset(p) {
		setTheme((t) => t ? {
			...t,
			preset: p.key,
			primary_color: p.primary,
			background_color: p.background,
			card_color: p.card
		} : t);
	}
	async function save() {
		if (!theme) return;
		setSaving(true);
		const { error } = await supabase.from("form_themes").upsert({
			form_id: formId,
			preset: theme.preset,
			primary_color: theme.primary_color,
			background_color: theme.background_color,
			card_color: theme.card_color,
			font_family: theme.font_family,
			border_radius: theme.border_radius,
			form_width: theme.form_width,
			bg_image_path: theme.bg_image_path,
			bg_overlay_opacity: theme.bg_overlay_opacity
		}, { onConflict: "form_id" });
		setSaving(false);
		if (error) {
			toast.error(error.message);
			return;
		}
		const actorEmail = (await supabase.auth.getUser()).data.user?.email ?? null;
		supabase.from("audit_logs").insert({
			action: "theme.updated",
			entity: "form",
			entity_id: formId,
			actor_email: actorEmail,
			metadata: { preset: theme.preset }
		}).then(({ error: e }) => {
			if (e) console.error("[audit] insert failed:", e.code, e.message);
		});
		toast.success("Theme saved — the public form uses it immediately.");
	}
	async function uploadBg(e) {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file || !theme) return;
		if (!file.type.startsWith("image/")) {
			toast.error("Background must be an image.");
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			toast.error("Background image must be under 5 MB.");
			return;
		}
		setUploading(true);
		const path = `${formId}/bg-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
		const { error } = await supabase.storage.from("form-assets").upload(path, file, { upsert: true });
		setUploading(false);
		if (error) {
			toast.error(`Upload failed: ${error.message}`);
			return;
		}
		patch({ bg_image_path: path });
		toast.success("Background uploaded — remember to Save.");
	}
	if (!theme) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex justify-center py-16",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "animate-spin" })
	}) });
	const bgUrl = theme.bg_image_path ? supabase.storage.from("form-assets").getPublicUrl(theme.bg_image_path).data.publicUrl : null;
	const previewStyle = themeContainerStyle(theme, bgUrl);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "p-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-3 mb-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/forms",
					className: "flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-sm hover:bg-secondary transition-colors shrink-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "h-4 w-4" }), " Forms"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-xl font-bold",
						children: "Theme"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs text-muted-foreground",
						children: [form?.title ?? "Form", " — how respondents see it"]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: save,
					disabled: saving,
					className: "flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60",
					children: [saving ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "h-4 w-4" }), " Save theme"]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-xl border border-border/60 bg-card p-4 space-y-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-semibold text-sm",
							children: "Preset"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-2 gap-2",
							children: [PRESETS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => applyPreset(p),
								className: `rounded-lg border p-2.5 text-left transition-colors ${theme.preset === p.key ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex gap-1 mb-1.5",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "h-4 w-4 rounded-full border border-black/20",
											style: { background: p.background }
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "h-4 w-4 rounded-full border border-black/20",
											style: { background: p.card }
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "h-4 w-4 rounded-full border border-black/20",
											style: { background: p.primary }
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs font-medium",
									children: p.label
								})]
							}, p.key)), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: `rounded-lg border p-2.5 ${theme.preset === "custom" ? "border-primary ring-1 ring-primary" : "border-border"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs font-medium mt-4",
									children: "Custom"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[10px] text-muted-foreground",
									children: "edit colors below"
								})]
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-xl border border-border/60 bg-card p-4 space-y-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-semibold text-sm",
							children: "Colors"
						}), [
							["Primary", "primary_color"],
							["Background", "background_color"],
							["Card", "card_color"]
						].map(([label, key]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "text-xs text-muted-foreground w-24",
									children: label
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "color",
									value: theme[key] ?? "#000000",
									onChange: (e) => patch({ [key]: e.target.value }),
									className: "h-8 w-10 rounded border border-input bg-transparent cursor-pointer"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									value: theme[key] ?? "",
									onChange: (e) => patch({ [key]: e.target.value }),
									placeholder: "#rrggbb",
									className: "flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
								})
							]
						}, key))]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-xl border border-border/60 bg-card p-4 space-y-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-semibold text-sm",
								children: "Layout & Type"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "text-xs text-muted-foreground w-24",
									children: "Font"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
									value: theme.font_family ?? "",
									onChange: (e) => patch({ font_family: e.target.value || null }),
									className: "flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring",
									children: FONTS.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: f.value,
										children: f.label
									}, f.label))
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "text-xs text-muted-foreground w-24",
									children: "Corners"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
									value: theme.border_radius ?? "0.75rem",
									onChange: (e) => patch({ border_radius: e.target.value }),
									className: "flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring",
									children: RADII.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: r.value,
										children: r.label
									}, r.value))
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "text-xs text-muted-foreground w-24",
									children: "Form width"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
									value: theme.form_width ?? "640",
									onChange: (e) => patch({ form_width: e.target.value }),
									className: "flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring",
									children: WIDTHS.map((w) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: w.value,
										children: w.label
									}, w.value))
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-xl border border-border/60 bg-card p-4 space-y-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-semibold text-sm",
								children: "Background image"
							}),
							theme.bg_image_path ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "h-20 rounded-lg bg-cover bg-center border border-border",
									style: { backgroundImage: bgUrl ? `url(${bgUrl})` : void 0 }
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: () => patch({ bg_image_path: null }),
										className: "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border text-destructive hover:bg-destructive/10",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-3 w-3" }), " Remove"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "text-[10px] text-muted-foreground block mb-1",
											children: ["Overlay opacity: ", (theme.bg_overlay_opacity ?? .5).toFixed(2)]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "range",
											min: 0,
											max: .95,
											step: .05,
											value: theme.bg_overlay_opacity ?? .5,
											onChange: (e) => patch({ bg_overlay_opacity: parseFloat(e.target.value) }),
											className: "w-full accent-primary"
										})]
									})]
								})]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => fileRef.current?.click(),
								disabled: uploading,
								className: "flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border hover:border-primary/60 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60",
								children: [uploading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-3.5 w-3.5 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "h-3.5 w-3.5" }), "Upload image (max 5 MB)"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								ref: fileRef,
								type: "file",
								accept: "image/*",
								hidden: true,
								onChange: uploadBg
							})
						]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between mb-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-semibold text-sm",
					children: "Live preview"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => setMobilePreview(false),
						className: `p-1.5 rounded-md border ${!mobilePreview ? "border-primary text-primary" : "border-border text-muted-foreground"}`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Monitor, { className: "h-4 w-4" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => setMobilePreview(true),
						className: `p-1.5 rounded-md border ${mobilePreview ? "border-primary text-primary" : "border-border text-muted-foreground"}`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, { className: "h-4 w-4" })
					})]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rounded-xl border border-border overflow-hidden flex justify-center bg-black/20",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					style: {
						...previewStyle,
						width: mobilePreview ? 375 : "100%"
					},
					className: "bg-background text-foreground transition-all",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "px-6 py-8",
						style: {
							maxWidth: Number(theme.form_width ?? "640"),
							margin: "0 auto"
						},
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "text-xl font-bold mb-1",
								children: form?.title ?? "Form title"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-muted-foreground mb-6",
								children: "This is how respondents will see your form."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-xl border border-border bg-card p-5 space-y-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "block text-sm font-medium mb-1.5 text-card-foreground",
										children: ["Full name ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-destructive",
											children: "*"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										readOnly: true,
										placeholder: "Jane Respondent",
										className: "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm h-10"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-sm font-medium mb-1.5 text-card-foreground",
										children: "Attending?"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium grid place-items-center",
											children: "Yes"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "flex-1 h-10 rounded-lg border border-input text-sm grid place-items-center",
											children: "No"
										})]
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm grid place-items-center",
										children: "Submit"
									})
								]
							})
						]
					})
				})
			})] })]
		})]
	}) });
}
//#endregion
export { ThemeEditor as component };
