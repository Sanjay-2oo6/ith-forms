import { i as stringType, n as enumType, r as objectType, t as arrayType } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/validation-Cb9MIurp.js
function uuidv4() {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
	const bytes = /* @__PURE__ */ new Uint8Array(16);
	if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") crypto.getRandomValues(bytes);
	else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
	bytes[6] = bytes[6] & 15 | 64;
	bytes[8] = bytes[8] & 63 | 128;
	const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
	return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
}
var SubmitPayloadSchema = objectType({
	form_id: stringType().uuid(),
	answers: arrayType(objectType({
		question_id: stringType().uuid(),
		value: stringType().max(2e4)
	})).max(50)
});
var FormCreateSchema = objectType({
	title: stringType().trim().min(3, "Title must be at least 3 characters").max(150, "Title must be 150 characters or fewer"),
	slug: stringType().trim().min(3, "Slug must be at least 3 characters").max(80, "Slug must be 80 characters or fewer").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug may only contain lowercase letters, numbers, and single hyphens (no leading/trailing hyphen)"),
	description: stringType().trim().max(1e3, "Description must be 1000 characters or fewer").optional(),
	category: stringType().trim().max(50).optional()
});
function fieldErrors(err) {
	const out = {};
	for (const issue of err.issues) {
		const key = String(issue.path[0] ?? "_form");
		if (!out[key]) out[key] = issue.message;
	}
	return out;
}
var AppSettingsSchema = objectType({
	app_name: stringType().trim().min(2, "Application name must be at least 2 characters").max(60, "Application name must be 60 characters or fewer"),
	org_name: stringType().trim().min(2, "Organization name must be at least 2 characters").max(80, "Organization name must be 80 characters or fewer"),
	powered_by: stringType().trim().min(2, "Powered-by text must be at least 2 characters").max(100, "Powered-by text must be 100 characters or fewer"),
	default_appearance: enumType([
		"light",
		"dark",
		"system"
	]),
	default_confirmation_message: stringType().trim().min(5, "Confirmation message must be at least 5 characters").max(500, "Confirmation message must be 500 characters or fewer")
});
function fileSizeCheck(fileSize, maxSizeMB) {
	if (fileSize > maxSizeMB * 1024 * 1024) return {
		ok: false,
		reason: `exceeds the ${maxSizeMB} MB limit`
	};
	return { ok: true };
}
//#endregion
export { fileSizeCheck as a, fieldErrors as i, FormCreateSchema as n, uuidv4 as o, SubmitPayloadSchema as r, AppSettingsSchema as t };
