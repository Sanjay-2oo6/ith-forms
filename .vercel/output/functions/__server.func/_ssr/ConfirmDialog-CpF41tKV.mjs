import { o as __toESM } from "../_runtime.mjs";
import { i as require_react } from "../_libs/dnd-kit__accessibility+react.mjs";
import { i as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as X } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ConfirmDialog-CpF41tKV.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var ConfirmContext = (0, import_react.createContext)(null);
function useConfirm() {
	const ctx = (0, import_react.useContext)(ConfirmContext);
	if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
	return ctx;
}
function ConfirmProvider({ children }) {
	const [state, setState] = (0, import_react.useState)(null);
	const confirm = (options) => {
		return new Promise((resolve) => {
			setState({
				open: true,
				options,
				resolve
			});
		});
	};
	const handleClose = (confirmed) => {
		state?.resolve(confirmed);
		setState(null);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ConfirmContext.Provider, {
		value: { confirm },
		children: [children, state?.open && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm",
			onClick: () => handleClose(false),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative rounded-2xl border border-border bg-card text-card-foreground p-6 shadow-2xl max-w-md w-full mx-4 animate-fade-up",
				onClick: (e) => e.stopPropagation(),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => handleClose(false),
						className: "absolute top-4 right-4 p-1 hover:text-destructive transition-colors",
						"aria-label": "Close",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "h-4 w-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-lg font-bold mb-2 pr-8",
						children: state.options.title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground mb-6",
						children: state.options.message
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => handleClose(false),
							className: "flex-1 h-10 rounded-md border border-border text-sm hover:bg-secondary transition-colors",
							children: state.options.cancelLabel ?? "Cancel"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => handleClose(true),
							className: `flex-1 h-10 rounded-md text-sm font-medium transition-colors ${state.options.variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90"}`,
							children: state.options.confirmLabel ?? "Confirm"
						})]
					})
				]
			})
		})]
	});
}
//#endregion
export { useConfirm as n, ConfirmProvider as t };
