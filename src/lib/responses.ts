import { supabase } from "@/integrations/supabase/client";
import { displayAnswer } from "@/lib/export-utils";

// Data layer for the admin Responses page: server-side fetch (search /
// status / date-range filters live in the get_form_responses_tabular RPC),
// batched export fetching, and XLSX export row shaping. Extracted from the
// route file so the export path and the table share one implementation.

export type ResponseQuestion = {
  id: string;
  label: string;
  type: string;
  position: number;
  section_title: string | null;
  section_position?: number;  // Added to track section order
};

export type ResponseAnswer = {
  value: string;
  question_label: string;
  question_type: string;
  question_position: number;
};

export type ResponseFileInfo = {
  question_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
};

export type ResponseSubmission = {
  id: string;
  reference_id: string;
  status: string;
  respondent_name: string | null;
  respondent_email: string | null;
  submitted_at: string;
  answers: Record<string, ResponseAnswer> | null;
  files: ResponseFileInfo[] | null;
};

export type TabularData = {
  submissions: ResponseSubmission[];
  questions: ResponseQuestion[];
  total_count: number;
};

export type ResponseFilters = {
  search: string;
  status: string;       // "all" or a submission_status value
  dateFrom: string;     // "" or yyyy-mm-dd (inclusive)
  dateTo: string;       // "" or yyyy-mm-dd (inclusive; converted to exclusive bound)
};

export const SUBMISSION_STATUSES = ["new","under_review","approved","rejected","more_info_required","archived"] as const;

export const PAGE_SIZE = 50;
export const EXPORT_BATCH = 1000;

// Convert the inclusive yyyy-mm-dd end date from the picker into the
// EXCLUSIVE timestamptz bound the RPC expects (start of the NEXT local day),
// so the entire end day is included whatever the timezone offset is.
function dateFromParam(d: string): string | null {
  if (!d) return null;
  return new Date(`${d}T00:00:00`).toISOString();
}
function dateToParamExclusive(d: string): string | null {
  if (!d) return null;
  const next = new Date(`${d}T00:00:00`);
  next.setDate(next.getDate() + 1);
  return next.toISOString();
}

export async function fetchTabular(
  formId: string,
  opts: { limit: number; offset: number } & ResponseFilters
): Promise<TabularData> {
  const baseArgs = {
    p_form_id: formId,
    p_limit: opts.limit,
    p_offset: opts.offset,
    p_search: opts.search.trim() || null,
    p_status: opts.status === "all" ? null : opts.status,
  };
  const dateArgs = {
    p_date_from: dateFromParam(opts.dateFrom),
    p_date_to: dateToParamExclusive(opts.dateTo),
  };
  const hasDates = dateArgs.p_date_from !== null || dateArgs.p_date_to !== null;

  const { data, error } = await supabase.rpc(
    "get_form_responses_tabular",
    hasDates ? { ...baseArgs, ...dateArgs } : baseArgs
  );

  // Graceful degradation if migration 021 hasn't been applied yet:
  // PGRST202 = no function matches these named args. Retry without dates
  // so the page still works, and tell the caller the filter was ignored.
  if (error && hasDates && error.code === "PGRST202") {
    const retry = await supabase.rpc("get_form_responses_tabular", baseArgs);
    if (retry.error) throw new Error(retry.error.message);
    throw new DateFilterUnsupportedError(
      (retry.data ?? { submissions: [], questions: [], total_count: 0 }) as TabularData
    );
  }

  if (error) throw new Error(error.message);
  return (data ?? { submissions: [], questions: [], total_count: 0 }) as TabularData;
}

// Thrown when the DB doesn't support date filtering yet — carries the
// unfiltered result so the UI can still render while warning the admin.
export class DateFilterUnsupportedError extends Error {
  constructor(public fallbackData: TabularData) {
    super("Date filtering requires database migration 021_responses_date_filter.sql — showing unfiltered results.");
    this.name = "DateFilterUnsupportedError";
  }
}

// Fetch every matching submission in EXPORT_BATCH-sized pages, honouring the
// SAME filters as the visible table so exports match what the admin sees.
export async function fetchAllForExport(formId: string, filters: ResponseFilters): Promise<ResponseSubmission[]> {
  const all: ResponseSubmission[] = [];
  let offset = 0;
  let expected = Infinity;

  while (offset < expected) {
    const batch = await fetchTabular(formId, { limit: EXPORT_BATCH, offset, ...filters });
    expected = batch.total_count;
    all.push(...batch.submissions);
    if (batch.submissions.length < EXPORT_BATCH) break;
    offset += EXPORT_BATCH;
  }

  return all;
}

// One export row per submission: metadata columns + one column per question,
// with choice values mapped back to their labels and file links (downloadable URLs) for
// upload questions.
export async function buildExportRows(
  exportSubs: ResponseSubmission[],
  questions: ResponseQuestion[],
  optionMap: Record<string, Record<string, string>>,
  supabase?: any  // Optional Supabase client for generating signed URLs
): Promise<Record<string, string>[]> {
  return Promise.all(
    exportSubs.map(async (s) => {
      const row: Record<string, string> = {
        "Reference ID": s.reference_id ?? "",
        "Status": s.status ?? "",
        "Respondent": s.respondent_name ?? "Anonymous",
        "Submitted At": new Date(s.submitted_at).toLocaleString(),
      };

      for (const q of questions) {
        const answer = s.answers?.[q.id];
        let cellValue = "";

        if (answer) {
          cellValue = displayAnswer(answer.value, q.type, optionMap[q.id]);
        } else {
          const qFiles = s.files?.filter(f => f.question_id === q.id) ?? [];
          if (qFiles.length > 0) {
            if (supabase) {
              // Generate signed URLs for files (valid for 1 hour)
              const fileUrls = await Promise.all(
                qFiles.map(async (f) => {
                  try {
                    const { data, error } = await supabase.storage
                      .from("submission-files")
                      .createSignedUrl(f.file_path, 3600);
                    if (error || !data?.signedUrl) {
                      return f.file_name; // Fallback to filename if URL generation fails
                    }
                    return data.signedUrl;  // Return just the URL
                  } catch (err) {
                    return f.file_name; // Fallback on error
                  }
                })
              );
              cellValue = fileUrls.join("\n");  // Separate multiple URLs with newlines
            } else {
              // Fallback: just show filenames if no Supabase client
              cellValue = qFiles.map(f => f.file_name).join(", ");
            }
          }
        }

        row[q.label] = cellValue;
      }

      return row;
    })
  );
}

// Full XLSX export: batched fetch → label mapping → formula-injection
// hardening (safeRow) → ExcelJS workbook → browser download → best-effort copy
// into the submission-files bucket so the Files page can list past exports.
export async function exportResponsesXlsx(opts: {
  formId: string;
  slug: string | null;
  filters: ResponseFilters;
  questions: ResponseQuestion[];
  optionMap: Record<string, Record<string, string>>;
  supabase?: any;  // Optional Supabase client for generating signed file URLs
}): Promise<number> {
  const exportSubs = await fetchAllForExport(opts.formId, opts.filters);
  if (exportSubs.length === 0) return 0;

  const rows = await buildExportRows(exportSubs, opts.questions, opts.optionMap, opts.supabase);
  
  // Don't use safeRow for all - we'll handle safety per-cell after adding hyperlinks
  // const safe = rows.map(safeRow);

  // Use ExcelJS instead of XLSX (safer, no prototype pollution vulnerability)
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Responses");

  // Add header row
  if (rows.length > 0) {
    const headers = Object.keys(rows[0]);
    worksheet.addRow(headers);
    
    // Make header bold
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };
  }

  // Add data rows with properly formatted RichText BEFORE adding to worksheet
  rows.forEach((row) => {
    // Build plain text values first for addRow()
    const cellValues = Object.values(row).map((value) => {
      const stringValue = value as string;
      // For now, just pass the plain value; we'll apply RichText formatting after addRow
      if (stringValue && typeof stringValue === 'string' && stringValue.startsWith('=')) {
        return "'" + stringValue;  // Escape formula
      }
      return stringValue || '';
    });
    
    // Add row with plain values
    const excelRow = worksheet.addRow(cellValues);
    
    // NOW apply RichText formatting to URL cells using the cell's richText property
    let cellIndex = 0;
    for (const value of Object.values(row)) {
      const stringValue = value as string;
      
      if (stringValue && typeof stringValue === 'string' && stringValue.includes('https://')) {
        const urls = stringValue.split('\n').filter(u => u.trim() && u.startsWith('https://'));
        
        if (urls.length > 0) {
          const cell = excelRow.getCell(cellIndex + 1) as any;
          
          // Build RichText array with hyperlinks
          // ExcelJS richText items can have a hyperlink property
          cell.richText = urls.map((url, idx) => {
            const textObj: any = {
              font: { underline: true, color: { argb: 'FF0563C1' } },
              text: url,
              hyperlink: {
                target: url,
                tooltip: url
              }
            };
            
            const items = [textObj];
            
            // Add newline between URLs (except after last one)
            if (idx < urls.length - 1) {
              items.push({
                font: { underline: false },
                text: '\n'
              });
            }
            
            return items;
          }).flat();
          
          cell.alignment = { wrapText: true, vertical: 'top' };
        }
      }
      
      cellIndex++;
    }
    
    // Set alignment for all cells in the row
    excelRow.eachCell((cell) => {
      if (!cell.alignment) {
        cell.alignment = { wrapText: true, vertical: 'top' };
      }
    });
  });

  // Auto-fit columns with minimum and maximum widths
  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const cellLength = String(cell.value).length;
      if (cellLength > maxLength) maxLength = cellLength;
    });
    // Set width: minimum 12, maximum 60, with padding
    column.width = Math.max(12, Math.min(maxLength + 3, 60));
  });

  // Add text wrapping to all cells for better readability
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = { 
        wrapText: true, 
        vertical: 'top',
        horizontal: 'left'
      };
      // Add borders to all cells for clarity
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
        left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
        bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
        right: { style: 'thin', color: { argb: 'FFD3D3D3' } },
      };
    });
  });

  // Set header row background color and make text bold
  const headerRow = worksheet.getRow(1);
  headerRow.height = 40;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }, // Professional blue
    };
    cell.alignment = { 
      wrapText: true, 
      vertical: 'center',
      horizontal: 'center'
    };
  });

  // Freeze header row
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  const fileName = `${opts.slug ?? opts.formId}-responses.xlsx`;

  // Write to buffer
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  // Browser download
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);

  // Best-effort: Save export metadata to storage
  try {
    const storagePath = `exports/${opts.formId}/${fileName}`;
    const { error: upErr } = await supabase.storage
      .from("submission-files")
      .upload(storagePath, blob, { upsert: true });
    
    if (!upErr) {
      await supabase.from("submission_files").insert({
        form_id: opts.formId,
        submission_id: null,
        question_id: null,
        file_path: storagePath,
        file_name: fileName,
        file_size: blob.size,
        mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    }
  } catch (err) {
    console.error("Failed to track export file:", err);
    // Don't fail the entire export if tracking fails
  }

  return exportSubs.length;
}

// CSV export: Similar to Excel but simpler format
export async function exportResponsesCsv(opts: {
  formId: string;
  slug: string | null;
  filters: ResponseFilters;
  questions: ResponseQuestion[];
  optionMap: Record<string, Record<string, string>>;
  supabase?: any;
}): Promise<number> {
  const exportSubs = await fetchAllForExport(opts.formId, opts.filters);
  if (exportSubs.length === 0) return 0;

  const rows = await buildExportRows(exportSubs, opts.questions, opts.optionMap, opts.supabase);

  // Build CSV content
  if (rows.length === 0) return 0;

  const headers = Object.keys(rows[0]);
  const csvRows: string[] = [];

  // Add header row
  csvRows.push(headers.map(h => escapeCsvCell(h)).join(','));

  // Add data rows
  rows.forEach(row => {
    const values = headers.map(h => escapeCsvCell(row[h] || ''));
    csvRows.push(values.join(','));
  });

  const csvContent = csvRows.join('\n');
  const fileName = `${opts.slug ?? opts.formId}-responses.csv`;

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);

  // Best-effort: Save export metadata to storage
  try {
    const storagePath = `exports/${opts.formId}/${fileName}`;
    const { error: upErr } = await supabase.storage
      .from("submission-files")
      .upload(storagePath, blob, { upsert: true });
    
    if (!upErr) {
      await supabase.from("submission_files").insert({
        form_id: opts.formId,
        submission_id: null,
        question_id: null,
        file_path: storagePath,
        file_name: fileName,
        file_size: blob.size,
        mime_type: "text/csv",
      });
    }
  } catch (err) {
    console.error("Failed to track export file:", err);
  }

  return exportSubs.length;
}

// Helper to escape CSV cells (handles quotes, commas, newlines)
function escapeCsvCell(value: string): string {
  if (!value) return '""';
  const stringValue = String(value);
  // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

// value→label lookup for every choice question of a form (F1: admins see
// "HR Executive", not "hr_executive").
export function buildOptionMap(
  rows: { id: string; options: { label: string; value: string }[] | null }[]
): Record<string, Record<string, string>> {
  const map: Record<string, Record<string, string>> = {};
  for (const q of rows) {
    if (Array.isArray(q.options) && q.options.length) {
      map[q.id] = Object.fromEntries(q.options.map(o => [o.value, o.label]));
    }
  }
  return map;
}
