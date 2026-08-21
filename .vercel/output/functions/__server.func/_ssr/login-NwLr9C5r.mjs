import { o as __toESM } from "../_runtime.mjs";
import { i as require_react } from "../_libs/dnd-kit__accessibility+react.mjs";
import { i as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { c as useAppSettings, i as IthLogo, l as useBranding, o as supabase } from "./ith-brand-DH88OzsJ.mjs";
import { y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { T as LoaderCircle, b as Moon, o as Sun } from "../_libs/lucide-react.mjs";
import { t as useTheme } from "./use-theme-eySlBD0O.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/login-NwLr9C5r.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function LoginPage() {
	const navigate = useNavigate();
	const { poweredBy } = useBranding();
	const { theme, toggle: toggleTheme } = useTheme(useAppSettings().default_appearance);
	const [email, setEmail] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [showPassword, setShowPassword] = (0, import_react.useState)(false);
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)("");
	const [attempts, setAttempts] = (0, import_react.useState)(0);
	const [lockoutUntil, setLockoutUntil] = (0, import_react.useState)(null);
	async function handleSubmit(e) {
		e.preventDefault();
		if (lockoutUntil && Date.now() < lockoutUntil) {
			const remaining = Math.ceil((lockoutUntil - Date.now()) / 1e3);
			setError(`Too many failed attempts. Please try again in ${remaining} seconds.`);
			return;
		}
		setError("");
		setLoading(true);
		try {
			const { error: authError } = await supabase.auth.signInWithPassword({
				email,
				password
			});
			if (authError) {
				const nextAttempts = attempts + 1;
				setAttempts(nextAttempts);
				if (nextAttempts >= 3) {
					const delay = Math.pow(2, nextAttempts - 3) * 5e3;
					setLockoutUntil(Date.now() + delay);
				}
				setError("Invalid credentials. Please try again.");
				return;
			}
			setAttempts(0);
			setLockoutUntil(null);
			const { data: { user } } = await supabase.auth.getUser();
			if (user) {
				const { data: admin } = await supabase.from("admin_users").select("id").eq("user_id", user.id).eq("is_active", true).maybeSingle();
				if (!admin) {
					await supabase.auth.signOut();
					setError("Invalid credentials. Please try again.");
					return;
				}
				await supabase.from("audit_logs").insert({
					action: "admin.login",
					entity: "auth",
					entity_id: user.id,
					metadata: { email: user.email }
				});
			}
			navigate({ to: "/dashboard" });
		} finally {
			setLoading(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen grid place-items-center bg-sidebar text-sidebar-foreground px-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			onClick: toggleTheme,
			title: `Switch to ${theme === "dark" ? "light" : "dark"} mode`,
			"aria-label": "Toggle theme",
			className: "fixed top-4 right-4 h-9 w-9 grid place-items-center rounded-full border border-sidebar-border text-sidebar-foreground/80 hover:bg-white/5 hover:text-sidebar-foreground transition-colors",
			children: theme === "dark" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sun, { className: "h-4 w-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Moon, { className: "h-4 w-4" })
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-sm animate-fade-up",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-8 flex justify-center",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IthLogo, { size: 56 })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-2xl border border-border/60 bg-card text-card-foreground p-8 shadow-2xl shadow-black/20",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "text-2xl font-semibold text-center mb-1",
							children: "Administrator Login"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted-foreground text-center mb-6",
							children: "ITH-FORMS Control Panel"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
							onSubmit: handleSubmit,
							className: "space-y-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-sm font-medium text-foreground",
										htmlFor: "email",
										children: "Email address"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										id: "email",
										type: "email",
										inputMode: "email",
										autoComplete: "email",
										value: email,
										onChange: (e) => setEmail(e.target.value),
										required: true,
										className: "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring",
										placeholder: "you@innotech-hub.org"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-sm font-medium text-foreground",
										htmlFor: "password",
										children: "Password"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "relative",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											id: "password",
											type: showPassword ? "text" : "password",
											autoComplete: "current-password",
											value: password,
											onChange: (e) => setPassword(e.target.value),
											required: true,
											className: "h-10 w-full rounded-md border border-input bg-background px-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring",
											placeholder: "Enter your password"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => setShowPassword(!showPassword),
											className: "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-secondary transition-colors",
											"aria-label": showPassword ? "Hide password" : "Show password",
											children: showPassword ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
												className: "h-4 w-4",
												fill: "none",
												viewBox: "0 0 24 24",
												stroke: "currentColor",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
													strokeLinecap: "round",
													strokeLinejoin: "round",
													strokeWidth: 2,
													d: "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
												})
											}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
												className: "h-4 w-4",
												fill: "none",
												viewBox: "0 0 24 24",
												stroke: "currentColor",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
													strokeLinecap: "round",
													strokeLinejoin: "round",
													strokeWidth: 2,
													d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
													strokeLinecap: "round",
													strokeLinejoin: "round",
													strokeWidth: 2,
													d: "M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
												})]
											})
										})]
									})]
								}),
								error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm text-destructive",
									role: "alert",
									children: error
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "submit",
									disabled: loading,
									className: "h-10 w-full rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60",
									children: [loading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }), loading ? "Signing in…" : "Sign In"]
								})
							]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-6 text-center text-[11px] text-muted-foreground",
					children: poweredBy
				})
			]
		})]
	});
}
//#endregion
export { LoginPage as component };
