// The union keeps legacy type names so existing questions/rendering never
// break, but the builder picker (QUESTION_TYPES below) offers only the
// approved set. "grid" (Multiple Choice Grid) is the one new type.
export type QuestionType =
  | "short_text" | "long_text" | "email" | "phone" | "url" | "name" | "address" | "organization"
  | "number" | "date" | "time" | "datetime" | "rating" | "linear_scale"
  | "dropdown" | "radio" | "checkbox" | "yes_no" | "poll" | "consent" | "grid"
  | "file" | "document" | "image"
  | "section_heading" | "information_paragraph" | "hidden";

// Only these types are offered in the form builder (requirement #5).
export const QUESTION_TYPES: { type: QuestionType; label: string; category: string }[] = [
  { type: "short_text", label: "Short Answer",        category: "Text" },
  { type: "long_text",  label: "Paragraph",           category: "Text" },
  { type: "email",      label: "Email",               category: "Text" },
  { type: "phone",      label: "Phone Number",        category: "Text" },
  { type: "url",        label: "URL",                 category: "Text" },
  { type: "radio",      label: "Multiple Choice",     category: "Choice" },
  { type: "checkbox",   label: "Checkboxes",          category: "Choice" },
  { type: "dropdown",   label: "Dropdown",            category: "Choice" },
  { type: "poll",       label: "Poll",                category: "Choice" },
  { type: "grid",       label: "Multiple Choice Grid", category: "Choice" },
  { type: "date",       label: "Date",                category: "Date & Time" },
  { type: "time",       label: "Time",                category: "Date & Time" },
  { type: "rating",     label: "Rating",              category: "Scale" },
  { type: "file",       label: "File Upload",         category: "File" },
];

export const CHOICE_TYPES: QuestionType[] = ["dropdown", "radio", "checkbox", "poll"];
export const FILE_TYPES: QuestionType[] = ["file", "document", "image"];
export const DISPLAY_TYPES: QuestionType[] = ["section_heading", "information_paragraph", "hidden"];

// Default and bounds for the Rating type (requirement #5: default 1–10).
export const RATING_DEFAULT_MAX = 10;
export const RATING_MIN_ALLOWED = 2;
export const RATING_MAX_ALLOWED = 10;

// Accepted file extensions offered to admins (requirement #4).
export const FILE_ACCEPT_OPTIONS = [".pdf", ".docx", ".jpg", ".jpeg", ".png"] as const;

// #8: predefined question templates — one click creates a fully-configured
// question (label + type + placeholder + validation via the type itself).
export type QuestionTemplate = {
  id: string; label: string; type: QuestionType;
  placeholder?: string; config?: Record<string, unknown>;
};

export const QUESTION_TEMPLATES: QuestionTemplate[] = [
  { id: "full_name",  label: "Full Name",         type: "name",       placeholder: "e.g., Jane Doe" },
  { id: "first_name", label: "First Name",        type: "short_text", placeholder: "e.g., Jane" },
  { id: "last_name",  label: "Last Name",         type: "short_text", placeholder: "e.g., Doe" },
  { id: "email",      label: "Email Address",     type: "email",      placeholder: "you@example.com" },
  { id: "phone",      label: "Phone Number",      type: "phone",      placeholder: "+91 98765 43210" },
  { id: "address",    label: "Address",           type: "address",    placeholder: "Street, Area" },
  { id: "city",       label: "City",              type: "short_text", placeholder: "e.g., Hyderabad" },
  { id: "state",      label: "State",             type: "short_text", placeholder: "e.g., Telangana" },
  { id: "country",    label: "Country",           type: "short_text", placeholder: "e.g., India" },
  { id: "zip",        label: "ZIP / Postal Code", type: "short_text", placeholder: "e.g., 500001", config: { maxLength: 10 } },
  { id: "linkedin",   label: "LinkedIn",          type: "url",        placeholder: "www.linkedin.com/in/username" },
  { id: "portfolio",  label: "Portfolio",         type: "url",        placeholder: "www.yourportfolio.com" },
  { id: "website",    label: "Website",           type: "url",        placeholder: "www.example.com" },
  { id: "dob",        label: "Date of Birth",     type: "date" },
];

export function inputTypeFor(type: QuestionType): string {
  const map: Partial<Record<QuestionType, string>> = {
    email: "email", phone: "tel", number: "number", url: "url",
    date: "date", time: "time", datetime: "datetime-local",
  };
  return map[type] ?? "text";
}
