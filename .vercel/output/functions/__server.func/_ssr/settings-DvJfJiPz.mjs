import { o as __toESM } from "../_runtime.mjs";
import { i as require_react } from "../_libs/dnd-kit__accessibility+react.mjs";
import { i as require_jsx_runtime, r as useQueryClient, t as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { a as fetchAppSettings, o as supabase, r as DEFAULT_APP_SETTINGS } from "./ith-brand-Df5jtyU6.mjs";
import { B as CircleAlert, D as Info, T as LoaderCircle, U as Check } from "../_libs/lucide-react.mjs";
import { i as fieldErrors, t as AppSettingsSchema } from "./validation-Cb9MIurp.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as AdminShell } from "./AdminShell-B0BieESN.mjs";
import { a as textareaCls, i as selectCls, n as LoadingButton, r as inputCls, t as Field } from "./ui-DnjfFzEa.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-DvJfJiPz.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var SYSTEM_INFO = [
	{
		label: "Maximum questions per form",
		value: "25"
	},
	{
		label: "Reference ID format",
		value: "Organization – Form – Sequence"
	},
	{
		label: "Maximum upload size",
		value: "Up to 50 MB per question"
	},
	{
		label: "Authentication",
		value: "Admin access enabled"
	},
	{
		label: "File storage",
		value: "Secure private file storage"
	}
];
function SettingsPage() {
	const queryClient = useQueryClient();
	const [draft, setDraft] = (0, import_react.useState)(null);
	const [status, setStatus] = (0, import_react.useState)("idle");
	const [errors, setErrors] = (0, import_react.useState)({});
	const { data: saved, isLoading } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchAppSettings,
		staleTime: 5 * 6e4
	});
	(0, import_react.useEffect)(() => {
		if (saved && draft === null) setDraft(saved);
	}, [saved, draft]);
	function update(patch) {
		setDraft((d) => d ? {
			...d,
			...patch
		} : d);
		setStatus("dirty");
	}
	async function save() {
		if (!draft || status === "saving") return;
		const parsed = AppSettingsSchema.safeParse(draft);
		if (!parsed.success) {
			setErrors(fieldErrors(parsed.error));
			setStatus("dirty");
			return;
		}
		setErrors({});
		setStatus("saving");
		const { error, data } = await supabase.from("app_settings").update(parsed.data).eq("id", 1).select("id");
		if (error || !data?.length) {
			setStatus("error");
			toast.error(error?.message ?? "Settings row not found — run migration 024_app_settings.sql first.");
			return;
		}
		setDraft({ ...parsed.data });
		setStatus("saved");
		queryClient.invalidateQueries({ queryKey: ["app-settings"] });
		toast.success("Settings saved");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "p-6 max-w-3xl",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-2xl font-bold",
					children: "Settings"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "Application branding and defaults."
				})]
			}),
			isLoading || !draft ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl border border-border/60 bg-card p-6 flex items-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-5 w-5 animate-spin text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-sm text-muted-foreground",
					children: "Loading settings…"
				})]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl border border-border/60 bg-card p-6 space-y-5 mb-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-semibold",
							children: "Application Settings"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusChip, { status })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Application name",
						error: errors.app_name,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: draft.app_name,
							onChange: (e) => update({ app_name: e.target.value }),
							"aria-invalid": !!errors.app_name,
							className: inputCls,
							placeholder: DEFAULT_APP_SETTINGS.app_name
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Organization name",
						error: errors.org_name,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: draft.org_name,
							onChange: (e) => update({ org_name: e.target.value }),
							"aria-invalid": !!errors.org_name,
							className: inputCls,
							placeholder: DEFAULT_APP_SETTINGS.org_name
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Powered-by text",
						error: errors.powered_by,
						hint: "Shown in the app header, login page, and public form footer.",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: draft.powered_by,
							onChange: (e) => update({ powered_by: e.target.value }),
							"aria-invalid": !!errors.powered_by,
							className: inputCls,
							placeholder: DEFAULT_APP_SETTINGS.powered_by
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Default appearance",
						error: errors.default_appearance,
						hint: "Applies to admins who haven't picked a theme themselves.",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							value: draft.default_appearance,
							onChange: (e) => update({ default_appearance: e.target.value }),
							className: selectCls + " w-full bg-background",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "light",
									children: "Light"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "dark",
									children: "Dark"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "system",
									children: "System"
								})
							]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Default confirmation message",
						error: errors.default_confirmation_message,
						hint: "Used for NEW forms only — forms you've already customized keep their own message.",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
							value: draft.default_confirmation_message,
							onChange: (e) => update({ default_confirmation_message: e.target.value }),
							"aria-invalid": !!errors.default_confirmation_message,
							rows: 3,
							className: textareaCls,
							placeholder: DEFAULT_APP_SETTINGS.default_confirmation_message
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex justify-end pt-1",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoadingButton, {
							loading: status === "saving",
							disabled: status !== "dirty" && status !== "error",
							onClick: save,
							children: "Save settings"
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl border border-border/60 bg-card p-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "font-semibold mb-4 flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "h-4 w-4 text-muted-foreground" }), " System Information"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "space-y-3",
					children: SYSTEM_INFO.map(({ label, value }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-muted-foreground",
							children: [label, ": "]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-semibold",
							children: value
						})]
					}, label))
				})]
			})
		]
	}) });
}
function StatusChip({ status }) {
	if (status === "saving") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "flex items-center gap-1 text-xs text-muted-foreground",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-3 w-3 animate-spin" }), "Saving…"]
	});
	if (status === "dirty") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "flex items-center gap-1 text-xs text-amber-500",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { className: "h-3 w-3" }), "Unsaved changes"]
	});
	if (status === "error") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "flex items-center gap-1 text-xs text-destructive",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { className: "h-3 w-3" }), "Save failed"]
	});
	if (status === "saved") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "flex items-center gap-1 text-xs text-green-400",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "h-3 w-3" }), "Saved"]
	});
	return null;
}
//#endregion
export { SettingsPage as component };
