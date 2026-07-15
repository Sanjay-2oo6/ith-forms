import { z } from "zod";

// Generate a valid RFC-4122 v4 UUID.
//
// crypto.randomUUID() only exists in SECURE contexts (HTTPS or localhost). When
// the form is opened over plain HTTP on a LAN IP (e.g. http://172.168.5.37),
// randomUUID is undefined — so we must fall back. crypto.getRandomValues DOES
// work over HTTP, so we still get cryptographic randomness there; only if even
// that is missing do we use Math.random. Either way the output is a real UUID,
// which matters because the idempotency_key column is typed `uuid` server-side.
export function uuidv4(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const h = Array.from(bytes, b => b.toString(16).padStart(2, "0"));
  return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
}

// Payload sent to the submit_response RPC — validated client-side before the call.
export const SubmitPayloadSchema = z.object({
  form_id: z.string().uuid(),
  answers: z
    .array(
      z.object({
        question_id: z.string().uuid(),
        value: z.string().max(20000),
      })
    )
    .max(50),
});

// Admin form creation — validated BEFORE any DB call so the admin gets
// field-level errors instead of a raw Postgres message. The DB unique
// constraint on forms.slug remains the final authority (23505 handling stays).
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const FormCreateSchema = z.object({
  title: z.string().trim()
    .min(3, "Title must be at least 3 characters")
    .max(150, "Title must be 150 characters or fewer"),
  slug: z.string().trim()
    .min(3, "Slug must be at least 3 characters")
    .max(80, "Slug must be 80 characters or fewer")
    .regex(SLUG_PATTERN, "Slug may only contain lowercase letters, numbers, and single hyphens (no leading/trailing hyphen)"),
  description: z.string().trim().max(1000, "Description must be 1000 characters or fewer").optional(),
  category: z.string().trim().max(50).optional(),
});

export type FormCreateInput = z.infer<typeof FormCreateSchema>;

// Flatten a Zod error into { fieldName: firstMessage } for inline display.
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "_form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

// Admin application settings (Settings page, app_settings row).
export const AppSettingsSchema = z.object({
  app_name: z.string().trim()
    .min(2, "Application name must be at least 2 characters")
    .max(60, "Application name must be 60 characters or fewer"),
  org_name: z.string().trim()
    .min(2, "Organization name must be at least 2 characters")
    .max(80, "Organization name must be 80 characters or fewer"),
  powered_by: z.string().trim()
    .min(2, "Powered-by text must be at least 2 characters")
    .max(100, "Powered-by text must be 100 characters or fewer"),
  default_appearance: z.enum(["light", "dark", "system"]),
  default_confirmation_message: z.string().trim()
    .min(5, "Confirmation message must be at least 5 characters")
    .max(500, "Confirmation message must be 500 characters or fewer"),
});

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB — default, can be overridden per question

// File configuration from question.file_config
export type FileConfig = {
  acceptedTypes?: string[]; // MIME types, e.g., ["application/pdf", "image/png"] or ["*"]
  maxFiles?: number;
  maxSize?: number; // bytes
};

// Extension-based file validation aligned with form_questions.config.accept
export function fileExtensionCheck(
  fileName: string,
  acceptExts: string[]
): { ok: true } | { ok: false; reason: string } {
  const lower = fileName.toLowerCase();
  const allowed = acceptExts.some(ext => lower.endsWith(ext.toLowerCase()));
  if (!allowed) {
    return { ok: false, reason: `only ${acceptExts.join(", ")} allowed` };
  }
  return { ok: true };
}

export function fileSizeCheck(
  fileSize: number,
  maxSizeMB: number
): { ok: true } | { ok: false; reason: string } {
  const maxBytes = maxSizeMB * 1024 * 1024;
  if (fileSize > maxBytes) {
    return { ok: false, reason: `exceeds the ${maxSizeMB} MB limit` };
  }
  return { ok: true };
}

// Client-side file gate. Server (register_submission_file) re-checks via config jsonb.
export function fileCheck(
  file: File,
  kind: "file" | "document" | "image",
  config?: FileConfig
): { ok: true } | { ok: false; reason: string } {
  const maxSize = config?.maxSize ?? MAX_FILE_BYTES;
  const acceptedTypes = config?.acceptedTypes ?? [];
  
  // Check file size
  if (file.size > maxSize) {
    const sizeMB = (maxSize / (1024 * 1024)).toFixed(0);
    return { ok: false, reason: `exceeds the ${sizeMB} MB limit` };
  }
  
  // Check MIME type against config
  if (acceptedTypes.length > 0 && !acceptedTypes.includes("*")) {
    if (!acceptedTypes.includes(file.type)) {
      return { ok: false, reason: `file type "${file.type}" not allowed` };
    }
  } else {
    // Fallback to legacy validation if no config
    if (kind === "image" && !file.type.startsWith("image/")) {
      return { ok: false, reason: "is not an image" };
    }
    // For document type, check MIME type (fixes B9 - no longer relying on extension)
    if (kind === "document") {
      const allowedDocTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv'
      ];
      if (!allowedDocTypes.includes(file.type)) {
        return { ok: false, reason: `is not an allowed document type (received: ${file.type})` };
      }
    }
  }
  
  // Additional check: if MIME type is too generic or missing, reject
  if (!file.type || file.type === 'application/octet-stream') {
    return { ok: false, reason: "file type could not be determined - please try a different file" };
  }
  
  return { ok: true };
}
