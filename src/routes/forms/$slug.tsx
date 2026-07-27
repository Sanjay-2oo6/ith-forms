import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { IthLogo, useBranding } from "@/lib/ith-brand";
import { SubmitPayloadSchema, uuidv4, fileSizeCheck } from "@/lib/validation";
import { themeContainerStyle, type FormTheme } from "@/lib/theme-utils";
import { Loader2, Upload, X, AlertCircle, Eye } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/forms/$slug")({
  ssr: false,
  component: PublicForm,
});

type Form = {
  id: string; title: string; description: string | null; status: string;
  opens_at: string | null; closes_at: string | null; max_responses: number | null;
  response_count: number; allow_anonymous: boolean; consent_text: string | null;
  confirmation_title: string | null; confirmation_message: string | null;
};
type Section = { id: string; title: string; description: string | null; position: number };
type QConfig = {
  accept?: string[]; maxFiles?: number; maxSizeMB?: number;
  ratingMax?: number;
  minLength?: number; maxLength?: number;
  minSelections?: number; maxSelections?: number;
  rows?: string[]; cols?: string[];
  media?: { path: string; kind: "image" | "video" };
};
type Question = {
  id: string; section_id: string; type: string; label: string; description: string | null;
  placeholder: string | null; required: boolean; options: { label: string; value: string }[];
  config: QConfig | null;
  position: number;
};
type Answers = Record<string, string | string[] | File[]>;
type FormState = "loading" | "unavailable" | "upcoming" | "closed" | "limit" | "ready" | "submitting" | "done";

// Types that render as a simple text/email/tel/number input
const TEXT_TYPES = ["short_text","email","phone","url","number","name","address","organization"];
// Types that are file uploads
const FILE_TYPES = ["file","document","image"];

// ── URL pre-fill (?name=John&email=john@example.com) ─────────────────────────
// Query params may pre-populate COMPATIBLE questions only: plain text-like
// types plus long_text. A param matches a question by its type (e.g. ?email=…
// fills the email question) or by its normalised label (?full_name=… fills
// "Full Name"). Values are length-capped; required/format validation and the
// server-side checks are completely untouched — pre-fill only seeds the same
// state the respondent could have typed, and they can edit it freely.
const PREFILL_TYPES = [...TEXT_TYPES, "long_text"];
const PREFILL_MAX_LEN = 500;
const RESERVED_PARAMS = new Set(["preview", "draft"]);

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function buildPrefillAnswers(searchStr: string, questions: Question[]): Record<string, string> {
  const params = new URLSearchParams(searchStr);
  const out: Record<string, string> = {};
  const candidates = questions.filter(q => PREFILL_TYPES.includes(q.type));

  for (const [rawKey, rawValue] of params.entries()) {
    const key = normalizeKey(rawKey);
    if (!key || RESERVED_PARAMS.has(key)) continue;
    const value = rawValue.slice(0, PREFILL_MAX_LEN).trim();
    if (!value) continue;

    // Match priority: exact type (name/email/phone/…) → exact normalised
    // label → label containing the key (e.g. ?name=… fills "Full name").
    // The substring fallback needs ≥3 chars so tiny keys can't grab fields.
    const free = (q: Question) => !(q.id in out);
    const target =
      candidates.find(q => q.type === key && free(q)) ??
      candidates.find(q => normalizeKey(q.label) === key && free(q)) ??
      (key.length >= 3 ? candidates.find(q => normalizeKey(q.label).includes(key) && free(q)) : undefined);
    if (target) out[target.id] = value;
  }
  return out;
}

// Grid answers are stored as a JSON object string { rowLabel: colLabel }.
function parseGrid(v: string | undefined): Record<string, string> {
  if (!v) return {};
  try {
    const o = JSON.parse(v);
    return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, string>) : {};
  } catch {
    return {};
  }
}

type PreviewDraft = {
  form: Form;
  sections: Section[];
  questions: Question[];
  createdAt: number;
};

function readPreviewDraft(key: string, formId: string): PreviewDraft | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PreviewDraft>;
    if (parsed.form?.id !== formId) return null;
    if (!Array.isArray(parsed.sections) || !Array.isArray(parsed.questions)) return null;
    if (typeof parsed.createdAt !== "number" || Date.now() - parsed.createdAt > 30 * 60 * 1000) return null;
    return parsed as PreviewDraft;
  } catch {
    return null;
  }
}

function PublicForm() {
  const { pathname } = useLocation();
  const slug = pathname.replace(/^\/forms\//, "").replace(/\.html$/, "");
  // Route is ssr:false, so window is always available here.
  const searchStr = typeof window !== "undefined" ? window.location.search : "";
  // Preview mode (?preview=1): used by the builder's device-preview iframe.
  // The param alone does NOTHING — every preview affordance (draft rendering,
  // gate skipping, validation-free navigation, banner) additionally requires
  // a verified ACTIVE ADMIN session, checked server-side via RLS-readable
  // admin_users. A public visitor adding ?preview=1 gets the normal form
  // with full validation.
  const isPreview = new URLSearchParams(searchStr).has("preview");
  const previewDraftKey = new URLSearchParams(searchStr).get("draft");

  const [formState, setFormState] = useState<FormState>("loading");
  const [form, setForm] = useState<Form | null>(null);
  const [theme, setTheme] = useState<FormTheme | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const [consentAgreed, setConsentAgreed] = useState(false);
  // True only when ?preview=1 AND the session belongs to an active admin.
  const [previewAuthorized, setPreviewAuthorized] = useState(false);
  const submitGuard = useRef(false);
  // One idempotency key per page load — reused across retries, regenerated on reload.
  // uuidv4() works even over plain HTTP (LAN), where crypto.randomUUID is absent.
  const idempotencyKey = useRef<string>(uuidv4());

  useEffect(() => {
    if (!slug) return;
    loadForm();
  }, [slug]);

  // Preview authorization: an ACTIVE admin session (RLS lets a user read only
  // their own admin_users row, so this cannot be spoofed client-side).
  async function isAdminSession(): Promise<boolean> {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return false;
    const { data: admin } = await supabase
      .from("admin_users")
      .select("id")
      .eq("user_id", data.user.id)
      .eq("is_active", true)
      .maybeSingle();
    return !!admin;
  }

  async function loadForm() {
    setFormState("loading");
    // Resolve preview authorization FIRST — the availability gating below
    // depends on it. Anon + ?preview=1 ⇒ authorized=false ⇒ normal behavior.
    const authorized = isPreview ? await isAdminSession() : false;
    setPreviewAuthorized(authorized);

    const { data: f, error } = await supabase
      .from("forms")
      .select("id,title,description,status,opens_at,closes_at,max_responses,response_count,allow_anonymous,consent_text,confirmation_title,confirmation_message")
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle();

    if (error || !f) { setFormState("unavailable"); return; }
    // Preview: drafts render for admins (RLS returns the row only to them).
    // Availability gates are also skipped so the admin always sees the form.
    if (f.status !== "published" && !authorized) { setFormState("unavailable"); return; }

    if (!authorized) {
      const now = new Date();
      if (f.opens_at && new Date(f.opens_at) > now) { setForm(f as Form); setFormState("upcoming"); return; }
      if (f.closes_at && new Date(f.closes_at) < now) { setForm(f as Form); setFormState("closed"); return; }
      if (f.max_responses && f.response_count >= f.max_responses) { setFormState("limit"); return; }
    }

    const [sRes, qRes, tRes] = await Promise.all([
      supabase.from("form_sections").select("*").eq("form_id", f.id).order("position"),
      supabase.from("form_questions").select("*").eq("form_id", f.id).order("position"),
      supabase.from("form_themes").select("*").eq("form_id", f.id).maybeSingle(),
    ]);

    let loadedForm = f as Form;
    let loadedSections = (sRes.data ?? []) as Section[];
    let loadedQuestions = (qRes.data ?? []) as unknown as Question[];
    if (authorized && previewDraftKey) {
      const draft = readPreviewDraft(previewDraftKey, loadedForm.id);
      if (draft) {
        loadedForm = draft.form;
        loadedSections = draft.sections;
        loadedQuestions = draft.questions;
      }
    }
    // #13: a question whose section was deleted (orphan) would silently never
    // render. Re-home orphans to the first section so nothing disappears.
    const knownIds = new Set(loadedSections.map(s => s.id));
    const firstId = loadedSections[0]?.id;
    if (firstId) {
      loadedQuestions = loadedQuestions.map(q =>
        knownIds.has(q.section_id) ? q : { ...q, section_id: firstId }
      );
    }

    setForm(loadedForm);
    setSections(loadedSections);
    setQuestions(loadedQuestions);
    setTheme((tRes.data as FormTheme) ?? null);
    setStep(0);
    setConsentAgreed(false);
    // URL pre-fill: seed compatible answers once per load, never overwriting
    // anything the respondent already typed (loadForm runs before any input).
    const prefill = buildPrefillAnswers(searchStr, loadedQuestions);
    if (Object.keys(prefill).length > 0) {
      setAnswers(prev => ({ ...prefill, ...prev }));
    }
    setFormState("ready");
  }

  const setAnswer = React.useCallback((questionId: string, value: string | string[] | File[]) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    setErrors(prev => {
      if (prev[questionId]) {
        const n = { ...prev };
        delete n[questionId];
        return n;
      }
      return prev;
    });
  }, []);

  // Sections that actually contain questions — the pagination steps.
  const stepSections = sections;
  const multi = stepSections.length > 1;
  // #13: never let the step index run past the last section — an out-of-range
  // step made slice() return [] (blank page that looked like a skip-to-submit).
  const safeStep = Math.min(step, Math.max(0, stepSections.length - 1));

  function requiredMissing(q: Question): boolean {
    if (!q.required) return false;
    if (["section_heading","information_paragraph","hidden"].includes(q.type)) return false;
    const val = answers[q.id];
    if (q.type === "grid") {
      // Required grid → every row must have a selection.
      const rows = q.config?.rows ?? [];
      const grid = parseGrid(val as string | undefined);
      return rows.some(r => !grid[r]);
    }
    return !val || (typeof val === "string" && !val.trim()) || (Array.isArray(val) && val.length === 0);
  }

  // Format check for a single question. Phone/number are NORMALISED before
  // validating so real-world formats aren't wrongly rejected (F15/F33):
  // phone allows spaces, dashes, parens and a leading 0; number allows
  // thousands separators and leading-dot decimals. Returns error or null.
  function formatError(q: Question, raw: string): string | null {
    const val = raw.trim();
    if (!val) return null;
    if (q.type === "email") {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
        ? null : "Please enter a complete email address (e.g., user@domain.com)";
    }
    if (q.type === "url") {
      // #8: accept bare domains like "www.example.com" — don't require a scheme.
      const withProto = /^https?:\/\//i.test(val) ? val : `https://${val}`;
      const ok = z.string().url().safeParse(withProto).success && /\.[a-z]{2,}/i.test(val);
      return ok ? null : "Please enter a valid website (e.g., www.example.com)";
    }
    if (q.type === "phone") {
      const digits = val.replace(/[\s\-().]/g, "");
      return /^\+?\d{7,15}$/.test(digits)
        ? null : "Please enter a valid phone number";
    }
    if (q.type === "number") {
      const n = val.replace(/[,\s]/g, "");
      return /^-?\d*\.?\d+$/.test(n) ? null : "Please enter a valid number";
    }
    return null;
  }

  function collectErrors(qs: Question[]): Record<string, string> {
    const errs: Record<string, string> = {};
    for (const q of qs) {
      if (requiredMissing(q)) { errs[q.id] = "This field is required"; continue; }
      const value = answers[q.id];
      const cfg = q.config ?? {};
      // Text length constraints (#6)
      if (typeof value === "string" && value.trim() && (q.type === "short_text" || q.type === "long_text")) {
        const len = value.trim().length;
        if (cfg.minLength && len < cfg.minLength) { errs[q.id] = `Please enter at least ${cfg.minLength} characters`; continue; }
        if (cfg.maxLength && len > cfg.maxLength) { errs[q.id] = `Please keep it under ${cfg.maxLength} characters`; continue; }
      }
      // Checkbox selection constraints (#6)
      if (q.type === "checkbox" && Array.isArray(value)) {
        const count = value.length;
        if (cfg.minSelections && count < cfg.minSelections) { errs[q.id] = `Please select at least ${cfg.minSelections}`; continue; }
        if (cfg.maxSelections && count > cfg.maxSelections) { errs[q.id] = `Please select no more than ${cfg.maxSelections}`; continue; }
      }
      // Format checks (email/url/phone/number)
      if (typeof value === "string") {
        const fe = formatError(q, value);
        if (fe) errs[q.id] = fe;
      }
    }
    return errs;
  }

  function validate(): boolean {
    const errs = collectErrors(questions);
    if (form?.consent_text && !consentAgreed) {
      errs.__consent = "You must agree before submitting";
    }
    setErrors(errs);
    // On a paginated form, jump back to the first section that has an error.
    if (multi && Object.keys(errs).length > 0) {
      const idx = stepSections.findIndex(s => questions.some(q => q.section_id === s.id && errs[q.id]));
      if (idx >= 0) setStep(idx);
    }
    return Object.keys(errs).length === 0;
  }

  function validateCurrentSection(): boolean {
    const sec = stepSections[safeStep];
    if (!sec) return true;
    const secQs = questions.filter(q => q.section_id === sec.id);
    const errs = collectErrors(secQs); // F16: format checks now run per section too
    setErrors(prev => {
      const next = { ...prev };
      for (const q of secQs) delete next[q.id];
      return { ...next, ...errs };
    });
    return Object.keys(errs).length === 0;
  }

  function nextStep() {
    // Authorized admin preview: free navigation for inspection — no required
    // errors while browsing. Real respondents (and anon + ?preview=1) keep
    // full per-section validation.
    if (!previewAuthorized && !validateCurrentSection()) {
      setTimeout(() => document.querySelector("[data-error]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
      return;
    }
    setStep(s => Math.min(s + 1, stepSections.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function preventImplicitSubmit(e: React.KeyboardEvent<HTMLFormElement>) {
    const target = e.target as HTMLElement;
    if (e.key !== "Enter") return;
    if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;
    e.preventDefault();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    if (submitter?.dataset.publicSubmit !== "true") return;
    // Authorized preview never submits — the server would reject drafts
    // anyway (submit_response raises form_unavailable), this just fails fast.
    if (previewAuthorized) {
      setErrors({ __form: "Preview mode — submissions are disabled." });
      return;
    }
    if (multi && safeStep < stepSections.length - 1) {
      return;
    }
    if (submitGuard.current || !form) return;
    if (!validate()) {
      document.querySelector("[data-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    submitGuard.current = true;
    setFormState("submitting");

    // Extract respondent name/email from typed questions
    const nameQ = questions.find(q => q.type === "name");
    const emailQ = questions.find(q => q.type === "email");
    const respondentName = nameQ ? ((answers[nameQ.id] as string) ?? null) : null;
    const respondentEmail = emailQ ? ((answers[emailQ.id] as string) ?? null) : null;

    // Build the answers payload for the RPC (file and display types excluded)
    const answerPayload = questions
      .filter(q => !["section_heading","information_paragraph","hidden",...FILE_TYPES].includes(q.type))
      .flatMap(q => {
        const v = answers[q.id];
        if (v == null || (Array.isArray(v) && v.length === 0)) return [];
        // Use || as delimiter for arrays (checkbox type) - won't conflict with user data
        const value = Array.isArray(v) ? (v as string[]).join("||") : String(v);
        return value.trim() ? [{ question_id: q.id, value }] : [];
      });

    const parsed = SubmitPayloadSchema.safeParse({ form_id: form.id, answers: answerPayload });
    if (!parsed.success) {
      setFormState("ready");
      submitGuard.current = false;
      setErrors({ __form: "Submission failed validation. Please review your answers." });
      return;
    }

    // All public writes go through the SECURITY DEFINER RPC (migration 005):
    // atomic submission + answers, race-safe limits, idempotent by key.
    // Anon direct table access was removed — this is the only write path.
    const { data: rpcData, error: rpcErr } = await supabase.rpc("submit_response", {
      p_form_id: form.id,
      p_name: respondentName,
      p_email: respondentEmail,
      p_idempotency_key: idempotencyKey.current,
      p_answers: answerPayload,
    });

    const result = rpcData as { submission_id: string; reference_id: string } | null;

    if (rpcErr || !result?.submission_id) {
      // Surface the real cause in the console so failures are diagnosable.
      console.error("[submit] RPC error:", rpcErr, "result:", result);
      const msg = rpcErr?.message ?? "";
      const friendly =
        msg.includes("form_not_open")    ? "This form is not open yet." :
        msg.includes("form_closed")      ? "This form is no longer accepting responses." :
        msg.includes("limit_reached")    ? "This form has reached its response limit. Please contact the organiser." :
        msg.includes("form_unavailable") ? "This form is not available." :
        msg.includes("invalid_payload")  ? "Some answers couldn't be processed. Please review and try again." :
        msg.includes("invalid_scale_value") || msg.includes("scale_value_out_of_range") 
          ? "A rating or scale value is invalid. Please check your answers." :
        (rpcErr?.code === "PGRST202" || rpcErr?.code === "PGRST203" || msg.includes("submit_response"))
          ? "The submission service is being upgraded. Please try again in a few minutes."
          : `Submission failed. Please try again.${rpcErr?.message ? ` (${rpcErr.message})` : ""}`;
      setFormState("ready");
      submitGuard.current = false;
      setErrors({ __form: friendly });
      return;
    }

    // Upload files to storage, then register metadata through the validated RPC.
    // Issue #12: Add error handling with user-visible messages
    const failedUploads: string[] = [];
    const successByQuestion: Record<string, number> = {};
    for (const q of questions.filter(q => FILE_TYPES.includes(q.type))) {
      const files = (answers[q.id] as File[]) ?? [];
      for (const file of files) {
        // Sanitize filename: alphanumeric, dash, underscore, dot only (prevent path traversal)
        const safeFileName = file.name
          .replace(/[^a-zA-Z0-9._-]/g, '_')
          .slice(0, 200);
        const path = `${result.submission_id}/${q.id}/${Date.now()}-${safeFileName}`;

        const { error: upErr } = await supabase.storage.from("submission-files").upload(path, file);
        if (upErr) {
          // Issue #12: Show detailed error to user
          console.error(`[upload-error] ${q.label}/${file.name}:`, upErr);
          const errorMsg = upErr.message?.includes("Payload too large")
            ? `${q.label}: ${file.name} is too large`
            : upErr.message?.includes("bucket_not_found")
            ? `${q.label}: Upload service temporarily unavailable`
            : `${q.label}: ${file.name}`;
          failedUploads.push(errorMsg);
          continue;
        }
        
        const { error: regErr } = await supabase.rpc("register_submission_file", {
          p_submission_id: result.submission_id,
          p_question_id: q.id,
          p_file_path: path,
          p_file_name: safeFileName,
          p_file_size: file.size,
          p_mime_type: file.type,
        });
        if (regErr) {
          // Issue #12: Registration error — clean up orphaned file
          console.error(`[register-error] ${q.label}/${file.name}:`, regErr);
          failedUploads.push(`${q.label}: ${file.name} (registration failed)`);
          // F13: the object is in storage but has no DB row — remove it so it
          // doesn't sit orphaned in the bucket.
          await supabase.storage.from("submission-files").remove([path]);
          continue;
        }
        successByQuestion[q.id] = (successByQuestion[q.id] ?? 0) + 1;
      }
    }

    // F8: a REQUIRED file question must end with at least one stored file. If an
    // upload failed, do NOT show success — the answers are already saved under
    // this submission, and retrying reuses the same idempotency key (so the
    // upload simply re-runs against the same submission, creating no duplicate).
    const missingRequiredFile = questions.some(
      q => FILE_TYPES.includes(q.type) && q.required && !(successByQuestion[q.id] > 0)
    );
    if (missingRequiredFile) {
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

  // Public URL for the theme background (form-assets is a public-read bucket).
  const bgUrl = theme?.bg_image_path
    ? supabase.storage.from("form-assets").getPublicUrl(theme.bg_image_path).data.publicUrl
    : null;

  if (formState === "loading") return <Shell><div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div></Shell>;

  if (formState === "unavailable") return (
    <Shell><StateCard icon="🚫" title="Form Unavailable" message="This form is not available. Please check the link and try again." /></Shell>
  );

  if (formState === "upcoming" && form) return (
    <Shell><StateCard icon="🕐" title="Not Open Yet" message={`This form opens on ${new Date(form.opens_at!).toLocaleString()}.`} /></Shell>
  );

  if (formState === "closed") return (
    <Shell><StateCard icon="🔒" title="Form Closed" message="This form is no longer accepting responses." /></Shell>
  );

  if (formState === "limit") return (
    <Shell><StateCard icon="📋" title="Responses Full" message="This form has reached its maximum number of responses." /></Shell>
  );

  if (formState === "done" && form) return (
    <Shell form={form} theme={theme} bgUrl={bgUrl}>
      <div className={`rounded-2xl border p-10 ${bgUrl ? "backdrop-blur-lg bg-card/75 border-white/20 shadow-xl" : "border-border/60 bg-card"}`}>
        {/* Success message & Reference ID */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-2xl font-bold mb-2">{form.confirmation_title ?? "Thank you!"}</h2>
          <p className="text-muted-foreground mb-6">{form.confirmation_message ?? "Your response has been received."}</p>
          {referenceId && (
            <div className="inline-block bg-primary/10 border border-primary/30 rounded-xl px-6 py-4 mb-4">
              <p className="text-xs text-muted-foreground mb-1">Your reference ID</p>
              <p className="text-2xl font-bold font-mono tracking-wider text-primary">{referenceId}</p>
              <p className="text-xs text-muted-foreground mt-1">Keep this for your records</p>
            </div>
          )}
          {confirmEmail && (
            <p className="text-xs text-muted-foreground mt-4">
              Your reference ID is linked to <span className="font-semibold text-foreground">{confirmEmail}</span> —
              we'll use it for any follow-up about this submission.
            </p>
          )}
          {/* ITEM 8: Link to view submission later */}
          {referenceId && (
            <div className="mt-6 p-4 rounded-lg border border-border bg-secondary/20">
              <p className="text-sm font-medium mb-2">View your submission anytime</p>
              <a 
                href={`/view-response/${referenceId}`}
                className="text-sm text-primary hover:underline break-all"
                target="_blank"
                rel="noopener noreferrer"
              >
                {typeof window !== 'undefined' ? window.location.origin : ''}/view-response/{referenceId}
              </a>
              <p className="text-xs text-muted-foreground mt-2">Save this link to review your answers later</p>
            </div>
          )}
        </div>

        {/* ITEM 8A: Show submitted answers on thank-you page */}
        <div className="border-t border-border pt-8">
          <h3 className="text-lg font-semibold mb-4">Your Submitted Answers</h3>
          <div className="space-y-4">
            {questions
              .filter(q => !['section_heading', 'information_paragraph', 'hidden'].includes(q.type))
              .map(q => {
                const answer = answers[q.id];
                if (!answer) return null;
                
                let displayValue: string;
                if (Array.isArray(answer)) {
                  if (answer.length > 0 && answer[0] instanceof File) {
                    displayValue = (answer as File[]).map(f => f.name).join(', ');
                  } else {
                    displayValue = (answer as string[]).join(', ');
                  }
                } else {
                  displayValue = String(answer);
                }
                
                return (
                  <div key={q.id} className="pb-4 border-b border-border/40 last:border-0">
                    <p className="font-semibold text-sm mb-1 text-foreground">{q.label}</p>
                    {q.description && <p className="text-xs text-muted-foreground mb-2">{q.description}</p>}
                    <p className="text-sm text-muted-foreground">{displayValue || '(No answer)'}</p>
                  </div>
                );
              })}
          </div>
        </div>

        {uploadWarnings.length > 0 && (
          <div className="mt-6 text-left rounded-lg border border-orange-500/40 bg-orange-500/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-orange-500 mb-1">
              <AlertCircle className="h-4 w-4 shrink-0" /> Some files could not be uploaded
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              Your submission was recorded, but the following attachments failed. Please email them
              to the organiser quoting your reference ID above.
            </p>
            <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
              {uploadWarnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}
      </div>
    </Shell>
  );

  if (!form) return null;

  return (
    <Shell form={form} theme={theme} bgUrl={bgUrl}>
      {previewAuthorized && (
        <div className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/30 p-3 text-sm text-primary">
          <Eye className="h-4 w-4 shrink-0" />
          Preview mode — this is how respondents will see the form. Navigate freely; submissions are disabled.
        </div>
      )}
      <form onSubmit={handleSubmit} onKeyDown={preventImplicitSubmit} noValidate className="space-y-6">
        {errors.__form && (
          <div data-error className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />{errors.__form}
          </div>
        )}

        {/* Progress bar on multi-section forms */}
        {multi && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Step {safeStep + 1} of {stepSections.length}</span>
              <span>{stepSections[safeStep]?.title}</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-primary transition-all duration-300"
                style={{ width: `${((safeStep + 1) / stepSections.length) * 100}%` }} />
            </div>
          </div>
        )}

        {(multi ? stepSections.slice(safeStep, safeStep + 1) : stepSections).map(sec => {
          const sectionQs = questions.filter(q => q.section_id === sec.id);
          return (
            <div key={sec.id} className="space-y-4">
              {stepSections.length > 1 && (
                <div className="border-b border-border/40 pb-2">
                  <h2 className="font-semibold text-lg">{sec.title}</h2>
                  {sec.description && <p className="text-sm text-muted-foreground">{sec.description}</p>}
                </div>
              )}
              {sectionQs.map(q => (
                <MemoQuestionField
                  key={q.id}
                  question={q}
                  value={answers[q.id]}
                  error={errors[q.id]}
                  onChange={setAnswer}
                />
              ))}
            </div>
          );
        })}

        {(!multi || safeStep === stepSections.length - 1) && form.consent_text && (
          <label className="flex items-start gap-3 rounded-lg border border-border/60 bg-secondary/20 p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={consentAgreed}
              onChange={e => {
                setConsentAgreed(e.target.checked);
                if (e.target.checked) {
                  setErrors(prev => {
                    const next = { ...prev };
                    delete next.__consent;
                    return next;
                  });
                }
              }}
              className="mt-0.5 accent-primary rounded shrink-0"
            />
            <span className="text-xs text-muted-foreground">{form.consent_text}</span>
          </label>
        )}
        {errors.__consent && (
          <p className="text-xs text-destructive flex items-center gap-1 -mt-2">
            <AlertCircle className="h-3 w-3" />{errors.__consent}
          </p>
        )}

        {multi ? (
          <div className="flex gap-3">
            {safeStep > 0 && (
              <button type="button"
                onClick={() => { setStep(Math.max(0, safeStep - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="px-6 h-11 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors">
                ← Back
              </button>
            )}
            {safeStep < stepSections.length - 1 ? (
              // Distinct keys are LOAD-BEARING: without them React recycles
              // this DOM node into the Submit button when nextStep() lands on
              // the last section — synchronously, inside the click dispatch —
              // and the browser then runs the click's DEFAULT ACTION against
              // the mutated node: a form submission. That skipped the final
              // section entirely. preventDefault() is belt-and-braces for
              // the same click event.
              <button key="step-next" type="button"
                onClick={e => { e.preventDefault(); nextStep(); }}
                className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors">
                Next →
              </button>
            ) : (
              <button key="step-submit" type="submit" data-public-submit="true" disabled={formState === "submitting"}
                className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60 transition-colors">
                {formState === "submitting" ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : "Submit"}
              </button>
            )}
          </div>
        ) : (
          <button
            type="submit"
            data-public-submit="true"
            disabled={formState === "submitting"}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {formState === "submitting" ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : "Submit"}
          </button>
        )}
      </form>
    </Shell>
  );
}

function Shell({ children, form, theme, bgUrl }: {
  children: React.ReactNode;
  form?: Form | null;
  theme?: FormTheme | null;
  bgUrl?: string | null;
}) {
  // Overriding the CSS token vars on this container re-themes every
  // Tailwind utility underneath it (see theme-utils.ts).
  const style = themeContainerStyle(theme ?? null, bgUrl);
  const widthStyle = theme?.form_width ? { maxWidth: Number(theme.form_width) } : undefined;
  
  // #2 Glass morphism: ONE frosted panel sits between the background image and
  // the entire form (title + questions + actions). Semi-transparent card colour,
  // backdrop blur, translucent border, soft shadow — solid card when no image.
  const glassEffect = bgUrl
    ? "backdrop-blur-xl bg-card/70 border-white/20 shadow-2xl"
    : "bg-card border-border/40 shadow-sm";

  const { appName, poweredBy } = useBranding();

  return (
    <div className="min-h-screen bg-background text-foreground" style={style}>
      <header className="border-b border-border/60 bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3" style={widthStyle}>
          <IthLogo size={28} withWordmark={false} />
          <span className="text-sm font-semibold">{appName}</span>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8 animate-fade-up" style={widthStyle}>
        <div className={`rounded-2xl border p-5 sm:p-7 space-y-6 transition-all ${glassEffect}`}>
          {form && (
            <div>
              <h1 className="text-3xl font-bold mb-1">{form.title}</h1>
              {form.description && <p className="text-muted-foreground text-sm">{form.description}</p>}
            </div>
          )}
          {children}
        </div>
      </main>
      <footer className="mt-16 border-t border-border/40 py-4 text-center text-xs text-muted-foreground">
        {poweredBy}
      </footer>
    </div>
  );
}

function StateCard({ icon, title, message }: { icon: string; title: string; message: string }) {
  return (
    <div className="rounded-2xl border border-border/60 backdrop-blur-md bg-card/80 p-10 text-center shadow-lg">
      <div className="text-4xl mb-4">{icon}</div>
      <h2 className="text-xl font-bold mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

const MemoQuestionField = React.memo(function MemoQuestionField({ question: q, value, error, onChange }: {
  question: Question;
  value: string | string[] | File[] | undefined;
  error?: string;
  onChange: (id: string, v: string | string[] | File[]) => void;
}) {
  return <QuestionField question={q} value={value} error={error} onChange={v => onChange(q.id, v)} />
}, (prev, next) => {
  return prev.question === next.question &&
         prev.value === next.value &&
         prev.error === next.error &&
         prev.onChange === next.onChange;
});

function QuestionField({ question: q, value, error, onChange }: {
  question: Question;
  value: string | string[] | File[] | undefined;
  error?: string;
  onChange: (v: string | string[] | File[]) => void;
}) {
  if (q.type === "section_heading") return (
    <div className="mt-2 pt-2">
      <h3 className="font-semibold text-base">{q.label}</h3>
      {q.description && <p className="text-xs text-muted-foreground">{q.description}</p>}
    </div>
  );

  if (q.type === "information_paragraph") return (
    <div className="text-sm text-muted-foreground rounded-lg bg-secondary/30 p-3">{q.label}</div>
  );

  if (q.type === "hidden") return null;

  const baseInput = "w-full rounded-lg border bg-background px-4 py-3 text-base placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors " +
    (error ? "border-destructive" : "border-input");

  const inputTypeFor: Record<string, string> = {
    email: "email", phone: "tel", number: "number", url: "url",
  };

  const ariaProps = error ? { "aria-invalid": true, "aria-describedby": `error-${q.id}` } : {};

  return (
    <div data-error={error ? true : undefined}>
      {/* ITEM 2 & 6: Question text LARGE and prominent, visual hierarchy */}
      <label htmlFor={`input-${q.id}`} className="block text-lg font-bold text-foreground mb-2">
        {q.label}{q.required && <span className="text-destructive ml-1">*</span>}
      </label>
      {q.description && <p className="text-sm text-muted-foreground mb-3">{q.description}</p>}

      {/* #10: question media (one image or video, attached by the admin) */}
      {q.config?.media && (() => {
        const mediaUrl = supabase.storage.from("form-assets").getPublicUrl(q.config.media.path).data.publicUrl;
        return q.config.media.kind === "image" ? (
          <img src={mediaUrl} alt="" className="mb-3 rounded-xl border border-border/40 max-h-72 w-auto object-contain" />
        ) : (
          <video src={mediaUrl} controls playsInline className="mb-3 rounded-xl border border-border/40 max-h-72 w-full" />
        );
      })()}

      {/* Text-like inputs: short_text, email, phone, url, number, name, address, organization */}
      {TEXT_TYPES.includes(q.type) && (
        <input
          id={`input-${q.id}`}
          type={inputTypeFor[q.type] ?? "text"}
          value={(value as string) ?? ""}
          onChange={e => onChange(e.target.value)}
          placeholder={q.placeholder ?? ""}
          className={baseInput + " h-10"}
          {...ariaProps}
        />
      )}

      {q.type === "long_text" && (
        <textarea
          id={`input-${q.id}`}
          value={(value as string) ?? ""}
          onChange={e => onChange(e.target.value)}
          placeholder={q.placeholder ?? ""}
          rows={4}
          className={baseInput + " resize-none"}
          {...ariaProps}
        />
      )}

      {q.type === "date" && (
        <input id={`input-${q.id}`} type="date" value={(value as string) ?? ""} onChange={e => onChange(e.target.value)} className={baseInput + " h-10"} {...ariaProps} />
      )}

      {q.type === "time" && (
        <input id={`input-${q.id}`} type="time" value={(value as string) ?? ""} onChange={e => onChange(e.target.value)} className={baseInput + " h-10"} {...ariaProps} />
      )}

      {/* "datetime" is the type name from question-types.ts */}
      {q.type === "datetime" && (
        <input id={`input-${q.id}`} type="datetime-local" value={(value as string) ?? ""} onChange={e => onChange(e.target.value)} className={baseInput + " h-10"} {...ariaProps} />
      )}

      {/* #14: appearance-none + custom chevron — the native arrow clashed with
          the theme padding and looked broken across browsers. */}
      {q.type === "dropdown" && (
        <div className="relative">
          <select
            id={`input-${q.id}`}
            value={(value as string) ?? ""}
            onChange={e => onChange(e.target.value)}
            className={baseInput + " h-11 appearance-none pr-10 cursor-pointer truncate"}
            {...ariaProps}
          >
            <option value="">Select an option…</option>
            {(q.options ?? []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground">
            <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      {/* radio and poll both render as radio buttons */}
      {(q.type === "radio" || q.type === "poll") && (
        <fieldset className="space-y-2" {...ariaProps}>
          <legend className="sr-only">{q.label}</legend>
          {(q.options ?? []).map(o => (
            <label key={o.value} className="flex items-center gap-2 cursor-pointer text-sm" htmlFor={`${q.id}-${o.value}`}>
              <input 
                id={`${q.id}-${o.value}`}
                type="radio" 
                name={q.id} 
                value={o.value} 
                checked={(value as string) === o.value}
                onChange={() => onChange(o.value)} 
                className="accent-primary"
                aria-label={`${q.label}: ${o.label}`}
              />
              {o.label}
            </label>
          ))}
        </fieldset>
      )}

      {q.type === "checkbox" && (
        <fieldset className="space-y-2" {...ariaProps}>
          <legend className="sr-only">{q.label}</legend>
          {(q.options ?? []).map(o => (
            <label key={o.value} className="flex items-center gap-2 cursor-pointer text-sm" htmlFor={`${q.id}-${o.value}`}>
              <input 
                id={`${q.id}-${o.value}`}
                type="checkbox" 
                checked={((value as string[]) ?? []).includes(o.value)}
                onChange={e => {
                  const curr = (value as string[]) ?? [];
                  onChange(e.target.checked ? [...curr, o.value] : curr.filter(v => v !== o.value));
                }} 
                className="accent-primary rounded"
                aria-label={`${q.label}: ${o.label}`}
              />
              {o.label}
            </label>
          ))}
        </fieldset>
      )}

      {q.type === "yes_no" && (
        <fieldset className="flex gap-3" {...ariaProps}>
          <legend className="sr-only">{q.label}</legend>
          {["Yes","No"].map(opt => (
            <button key={opt} type="button" 
              onClick={() => onChange(opt.toLowerCase())}
              className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-colors ${
                (value as string) === opt.toLowerCase() ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-secondary"
              }`}>
              {opt}
            </button>
          ))}
        </fieldset>
      )}

      {/* Rating — 1..ratingMax (default 10, admin-configurable via config) */}
      {q.type === "rating" && (
        <fieldset className="flex gap-1.5 flex-wrap" {...ariaProps}>
          <legend className="sr-only">{q.label}</legend>
          {Array.from({ length: Math.max(2, Math.min(10, q.config?.ratingMax ?? 10)) }, (_, i) => i + 1).map(n => (
            <button 
              key={n} 
              type="button" 
              onClick={() => onChange(String(n))}
              className={`h-10 w-10 rounded-lg border text-sm font-bold transition-colors ${
                (value as string) === String(n) ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-secondary"
              }`}
              aria-label={`${q.label}: ${n}`}
              aria-pressed={(value as string) === String(n)}
            >
              {n}
            </button>
          ))}
        </fieldset>
      )}

      {/* linear_scale — legacy type, fixed 1..10 */}
      {q.type === "linear_scale" && (
        <fieldset className="flex gap-1.5 flex-wrap" {...ariaProps}>
          <legend className="sr-only">{q.label}</legend>
          {[1,2,3,4,5,6,7,8,9,10].map(n => (
            <button 
              key={n} 
              type="button" 
              onClick={() => onChange(String(n))}
              className={`h-9 w-9 rounded-lg border text-xs font-semibold transition-colors ${
                (value as string) === String(n) ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-secondary"
              }`}
              aria-label={`${q.label}: ${n}`}
              aria-pressed={(value as string) === String(n)}
            >
              {n}
            </button>
          ))}
        </fieldset>
      )}

      {/* Multiple Choice Grid — one selection per row */}
      {q.type === "grid" && (
        <div className="overflow-x-auto" role="group" aria-label={q.label} aria-describedby={q.description ? `desc-${q.id}` : undefined}>
          <table className="text-sm" role="grid" aria-label={`${q.label} - Multiple choice grid`}>
            <thead>
              <tr>
                <th className="p-2" scope="row"></th>
                {(q.config?.cols ?? []).map((c, ci) => (
                  <th key={ci} className="p-2 text-xs font-medium text-center" scope="col">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(q.config?.rows ?? []).map((r, ri) => (
                <tr key={ri} className="border-t border-border/40">
                  <td className="p-2 text-xs font-medium whitespace-nowrap" scope="row">{r}</td>
                  {(q.config?.cols ?? []).map((c, ci) => {
                    const grid = parseGrid(value as string | undefined);
                    return (
                      <td key={ci} className="p-2 text-center">
                        <input 
                          type="radio" 
                          name={`${q.id}-${ri}`} 
                          className="accent-primary"
                          checked={grid[r] === c}
                          onChange={() => onChange(JSON.stringify({ ...grid, [r]: c }))}
                          aria-label={`${r}: ${c}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {q.description && <p id={`desc-${q.id}`} className="text-xs text-muted-foreground mt-2">{q.description}</p>}
        </div>
      )}

      {/* File upload — single file, accept from config (default pdf/docx/jpg/jpeg/png) */}
      {FILE_TYPES.includes(q.type) && (
        <FileUploader
          id={`input-${q.id}`}
          files={(value as File[]) ?? []}
          accept={(q.config?.accept ?? [".pdf", ".docx", ".jpg", ".jpeg", ".png"]).join(",")}
          acceptExts={q.config?.accept ?? [".pdf", ".docx", ".jpg", ".jpeg", ".png"]}
          maxSizeMB={q.config?.maxSizeMB ?? 10}
          onChange={files => onChange(files)}
        />
      )}

      {q.type === "consent" && (
        <label className="flex items-start gap-2 cursor-pointer text-sm">
          <input 
            id={`input-${q.id}`} 
            type="checkbox" 
            checked={(value as string) === "agreed"}
            onChange={e => onChange(e.target.checked ? "agreed" : "")}
            className="mt-0.5 accent-primary rounded shrink-0" 
            {...ariaProps}
            aria-label={`${q.label}: ${q.placeholder ?? "I agree to the terms above"}`}
          />
          <span>{q.placeholder ?? "I agree to the terms above"}</span>
        </label>
      )}

      {error && (
        <p id={`error-${q.id}`} className="mt-1 text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />{error}
        </p>
      )}
    </div>
  );
}

// Single-file uploader (requirement #4/#11): one file per question, validated
// against the admin-configured accepted extensions + admin-set size cap.
function FileUploader({ files, accept, acceptExts, maxSizeMB, onChange, id }: {
  files: File[];
  accept: string;
  acceptExts: string[];
  maxSizeMB: number;
  onChange: (files: File[]) => void;
  id?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [rejected, setRejected] = useState<string[]>([]);

  function extAllowed(name: string): boolean {
    const lower = name.toLowerCase();
    return acceptExts.some(ext => lower.endsWith(ext.toLowerCase()));
  }

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = (e.target.files ?? [])[0]; // single file only
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
    onChange([f]); // replace — one file per question
  }

  const hasFile = files.length > 0;
  return (
    <div className="space-y-2">
      <button type="button" onClick={() => ref.current?.click()}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-border hover:border-primary/60 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <Upload className="h-4 w-4" /> {hasFile ? "Replace file" : "Upload file"}
      </button>
      <p className="text-[11px] text-muted-foreground">Accepted: {acceptExts.join(", ")} · one file, max {maxSizeMB} MB</p>
      <input ref={ref} id={id} type="file" accept={accept} hidden onChange={handleSelect} />
      {rejected.length > 0 && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" />{rejected.join(" · ")}
        </p>
      )}
      {files.map((f, i) => (
        <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate max-w-xs">{f.name}</span>
          <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))}>
            <X className="h-3 w-3 hover:text-destructive" />
          </button>
        </div>
      ))}
    </div>
  );
}
