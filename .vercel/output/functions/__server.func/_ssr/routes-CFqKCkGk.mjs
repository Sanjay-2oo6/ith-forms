import { o as __toESM } from "../_runtime.mjs";
import { i as require_react } from "../_libs/dnd-kit__accessibility+react.mjs";
import { y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-CFqKCkGk.js
var import_react = /* @__PURE__ */ __toESM(require_react());
function IndexRedirect() {
	const navigate = useNavigate();
	(0, import_react.useEffect)(() => {
		navigate({
			to: "/admin/login",
			replace: true
		});
	}, [navigate]);
	return null;
}
//#endregion
export { IndexRedirect as component };
