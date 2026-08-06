import { o as __toESM } from "./_runtime.mjs";
import { i as require_react } from "./_libs/dnd-kit__accessibility+react.mjs";
import { i as require_jsx_runtime } from "./_libs/react+tanstack__react-query.mjs";
import { i as IthLogo, l as useBranding, o as supabase } from "./_ssr/ith-brand-DcxNWcJj.mjs";
import { l as useLocation } from "./_libs/@tanstack/react-router+[...].mjs";
import { B as CircleAlert, T as LoaderCircle, j as Eye, r as Upload, t as X } from "./_libs/lucide-react.mjs";
import { i as stringType } from "./_libs/zod.mjs";
import { a as fileSizeCheck, o as uuidv4, r as SubmitPayloadSchema } from "./_ssr/validation-Cb9MIurp.mjs";
import { t as themeContainerStyle } from "./_ssr/theme-utils-CZ5WP4IV.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_slug-BNSEMkjT.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var TEXT_TYPES = [
	"short_text",
	"email",
	"phone",
	"url",
	"number",
	"name",
	"address",
	"organization"
];
var FILE_TYPES = [
	"file",
	"document",
	"image"
];
var PREFILL_TYPES = [...TEXT_TYPES, "long_text"];
var PREFILL_MAX_LEN = 500;
var RESERVED_PARAMS = /* @__PURE__ */ new Set(["preview", "draft"]);
function normalizeKey(s) {
	return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function buildPrefillAnswers(searchStr, questions) {
	const params = new URLSearchParams(searchStr);
	const out = {};
	const candidates = questions.filter((q) => PREFILL_TYPES.includes(q.type));
	for (const [rawKey, rawValue] of params.entries()) {
		const key = normalizeKey(rawKey);
		if (!key || RESERVED_PARAMS.has(key)) continue;
		const value = rawValue.slice(0, PREFILL_MAX_LEN).trim();
		if (!value) continue;
		const free = (q) => !(q.id in out);
		const target = candidates.find((q) => q.type === key && free(q)) ?? candidates.find((q) => normalizeKey(q.label) === key && free(q)) ?? (key.length >= 3 ? candidates.find((q) => normalizeKey(q.label).includes(key) && free(q)) : void 0);
		if (target) out[target.id] = value;
	}
	return out;
}
function parseGrid(v) {
	if (!v) return {};
	try {
		const o = JSON.parse(v);
		return o && typeof o === "object" && !Array.isArray(o) ? o : {};
	} catch {
		return {};
	}
}
function readPreviewDraft(key, formId) {
	try {
		const raw = sessionStorage.getItem(key);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (parsed.form?.id !== formId) return null;
		if (!Array.isArray(parsed.sections) || !Array.isArray(parsed.questions)) return null;
		if (typeof parsed.createdAt !== "number" || Date.now() - parsed.createdAt > 1800 * 1e3) return null;
		return parsed;
	} catch {
		return null;
	}
}
function PublicForm() {
	const { pathname } = useLocation();
	const slug = pathname.replace(/^\/forms\//, "").replace(/\.html$/, "");
	const searchStr = typeof window !== "undefined" ? window.location.search : "";
	const isPreview = new URLSearchParams(searchStr).has("preview");
	const previewDraftKey = new URLSearchParams(searchStr).get("draft");
	const [formState, setFormState] = (0, import_react.useState)("loading");
	const [form, setForm] = (0, import_react.useState)(null);
	const [theme, setTheme] = (0, import_react.useState)(null);
	const [sections, setSections] = (0, import_react.useState)([]);
	const [questions, setQuestions] = (0, import_react.useState)([]);
	const [step, setStep] = (0, import_react.useState)(0);
	const [answers, setAnswers] = (0, import_react.useState)({});
	const [errors, setErrors] = (0, import_react.useState)({});
	const [referenceId, setReferenceId] = (0, import_react.useState)(null);
	const [uploadWarnings, setUploadWarnings] = (0, import_react.useState)([]);
	const [confirmEmail, setConfirmEmail] = (0, import_react.useState)(null);
	const [consentAgreed, setConsentAgreed] = (0, import_react.useState)(false);
	const [previewAuthorized, setPreviewAuthorized] = (0, import_react.useState)(false);
	const submitGuard = (0, import_react.useRef)(false);
	const idempotencyKey = (0, import_react.useRef)(uuidv4());
	(0, import_react.useEffect)(() => {
		if (!slug) return;
		loadForm();
	}, [slug]);
	async function isAdminSession() {
		const { data } = await supabase.auth.getUser();
		if (!data.user) return false;
		const { data: admin } = await supabase.from("admin_users").select("id").eq("user_id", data.user.id).eq("is_active", true).maybeSingle();
		return !!admin;
	}
	async function loadForm() {
		setFormState("loading");
		const authorized = isPreview ? await isAdminSession() : false;
		setPreviewAuthorized(authorized);
		const { data: f, error } = await supabase.from("forms").select("id,title,description,status,opens_at,closes_at,max_responses,response_count,allow_anonymous,consent_text,confirmation_title,confirmation_message").eq("slug", slug).is("deleted_at", null).maybeSingle();
		if (error || !f) {
			setFormState("unavailable");
			return;
		}
		if (f.status !== "published" && !authorized) {
			setFormState("unavailable");
			return;
		}
		if (!authorized) {
			const now = /* @__PURE__ */ new Date();
			if (f.opens_at && new Date(f.opens_at) > now) {
				setForm(f);
				setFormState("upcoming");
				return;
			}
			if (f.closes_at && new Date(f.closes_at) < now) {
				setForm(f);
				setFormState("closed");
				return;
			}
			if (f.max_responses && f.response_count >= f.max_responses) {
				setFormState("limit");
				return;
			}
		}
		const [sRes, qRes, tRes] = await Promise.all([
			supabase.from("form_sections").select("*").eq("form_id", f.id).order("position"),
			supabase.from("form_questions").select("*").eq("form_id", f.id).order("position"),
			supabase.from("form_themes").select("*").eq("form_id", f.id).maybeSingle()
		]);
		if (sRes.error) {
			console.error("sections error:", sRes.error);
			setFormState("unavailable");
			return;
		}
		if (qRes.error) {
			console.error("questions error:", qRes.error);
			setFormState("unavailable");
			return;
		}
		if (tRes.error) {
			console.error("themes error:", tRes.error);
			setFormState("unavailable");
			return;
		}
		let loadedForm = f;
		let loadedSections = sRes.data ?? [];
		let loadedQuestions = qRes.data ?? [];
		if (authorized && previewDraftKey) {
			const draft = readPreviewDraft(previewDraftKey, loadedForm.id);
			if (draft) {
				loadedForm = draft.form;
				loadedSections = draft.sections;
				loadedQuestions = draft.questions;
			}
		}
		const knownIds = new Set(loadedSections.map((s) => s.id));
		const firstId = loadedSections[0]?.id;
		if (firstId) loadedQuestions = loadedQuestions.map((q) => knownIds.has(q.section_id) ? q : {
			...q,
			section_id: firstId
		});
		setForm(loadedForm);
		setSections(loadedSections);
		setQuestions(loadedQuestions);
		setTheme(tRes.data ?? null);
		setStep(0);
		setConsentAgreed(false);
		const prefill = buildPrefillAnswers(searchStr, loadedQuestions);
		if (Object.keys(prefill).length > 0) setAnswers((prev) => ({
			...prefill,
			...prev
		}));
		setFormState("ready");
	}
	const setAnswer = import_react.useCallback((questionId, value) => {
		setAnswers((prev) => ({
			...prev,
			[questionId]: value
		}));
		setErrors((prev) => {
			if (prev[questionId]) {
				const n = { ...prev };
				delete n[questionId];
				return n;
			}
			return prev;
		});
	}, []);
	const stepSections = sections;
	const multi = stepSections.length > 1;
	const safeStep = Math.min(step, Math.max(0, stepSections.length - 1));
	function requiredMissing(q) {
		if (!q.required) return false;
		if ([
			"section_heading",
			"information_paragraph",
			"hidden"
		].includes(q.type)) return false;
		const val = answers[q.id];
		if (q.type === "grid") {
			const rows = q.config?.rows ?? [];
			const grid = parseGrid(val);
			return rows.some((r) => !grid[r]);
		}
		return !val || typeof val === "string" && !val.trim() || Array.isArray(val) && val.length === 0;
	}
	function formatError(q, raw) {
		const val = raw.trim();
		if (!val) return null;
		if (q.type === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) ? null : "Please enter a complete email address (e.g., user@domain.com)";
		if (q.type === "url") {
			const withProto = /^https?:\/\//i.test(val) ? val : `https://${val}`;
			return stringType().url().safeParse(withProto).success && /\.[a-z]{2,}/i.test(val) ? null : "Please enter a valid website (e.g., www.example.com)";
		}
		if (q.type === "phone") {
			const digits = val.replace(/[\s\-().]/g, "");
			return /^\+?\d{7,15}$/.test(digits) ? null : "Please enter a valid phone number";
		}
		if (q.type === "number") {
			const n = val.replace(/[,\s]/g, "");
			return /^-?\d*\.?\d+$/.test(n) ? null : "Please enter a valid number";
		}
		return null;
	}
	function collectErrors(qs) {
		const errs = {};
		for (const q of qs) {
			if (requiredMissing(q)) {
				errs[q.id] = "This field is required";
				continue;
			}
			const value = answers[q.id];
			const cfg = q.config ?? {};
			if (typeof value === "string" && value.trim() && (q.type === "short_text" || q.type === "long_text")) {
				const len = value.trim().length;
				if (cfg.minLength && len < cfg.minLength) {
					errs[q.id] = `Please enter at least ${cfg.minLength} characters`;
					continue;
				}
				if (cfg.maxLength && len > cfg.maxLength) {
					errs[q.id] = `Please keep it under ${cfg.maxLength} characters`;
					continue;
				}
			}
			if (q.type === "checkbox" && Array.isArray(value)) {
				const count = value.length;
				if (cfg.minSelections && count < cfg.minSelections) {
					errs[q.id] = `Please select at least ${cfg.minSelections}`;
					continue;
				}
				if (cfg.maxSelections && count > cfg.maxSelections) {
					errs[q.id] = `Please select no more than ${cfg.maxSelections}`;
					continue;
				}
			}
			if (typeof value === "string") {
				const fe = formatError(q, value);
				if (fe) errs[q.id] = fe;
			}
		}
		return errs;
	}
	function validate() {
		const errs = collectErrors(questions);
		if (form?.consent_text && !consentAgreed) errs.__consent = "You must agree before submitting";
		setErrors(errs);
		if (multi && Object.keys(errs).length > 0) {
			const idx = stepSections.findIndex((s) => questions.some((q) => q.section_id === s.id && errs[q.id]));
			if (idx >= 0) setStep(idx);
		}
		return Object.keys(errs).length === 0;
	}
	function validateCurrentSection() {
		const sec = stepSections[safeStep];
		if (!sec) return true;
		const secQs = questions.filter((q) => q.section_id === sec.id);
		const errs = collectErrors(secQs);
		setErrors((prev) => {
			const next = { ...prev };
			for (const q of secQs) delete next[q.id];
			return {
				...next,
				...errs
			};
		});
		return Object.keys(errs).length === 0;
	}
	function nextStep() {
		if (!previewAuthorized && !validateCurrentSection()) {
			setTimeout(() => document.querySelector("[data-error]")?.scrollIntoView({
				behavior: "smooth",
				block: "center"
			}), 50);
			return;
		}
		setStep((s) => Math.min(s + 1, stepSections.length - 1));
		window.scrollTo({
			top: 0,
			behavior: "smooth"
		});
	}
	function preventImplicitSubmit(e) {
		const target = e.target;
		if (e.key !== "Enter") return;
		if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;
		e.preventDefault();
	}
	async function handleSubmit(e) {
		e.preventDefault();
		if (e.nativeEvent.submitter?.dataset.publicSubmit !== "true") return;
		if (previewAuthorized) {
			setErrors({ __form: "Preview mode — submissions are disabled." });
			return;
		}
		if (multi && safeStep < stepSections.length - 1) return;
		if (submitGuard.current || !form) return;
		if (!validate()) {
			document.querySelector("[data-error]")?.scrollIntoView({
				behavior: "smooth",
				block: "center"
			});
			return;
		}
		submitGuard.current = true;
		setFormState("submitting");
		const nameQ = questions.find((q) => q.type === "name");
		const emailQ = questions.find((q) => q.type === "email");
		const respondentName = nameQ ? answers[nameQ.id] ?? null : null;
		const respondentEmail = emailQ ? answers[emailQ.id] ?? null : null;
		const answerPayload = questions.filter((q) => ![
			"section_heading",
			"information_paragraph",
			"hidden",
			...FILE_TYPES
		].includes(q.type)).flatMap((q) => {
			const v = answers[q.id];
			if (v == null || Array.isArray(v) && v.length === 0) return [];
			const value = Array.isArray(v) ? v.join("||") : String(v);
			return value.trim() ? [{
				question_id: q.id,
				value
			}] : [];
		});
		if (!SubmitPayloadSchema.safeParse({
			form_id: form.id,
			answers: answerPayload
		}).success) {
			setFormState("ready");
			submitGuard.current = false;
			setErrors({ __form: "Submission failed validation. Please review your answers." });
			return;
		}
		const { data: rpcData, error: rpcErr } = await supabase.rpc("submit_response", {
			p_form_id: form.id,
			p_name: respondentName,
			p_email: respondentEmail,
			p_idempotency_key: idempotencyKey.current,
			p_answers: answerPayload
		});
		const result = rpcData;
		if (rpcErr || !result?.submission_id) {
			console.error("[submit] RPC error:", rpcErr, "result:", result);
			const msg = rpcErr?.message ?? "";
			const friendly = msg.includes("form_not_open") ? "This form is not open yet." : msg.includes("form_closed") ? "This form is no longer accepting responses." : msg.includes("limit_reached") ? "This form has reached its response limit. Please contact the organiser." : msg.includes("form_unavailable") ? "This form is not available." : msg.includes("invalid_payload") ? "Some answers couldn't be processed. Please review and try again." : msg.includes("invalid_scale_value") || msg.includes("scale_value_out_of_range") ? "A rating or scale value is invalid. Please check your answers." : rpcErr?.code === "PGRST202" || rpcErr?.code === "PGRST203" || msg.includes("submit_response") ? "The submission service is being upgraded. Please try again in a few minutes." : `Submission failed. Please try again.${rpcErr?.message ? ` (${rpcErr.message})` : ""}`;
			setFormState("ready");
			submitGuard.current = false;
			setErrors({ __form: friendly });
			return;
		}
		const failedUploads = [];
		const successByQuestion = {};
		for (const q of questions.filter((q) => FILE_TYPES.includes(q.type))) {
			const files = answers[q.id] ?? [];
			for (const file of files) {
				const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
				const path = `${result.submission_id}/${q.id}/${Date.now()}-${safeFileName}`;
				const { error: upErr } = await supabase.storage.from("submission-files").upload(path, file);
				if (upErr) {
					console.error(`[upload-error] ${q.label}/${file.name}:`, upErr);
					const errorMsg = upErr.message?.includes("Payload too large") ? `${q.label}: ${file.name} is too large` : upErr.message?.includes("bucket_not_found") ? `${q.label}: Upload service temporarily unavailable` : `${q.label}: ${file.name}`;
					failedUploads.push(errorMsg);
					continue;
				}
				const { error: regErr } = await supabase.rpc("register_submission_file", {
					p_submission_id: result.submission_id,
					p_question_id: q.id,
					p_file_path: path,
					p_file_name: safeFileName,
					p_file_size: file.size,
					p_mime_type: file.type
				});
				if (regErr) {
					console.error(`[register-error] ${q.label}/${file.name}:`, regErr);
					failedUploads.push(`${q.label}: ${file.name} (registration failed)`);
					await supabase.storage.from("submission-files").remove([path]);
					continue;
				}
				successByQuestion[q.id] = (successByQuestion[q.id] ?? 0) + 1;
			}
		}
		if (questions.some((q) => FILE_TYPES.includes(q.type) && q.required && !(successByQuestion[q.id] > 0))) {
			setFormState("ready");
			submitGuard.current = false;
			setErrors({ __form: "Your file didn't finish uploading. Please click Submit again to retry." });
			return;
		}
		setUploadWarnings(failedUploads);
		setConfirmEmail(respondentEmail);
		setReferenceId(result.reference_id);
		setFormState("done");
	}
	const bgUrl = theme?.bg_image_path ? supabase.storage.from("form-assets").getPublicUrl(theme.bg_image_path).data.publicUrl : null;
	if (formState === "loading") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex justify-center py-16",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "animate-spin text-primary" })
	}) });
	if (formState === "unavailable") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StateCard, {
		icon: "🚫",
		title: "Form Unavailable",
		message: "This form is not available. Please check the link and try again."
	}) });
	if (formState === "upcoming" && form) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StateCard, {
		icon: "🕐",
		title: "Not Open Yet",
		message: `This form opens on ${new Date(form.opens_at).toLocaleString()}.`
	}) });
	if (formState === "closed") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StateCard, {
		icon: "🔒",
		title: "Form Closed",
		message: "This form is no longer accepting responses."
	}) });
	if (formState === "limit") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StateCard, {
		icon: "📋",
		title: "Responses Full",
		message: "This form has reached its maximum number of responses."
	}) });
	if (formState === "done" && form) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, {
		form,
		theme,
		bgUrl,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: `rounded-2xl border p-10 ${bgUrl ? "backdrop-blur-lg bg-card/75 border-white/20 shadow-xl" : "border-border/60 bg-card"}`,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-center mb-8",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-4xl mb-4",
							children: "✅"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-2xl font-bold mb-2",
							children: form.confirmation_title ?? "Thank you!"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted-foreground mb-6",
							children: form.confirmation_message ?? "Your response has been received."
						}),
						referenceId && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "inline-block bg-primary/10 border border-primary/30 rounded-xl px-6 py-4 mb-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted-foreground mb-1",
									children: "Your reference ID"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-2xl font-bold font-mono tracking-wider text-primary",
									children: referenceId
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted-foreground mt-1",
									children: "Keep this for your records"
								})
							]
						}),
						confirmEmail && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs text-muted-foreground mt-4",
							children: [
								"Your reference ID is linked to ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-semibold text-foreground",
									children: confirmEmail
								}),
								" — we'll use it for any follow-up about this submission."
							]
						}),
						referenceId && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-6 p-4 rounded-lg border border-border bg-secondary/20",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm font-medium mb-2",
									children: "View your submission anytime"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
									href: `/view-response/${referenceId}`,
									className: "text-sm text-primary hover:underline break-all",
									target: "_blank",
									rel: "noopener noreferrer",
									children: [
										typeof window !== "undefined" ? window.location.origin : "",
										"/view-response/",
										referenceId
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted-foreground mt-2",
									children: "Save this link to review your answers later"
								})
							]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "border-t border-border pt-8",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-lg font-semibold mb-4",
						children: "Your Submitted Answers"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-4",
						children: questions.filter((q) => ![
							"section_heading",
							"information_paragraph",
							"hidden"
						].includes(q.type)).map((q) => {
							const answer = answers[q.id];
							if (!answer) return null;
							let displayValue;
							if (Array.isArray(answer)) if (answer.length > 0 && answer[0] instanceof File) displayValue = answer.map((f) => f.name).join(", ");
							else displayValue = answer.join(", ");
							else displayValue = String(answer);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "pb-4 border-b border-border/40 last:border-0",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "font-semibold text-sm mb-1 text-foreground",
										children: q.label
									}),
									q.description && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-muted-foreground mb-2",
										children: q.description
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm text-muted-foreground",
										children: displayValue || "(No answer)"
									})
								]
							}, q.id);
						})
					})]
				}),
				uploadWarnings.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 text-left rounded-lg border border-orange-500/40 bg-orange-500/10 p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "flex items-center gap-2 text-sm font-semibold text-orange-500 mb-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { className: "h-4 w-4 shrink-0" }), " Some files could not be uploaded"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted-foreground mb-2",
							children: "Your submission was recorded, but the following attachments failed. Please email them to the organiser quoting your reference ID above."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "text-xs text-muted-foreground list-disc list-inside space-y-0.5",
							children: uploadWarnings.map((w, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: w }, i))
						})
					]
				})
			]
		})
	});
	if (!form) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, {
		form,
		theme,
		bgUrl,
		children: [previewAuthorized && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/30 p-3 text-sm text-primary",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "h-4 w-4 shrink-0" }), "Preview mode — this is how respondents will see the form. Navigate freely; submissions are disabled."]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			onSubmit: handleSubmit,
			onKeyDown: preventImplicitSubmit,
			noValidate: true,
			className: "space-y-6",
			children: [
				errors.__form && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					"data-error": true,
					className: "flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { className: "h-4 w-4 shrink-0" }), errors.__form]
				}),
				multi && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex justify-between text-xs text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
							"Step ",
							safeStep + 1,
							" of ",
							stepSections.length
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: stepSections[safeStep]?.title })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "h-1.5 rounded-full bg-secondary overflow-hidden",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "h-full bg-primary transition-all duration-300",
							style: { width: `${(safeStep + 1) / stepSections.length * 100}%` }
						})
					})]
				}),
				(multi ? stepSections.slice(safeStep, safeStep + 1) : stepSections).map((sec) => {
					const sectionQs = questions.filter((q) => q.section_id === sec.id);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border-b border-border/40 pb-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-semibold text-lg",
								children: sec.title
							}), sec.description && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-muted-foreground",
								children: sec.description
							})]
						}), sectionQs.map((q) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MemoQuestionField, {
							question: q,
							value: answers[q.id],
							error: errors[q.id],
							onChange: setAnswer
						}, q.id))]
					}, sec.id);
				}),
				(!multi || safeStep === stepSections.length - 1) && form.consent_text && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex items-start gap-3 rounded-lg border border-border/60 bg-secondary/20 p-4 cursor-pointer",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "checkbox",
						checked: consentAgreed,
						onChange: (e) => {
							setConsentAgreed(e.target.checked);
							if (e.target.checked) setErrors((prev) => {
								const next = { ...prev };
								delete next.__consent;
								return next;
							});
						},
						className: "mt-0.5 accent-primary rounded shrink-0"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs text-muted-foreground",
						children: form.consent_text
					})]
				}),
				errors.__consent && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-destructive flex items-center gap-1 -mt-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { className: "h-3 w-3" }), errors.__consent]
				}),
				multi ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-3",
					children: [safeStep > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => {
							setStep(Math.max(0, safeStep - 1));
							window.scrollTo({
								top: 0,
								behavior: "smooth"
							});
						},
						className: "px-6 h-11 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors",
						children: "← Back"
					}), safeStep < stepSections.length - 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: (e) => {
							e.preventDefault();
							nextStep();
						},
						className: "flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors",
						children: "Next →"
					}, "step-next") : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "submit",
						"data-public-submit": "true",
						disabled: formState === "submitting",
						className: "flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60 transition-colors",
						children: formState === "submitting" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }), " Submitting…"] }) : "Submit"
					}, "step-submit")]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "submit",
					"data-public-submit": "true",
					disabled: formState === "submitting",
					className: "w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60 transition-colors",
					children: formState === "submitting" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }), " Submitting…"] }) : "Submit"
				})
			]
		})]
	});
}
function Shell({ children, form, theme, bgUrl }) {
	const style = themeContainerStyle(theme ?? null, bgUrl);
	const widthStyle = theme?.form_width ? { maxWidth: Number(theme.form_width) } : void 0;
	const glassEffect = bgUrl ? "backdrop-blur-xl bg-card/70 border-white/20 shadow-2xl" : "bg-card border-border/40 shadow-sm";
	const { appName, poweredBy } = useBranding();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen bg-background text-foreground",
		style,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
				className: "border-b border-border/60 bg-card/80 backdrop-blur sticky top-0 z-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "max-w-2xl mx-auto px-4 py-3 flex items-center gap-3",
					style: widthStyle,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IthLogo, {
						size: 28,
						withWordmark: false
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-sm font-semibold",
						children: appName
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
				className: "max-w-2xl mx-auto px-4 py-8 animate-fade-up",
				style: widthStyle,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: `rounded-2xl border p-5 sm:p-7 space-y-6 transition-all ${glassEffect}`,
					children: [form && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-3xl font-bold mb-1",
						children: form.title
					}), form.description && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted-foreground text-sm",
						children: form.description
					})] }), children]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
				className: "mt-16 border-t border-border/40 py-4 text-center text-xs text-muted-foreground",
				children: poweredBy
			})
		]
	});
}
function StateCard({ icon, title, message }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl border border-border/60 backdrop-blur-md bg-card/80 p-10 text-center shadow-lg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-4xl mb-4",
				children: icon
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-xl font-bold mb-2",
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: message
			})
		]
	});
}
var MemoQuestionField = import_react.memo(function MemoQuestionField({ question: q, value, error, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QuestionField, {
		question: q,
		value,
		error,
		onChange: (v) => onChange(q.id, v)
	});
}, (prev, next) => {
	return prev.question === next.question && prev.value === next.value && prev.error === next.error && prev.onChange === next.onChange;
});
function QuestionField({ question: q, value, error, onChange }) {
	if (q.type === "section_heading") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-2 pt-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
			className: "font-semibold text-base",
			children: q.label
		}), q.description && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs text-muted-foreground",
			children: q.description
		})]
	});
	if (q.type === "information_paragraph") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "text-sm text-muted-foreground rounded-lg bg-secondary/30 p-3",
		children: q.label
	});
	if (q.type === "hidden") return null;
	const baseInput = "w-full rounded-lg border bg-background px-4 py-3 text-base placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors " + (error ? "border-destructive" : "border-input");
	const inputTypeFor = {
		email: "email",
		phone: "tel",
		number: "number",
		url: "url"
	};
	const ariaProps = error ? {
		"aria-invalid": true,
		"aria-describedby": `error-${q.id}`
	} : {};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		"data-error": error ? true : void 0,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				htmlFor: `input-${q.id}`,
				className: "block text-lg font-bold text-foreground mb-2",
				children: [q.label, q.required && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-destructive ml-1",
					children: "*"
				})]
			}),
			q.description && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground mb-3",
				children: q.description
			}),
			q.config?.media && (() => {
				const mediaUrl = supabase.storage.from("form-assets").getPublicUrl(q.config.media.path).data.publicUrl;
				return q.config.media.kind === "image" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: mediaUrl,
					alt: "",
					className: "mb-3 rounded-xl border border-border/40 max-h-72 w-auto object-contain"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
					src: mediaUrl,
					controls: true,
					playsInline: true,
					className: "mb-3 rounded-xl border border-border/40 max-h-72 w-full"
				});
			})(),
			TEXT_TYPES.includes(q.type) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				id: `input-${q.id}`,
				type: inputTypeFor[q.type] ?? "text",
				value: value ?? "",
				onChange: (e) => onChange(e.target.value),
				placeholder: q.placeholder ?? "",
				className: baseInput + " h-10",
				...ariaProps
			}),
			q.type === "long_text" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
				id: `input-${q.id}`,
				value: value ?? "",
				onChange: (e) => onChange(e.target.value),
				placeholder: q.placeholder ?? "",
				rows: 4,
				className: baseInput + " resize-none",
				...ariaProps
			}),
			q.type === "date" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				id: `input-${q.id}`,
				type: "date",
				value: value ?? "",
				onChange: (e) => onChange(e.target.value),
				className: baseInput + " h-10",
				...ariaProps
			}),
			q.type === "time" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				id: `input-${q.id}`,
				type: "time",
				value: value ?? "",
				onChange: (e) => onChange(e.target.value),
				className: baseInput + " h-10",
				...ariaProps
			}),
			q.type === "datetime" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				id: `input-${q.id}`,
				type: "datetime-local",
				value: value ?? "",
				onChange: (e) => onChange(e.target.value),
				className: baseInput + " h-10",
				...ariaProps
			}),
			q.type === "dropdown" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
					id: `input-${q.id}`,
					value: value ?? "",
					onChange: (e) => onChange(e.target.value),
					className: baseInput + " h-11 appearance-none pr-10 cursor-pointer truncate",
					...ariaProps,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "",
						children: "Select an option…"
					}), (q.options ?? []).map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: o.value,
						children: o.label
					}, o.value))]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
					"aria-hidden": "true",
					viewBox: "0 0 20 20",
					fill: "none",
					className: "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
						d: "M6 8l4 4 4-4",
						stroke: "currentColor",
						strokeWidth: "1.5",
						strokeLinecap: "round",
						strokeLinejoin: "round"
					})
				})]
			}),
			(q.type === "radio" || q.type === "poll") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
				className: "space-y-2",
				...ariaProps,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
					className: "sr-only",
					children: q.label
				}), (q.options ?? []).map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex items-center gap-2 cursor-pointer text-sm",
					htmlFor: `${q.id}-${o.value}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						id: `${q.id}-${o.value}`,
						type: "radio",
						name: q.id,
						value: o.value,
						checked: value === o.value,
						onChange: () => onChange(o.value),
						className: "accent-primary",
						"aria-label": `${q.label}: ${o.label}`
					}), o.label]
				}, o.value))]
			}),
			q.type === "checkbox" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
				className: "space-y-2",
				...ariaProps,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
					className: "sr-only",
					children: q.label
				}), (q.options ?? []).map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex items-center gap-2 cursor-pointer text-sm",
					htmlFor: `${q.id}-${o.value}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						id: `${q.id}-${o.value}`,
						type: "checkbox",
						checked: (value ?? []).includes(o.value),
						onChange: (e) => {
							const curr = value ?? [];
							onChange(e.target.checked ? [...curr, o.value] : curr.filter((v) => v !== o.value));
						},
						className: "accent-primary rounded",
						"aria-label": `${q.label}: ${o.label}`
					}), o.label]
				}, o.value))]
			}),
			q.type === "yes_no" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
				className: "flex gap-3",
				...ariaProps,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
					className: "sr-only",
					children: q.label
				}), ["Yes", "No"].map((opt) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => onChange(opt.toLowerCase()),
					className: `flex-1 h-10 rounded-lg border text-sm font-medium transition-colors ${value === opt.toLowerCase() ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-secondary"}`,
					children: opt
				}, opt))]
			}),
			q.type === "rating" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
				className: "flex gap-1.5 flex-wrap",
				...ariaProps,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
					className: "sr-only",
					children: q.label
				}), Array.from({ length: Math.max(2, Math.min(10, q.config?.ratingMax ?? 10)) }, (_, i) => i + 1).map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => onChange(String(n)),
					className: `h-10 w-10 rounded-lg border text-sm font-bold transition-colors ${value === String(n) ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-secondary"}`,
					"aria-label": `${q.label}: ${n}`,
					"aria-pressed": value === String(n),
					children: n
				}, n))]
			}),
			q.type === "linear_scale" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
				className: "flex gap-1.5 flex-wrap",
				...ariaProps,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
					className: "sr-only",
					children: q.label
				}), [
					1,
					2,
					3,
					4,
					5,
					6,
					7,
					8,
					9,
					10
				].map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => onChange(String(n)),
					className: `h-9 w-9 rounded-lg border text-xs font-semibold transition-colors ${value === String(n) ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-secondary"}`,
					"aria-label": `${q.label}: ${n}`,
					"aria-pressed": value === String(n),
					children: n
				}, n))]
			}),
			q.type === "grid" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "block text-lg font-bold text-foreground mb-3",
					children: [q.label, q.required && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-destructive ml-1",
						children: "*"
					})]
				}),
				q.description && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground mb-3",
					children: q.description
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "overflow-x-auto",
					role: "group",
					"aria-label": q.label,
					"aria-describedby": q.description ? `desc-${q.id}` : void 0,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "text-sm",
						role: "grid",
						"aria-label": `${q.label} - Multiple choice grid`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "p-2",
							scope: "row"
						}), (q.config?.cols ?? []).map((c, ci) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "p-2 text-xs font-medium text-center",
							scope: "col",
							children: c
						}, ci))] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: (q.config?.rows ?? []).map((r, ri) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-t border-border/40",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "p-2 text-xs font-medium whitespace-nowrap",
								scope: "row",
								children: r
							}), (q.config?.cols ?? []).map((c, ci) => {
								const grid = parseGrid(value);
								return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "p-2 text-center",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "radio",
										name: `${q.id}-${ri}`,
										className: "accent-primary",
										checked: grid[r] === c,
										onChange: () => onChange(JSON.stringify({
											...grid,
											[r]: c
										})),
										"aria-label": `${r}: ${c}`
									})
								}, ci);
							})]
						}, ri)) })]
					})
				})
			] }),
			FILE_TYPES.includes(q.type) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileUploader, {
				id: `input-${q.id}`,
				files: value ?? [],
				accept: (q.config?.accept ?? [
					".pdf",
					".docx",
					".jpg",
					".jpeg",
					".png"
				]).join(","),
				acceptExts: q.config?.accept ?? [
					".pdf",
					".docx",
					".jpg",
					".jpeg",
					".png"
				],
				maxSizeMB: q.config?.maxSizeMB ?? 10,
				onChange: (files) => onChange(files)
			}),
			q.type === "consent" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "flex items-start gap-2 cursor-pointer text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					id: `input-${q.id}`,
					type: "checkbox",
					checked: value === "agreed",
					onChange: (e) => onChange(e.target.checked ? "agreed" : ""),
					className: "mt-0.5 accent-primary rounded shrink-0",
					...ariaProps,
					"aria-label": `${q.label}: ${q.placeholder ?? "I agree to the terms above"}`
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: q.placeholder ?? "I agree to the terms above" })]
			}),
			error && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				id: `error-${q.id}`,
				className: "mt-1 text-xs text-destructive flex items-center gap-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { className: "h-3 w-3" }), error]
			})
		]
	});
}
function FileUploader({ files, accept, acceptExts, maxSizeMB, onChange, id }) {
	const ref = (0, import_react.useRef)(null);
	const [rejected, setRejected] = (0, import_react.useState)([]);
	function extAllowed(name) {
		const lower = name.toLowerCase();
		return acceptExts.some((ext) => lower.endsWith(ext.toLowerCase()));
	}
	function handleSelect(e) {
		const f = (e.target.files ?? [])[0];
		e.target.value = "";
		if (!f) return;
		if (!extAllowed(f.name)) {
			setRejected([`${f.name}: only ${acceptExts.join(", ")} allowed`]);
			return;
		}
		const sizeCheck = fileSizeCheck(f.size, maxSizeMB);
		if (!sizeCheck.ok) {
			setRejected([`${f.name}: ${sizeCheck.reason}`]);
			return;
		}
		setRejected([]);
		onChange([f]);
	}
	const hasFile = files.length > 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => ref.current?.click(),
				className: "flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-border hover:border-primary/60 text-sm text-muted-foreground hover:text-foreground transition-colors",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "h-4 w-4" }),
					" ",
					hasFile ? "Replace file" : "Upload file"
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-[11px] text-muted-foreground",
				children: [
					"Accepted: ",
					acceptExts.join(", "),
					" · one file, max ",
					maxSizeMB,
					" MB"
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				ref,
				id,
				type: "file",
				accept,
				hidden: true,
				onChange: handleSelect
			}),
			rejected.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs text-destructive flex items-center gap-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { className: "h-3 w-3 shrink-0" }), rejected.join(" · ")]
			}),
			files.map((f, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 text-xs text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "truncate max-w-xs",
					children: f.name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => onChange(files.filter((_, j) => j !== i)),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "h-3 w-3 hover:text-destructive" })
				})]
			}, i))
		]
	});
}
//#endregion
export { buildPrefillAnswers, PublicForm as component };
