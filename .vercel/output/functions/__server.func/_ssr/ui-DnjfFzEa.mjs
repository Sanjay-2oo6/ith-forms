import { i as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { T as LoaderCircle } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ui-DnjfFzEa.js
var import_jsx_runtime = require_jsx_runtime();
/**
* Shared UI primitives — the handful of Tailwind utility combinations that
* were copy-pasted across nearly every admin route. Centralising them keeps
* the visual design identical while giving future changes a single home.
*
* These are class-string constants (not styled components) on purpose: the
* codebase composes utilities inline everywhere, so constants slot into the
* existing idiom without forcing a component API onto every call site.
*/
var inputCls = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
var textareaCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none";
var selectCls = "h-10 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
function Field({ label, hint, error, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-1.5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
				className: "text-sm font-medium",
				children: label
			}),
			children,
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-destructive",
				role: "alert",
				children: error
			}) : hint && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: hint
			})
		]
	});
}
function LoadingButton({ loading, children, className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		...props,
		disabled: props.disabled || loading,
		className: className ?? "flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors",
		children: [loading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }), children]
	});
}
//#endregion
export { textareaCls as a, selectCls as i, LoadingButton as n, inputCls as r, Field as t };
