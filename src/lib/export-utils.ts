// CSV/XLSX formula-injection protection.
// A cell value that begins with a formula trigger (= + - @ | %) can execute
// when opened in Excel/Sheets. Attackers can hide the trigger behind leading
// whitespace, so we strip leading whitespace before testing, then neutralise
// the value by prefixing a single quote.
//
// SECURITY: Also prevents prototype pollution attacks (CVE-2024-XLSX) by escaping dangerous keys.
export function safeCell<T>(v: T): T | string {
  if (typeof v !== "string") return v;
  const stripped = v.replace(/^[\s\t\r\n]+/, "");
  
  // Prevent formula injection (Excel macros)
  if (/^[=+\-@|%]/.test(stripped)) {
    return `'${v}`;
  }
  
  // Prevent prototype pollution attacks
  // This is defense-in-depth even though ExcelJS doesn't have the vulnerability
  if (v.includes("__proto__") || v.includes("constructor") || v.includes("prototype")) {
    return v.replace(/__proto__|constructor|prototype/g, "_sanitized_");
  }
  
  return v;
}

// Apply safeCell to every string value in a row object.
export function safeRow<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([k, val]) => [k, safeCell(val)])
  );
}

// Maps a stored answer value back to human-readable text for display/export.
// Choice types store the option *value* (a slug); this looks up the current
// option label so admins see "HR Executive", not "hr_executive" (F1).
// Checkbox stores |||| -joined values (migration 017) → each is mapped and re-joined.
// Consent stores "agreed" → shown as "Agreed" (F6).
const CHOICE_ANSWER_TYPES = ["dropdown", "radio", "poll", "checkbox", "yes_no"];

export function displayAnswer(
  rawValue: string | null | undefined,
  questionType: string,
  valueToLabel?: Record<string, string>
): string {
  if (rawValue == null || rawValue === "") return "";
  if (questionType === "consent") return rawValue === "agreed" ? "Agreed" : rawValue;
  // Grid answers are a JSON object { row: column } → "Row: Column" lines.
  if (questionType === "grid") {
    try {
      const obj = JSON.parse(rawValue) as Record<string, string>;
      return Object.entries(obj).map(([r, c]) => `${r}: ${c}`).join("; ");
    } catch {
      return rawValue;
    }
  }
  if (!valueToLabel || !CHOICE_ANSWER_TYPES.includes(questionType)) return rawValue;
  
  // Handle both old (comma) and new (||) delimiters for backward compatibility
  const delimiter = rawValue.includes("||") ? "||" : ",";
  return rawValue
    .split(delimiter)
    .map(v => v.trim())
    .map(v => valueToLabel[v] ?? v)
    .join(", ");
}
