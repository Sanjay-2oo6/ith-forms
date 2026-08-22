import { o as __toESM } from "../_runtime.mjs";
import { t as supabase } from "./client-C_07D2FG.mjs";
import { i as require_react } from "../_libs/dnd-kit__accessibility+react.mjs";
import { i as require_jsx_runtime, t as useQuery } from "../_libs/react+tanstack__react-query.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ith-brand-fcDpoiC6.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var DEFAULT_APP_SETTINGS = {
	app_name: "ITH-FORMS",
	org_name: "InnoTech-Hub",
	powered_by: "Powered by InnoTech-Hub",
	default_appearance: "dark",
	default_confirmation_message: "Your response has been submitted successfully."
};
async function fetchAppSettings() {
	if (typeof window === "undefined") return DEFAULT_APP_SETTINGS;
	try {
		const { data, error } = await supabase.from("app_settings").select("app_name,org_name,powered_by,default_appearance,default_confirmation_message").eq("id", 1).maybeSingle();
		if (error || !data) return DEFAULT_APP_SETTINGS;
		return {
			...DEFAULT_APP_SETTINGS,
			...data
		};
	} catch {
		return DEFAULT_APP_SETTINGS;
	}
}
function useAppSettings() {
	const { data } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchAppSettings,
		staleTime: 5 * 6e4
	});
	return data ?? DEFAULT_APP_SETTINGS;
}
var BRAND_NAME = DEFAULT_APP_SETTINGS.app_name;
var BRAND_POWERED = DEFAULT_APP_SETTINGS.powered_by;
function useBranding() {
	const settings = useAppSettings();
	return {
		appName: settings.app_name,
		orgName: settings.org_name,
		poweredBy: settings.powered_by
	};
}
var IthLogo = (0, import_react.memo)(function IthLogo({ size = 40, withWordmark = true }) {
	const { appName, poweredBy } = useBranding();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
			src: "/ith-logo.svg",
			alt: `${appName} logo`,
			style: {
				width: size,
				height: size
			},
			className: "shrink-0",
			onError: (e) => {
				e.currentTarget.style.display = "none";
			}
		}), withWordmark && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "leading-none",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-bold leading-none tracking-tight",
				children: appName
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[10px] opacity-60 mt-0.5",
				children: poweredBy
			})]
		})]
	});
});
//#endregion
export { fetchAppSettings as a, IthLogo as i, BRAND_POWERED as n, useAppSettings as o, DEFAULT_APP_SETTINGS as r, useBranding as s, BRAND_NAME as t };
