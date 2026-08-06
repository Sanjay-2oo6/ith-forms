import { o as __toESM } from "../_runtime.mjs";
import { i as require_react } from "../_libs/dnd-kit__accessibility+react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-theme-eySlBD0O.js
var import_react = /* @__PURE__ */ __toESM(require_react());
function resolveDefault(mode) {
	if (mode === "system") return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
	return mode;
}
function useTheme(defaultAppearance) {
	const [theme, setThemeState] = (0, import_react.useState)(() => {
		if (typeof window !== "undefined") {
			const stored = localStorage.getItem("theme");
			if (stored === "light" || stored === "dark") return stored;
			return resolveDefault(defaultAppearance ?? "dark");
		}
		return "dark";
	});
	(0, import_react.useEffect)(() => {
		if (!defaultAppearance) return;
		const stored = localStorage.getItem("theme");
		if (stored === "light" || stored === "dark") return;
		setThemeState(resolveDefault(defaultAppearance));
	}, [defaultAppearance]);
	(0, import_react.useEffect)(() => {
		const root = document.documentElement;
		root.classList.remove("light", "dark");
		root.classList.add(theme);
	}, [theme]);
	const persist = (next) => {
		localStorage.setItem("theme", next);
		setThemeState(next);
	};
	const toggle = () => persist(theme === "dark" ? "light" : "dark");
	return {
		theme,
		toggle,
		setTheme: persist
	};
}
//#endregion
export { useTheme as t };
