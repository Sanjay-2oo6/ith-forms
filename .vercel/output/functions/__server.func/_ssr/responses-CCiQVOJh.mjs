import { o as __toESM } from "../_runtime.mjs";
import { o as supabase } from "./ith-brand-DcxNWcJj.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/responses-CCiQVOJh.js
function safeCell(v) {
	if (typeof v !== "string") return v;
	const stripped = v.replace(/^[\s\t\r\n]+/, "");
	if (/^[=+\-@|%]/.test(stripped)) return `'${v}`;
	if (v.includes("__proto__") || v.includes("constructor") || v.includes("prototype")) return v.replace(/__proto__|constructor|prototype/g, "_sanitized_");
	return v;
}
function safeRow(row) {
	return Object.fromEntries(Object.entries(row).map(([k, val]) => [k, safeCell(val)]));
}
var CHOICE_ANSWER_TYPES = [
	"dropdown",
	"radio",
	"poll",
	"checkbox",
	"yes_no"
];
function displayAnswer(rawValue, questionType, valueToLabel) {
	if (rawValue == null || rawValue === "") return "";
	if (questionType === "consent") return rawValue === "agreed" ? "Agreed" : rawValue;
	if (questionType === "grid") try {
		const obj = JSON.parse(rawValue);
		return Object.entries(obj).map(([r, c]) => `${r}: ${c}`).join("; ");
	} catch {
		return rawValue;
	}
	if (!valueToLabel || !CHOICE_ANSWER_TYPES.includes(questionType)) return rawValue;
	const delimiter = rawValue.includes("||") ? "||" : ",";
	return rawValue.split(delimiter).map((v) => v.trim()).map((v) => valueToLabel[v] ?? v).join(", ");
}
var SUBMISSION_STATUSES = [
	"new",
	"under_review",
	"approved",
	"rejected",
	"more_info_required",
	"archived"
];
var EXPORT_BATCH = 1e3;
function dateFromParam(d) {
	if (!d) return null;
	return (/* @__PURE__ */ new Date(`${d}T00:00:00`)).toISOString();
}
function dateToParamExclusive(d) {
	if (!d) return null;
	const next = /* @__PURE__ */ new Date(`${d}T00:00:00`);
	next.setDate(next.getDate() + 1);
	return next.toISOString();
}
async function fetchTabular(formId, opts) {
	const baseArgs = {
		p_form_id: formId,
		p_limit: opts.limit,
		p_offset: opts.offset,
		p_search: opts.search.trim() || null,
		p_status: opts.status === "all" ? null : opts.status
	};
	const dateArgs = {
		p_date_from: dateFromParam(opts.dateFrom),
		p_date_to: dateToParamExclusive(opts.dateTo)
	};
	const hasDates = dateArgs.p_date_from !== null || dateArgs.p_date_to !== null;
	const { data, error } = await supabase.rpc("get_form_responses_tabular", hasDates ? {
		...baseArgs,
		...dateArgs
	} : baseArgs);
	if (error && hasDates && error.code === "PGRST202") {
		const retry = await supabase.rpc("get_form_responses_tabular", baseArgs);
		if (retry.error) throw new Error(retry.error.message);
		throw new DateFilterUnsupportedError(retry.data ?? {
			submissions: [],
			questions: [],
			total_count: 0
		});
	}
	if (error) throw new Error(error.message);
	return data ?? {
		submissions: [],
		questions: [],
		total_count: 0
	};
}
var DateFilterUnsupportedError = class extends Error {
	fallbackData;
	constructor(fallbackData) {
		super("Date filtering requires database migration 021_responses_date_filter.sql — showing unfiltered results.");
		this.fallbackData = fallbackData;
		this.name = "DateFilterUnsupportedError";
	}
};
async function fetchAllForExport(formId, filters) {
	const all = [];
	let offset = 0;
	let expected = Infinity;
	while (offset < expected) {
		const batch = await fetchTabular(formId, {
			limit: EXPORT_BATCH,
			offset,
			...filters
		});
		expected = batch.total_count;
		all.push(...batch.submissions);
		if (batch.submissions.length < 1e3) break;
		offset += EXPORT_BATCH;
	}
	return all;
}
function buildExportRows(exportSubs, questions, optionMap) {
	return exportSubs.map((s) => {
		const row = {
			"Reference ID": s.reference_id ?? "",
			"Status": s.status ?? "",
			"Respondent": s.respondent_name ?? "Anonymous",
			"Submitted At": new Date(s.submitted_at).toLocaleString()
		};
		for (const q of questions) {
			const answer = s.answers?.[q.id];
			let cellValue = "";
			if (answer) cellValue = displayAnswer(answer.value, q.type, optionMap[q.id]);
			else {
				const qFiles = s.files?.filter((f) => f.question_id === q.id) ?? [];
				if (qFiles.length > 0) cellValue = qFiles.map((f) => f.file_name).join(", ");
			}
			row[q.label] = cellValue;
		}
		return row;
	});
}
async function exportResponsesXlsx(opts) {
	const exportSubs = await fetchAllForExport(opts.formId, opts.filters);
	if (exportSubs.length === 0) return 0;
	const safe = buildExportRows(exportSubs, opts.questions, opts.optionMap).map(safeRow);
	const workbook = new (await (import("../_libs/exceljs+[...].mjs").then((n) => /* @__PURE__ */ __toESM(n.t())))).Workbook();
	const worksheet = workbook.addWorksheet("Responses");
	if (safe.length > 0) {
		const headers = Object.keys(safe[0]);
		worksheet.addRow(headers);
		const headerRow = worksheet.getRow(1);
		headerRow.font = { bold: true };
		headerRow.fill = {
			type: "pattern",
			pattern: "solid",
			fgColor: { argb: "FFE0E0E0" }
		};
	}
	safe.forEach((row) => {
		worksheet.addRow(Object.values(row));
	});
	worksheet.columns.forEach((column) => {
		let maxLength = 0;
		column.eachCell?.({ includeEmpty: true }, (cell) => {
			const cellLength = String(cell.value).length;
			if (cellLength > maxLength) maxLength = cellLength;
		});
		column.width = Math.min(maxLength + 2, 50);
	});
	const fileName = `${opts.slug ?? opts.formId}-responses.xlsx`;
	const buffer = await workbook.xlsx.writeBuffer();
	const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
	const url = window.URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	window.URL.revokeObjectURL(url);
	try {
		const storagePath = `exports/${opts.formId}/${fileName}`;
		const { error: upErr } = await supabase.storage.from("submission-files").upload(storagePath, blob, { upsert: true });
		if (!upErr) await supabase.from("submission_files").insert({
			form_id: opts.formId,
			submission_id: null,
			question_id: null,
			file_path: storagePath,
			file_name: fileName,
			file_size: blob.size,
			mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
		});
	} catch (err) {
		console.error("Failed to track export file:", err);
	}
	return exportSubs.length;
}
function buildOptionMap(rows) {
	const map = {};
	for (const q of rows) if (Array.isArray(q.options) && q.options.length) map[q.id] = Object.fromEntries(q.options.map((o) => [o.value, o.label]));
	return map;
}
//#endregion
export { exportResponsesXlsx as a, displayAnswer as i, SUBMISSION_STATUSES as n, fetchTabular as o, buildOptionMap as r, DateFilterUnsupportedError as t };
