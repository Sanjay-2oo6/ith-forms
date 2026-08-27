import { Field, inputCls, textareaCls } from "@/components/ui";
import type { BuilderForm } from "./types";

// Convert a UTC ISO string to the value expected by <input type="datetime-local">
// (which always wants local time). Using toISOString() on a Date gives UTC, so
// we manually format the local parts instead.
function toLocalDatetimeInput(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    // Check if date is valid
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch (e) {
    console.warn("[toLocalDatetimeInput] Invalid date:", iso, e);
    return "";
  }
}

export function SettingsTab({ form, onChange }: { form: BuilderForm; onChange: (p: Partial<BuilderForm>) => void }) {
  return (
    <div className="max-w-xl space-y-5">
      <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
        <h2 className="font-semibold">Schedule & Limits</h2>
        <Field label="Opens at">
          <input type="datetime-local" value={toLocalDatetimeInput(form.opens_at)} onChange={e => onChange({ opens_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
            className={inputCls + " h-9"} />
        </Field>
        <Field label="Closes at">
          <input type="datetime-local" value={toLocalDatetimeInput(form.closes_at)} onChange={e => onChange({ closes_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
            className={inputCls + " h-9"} />
        </Field>
        <Field label="Max responses (total)">
          <input type="number" min={1} value={form.max_responses ?? ""} onChange={e => onChange({ max_responses: e.target.value ? parseInt(e.target.value) : null })}
            placeholder="Unlimited"
            className={inputCls + " h-9"} />
          <p className="text-xs text-muted-foreground mt-1">Maximum submissions from all respondents combined</p>
        </Field>
        <Field label="Max responses per verified email">
          <select value={form.responses_per_email_limit ?? ""} onChange={e => onChange({ responses_per_email_limit: e.target.value ? parseInt(e.target.value) : null })}
            className={inputCls + " h-9"}>
            <option value="">Unlimited</option>
            <option value="1">1 response</option>
            <option value="2">2 responses</option>
            <option value="3">3 responses</option>
            <option value="5">5 responses</option>
            <option value="10">10 responses</option>
          </select>
          <p className="text-xs text-muted-foreground mt-1">Respondents must sign in with Google. Each verified email can submit up to this many times.</p>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.allow_anonymous} onChange={e => onChange({ allow_anonymous: e.target.checked })} />
          Allow anonymous responses
        </label>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
        <h2 className="font-semibold">Confirmation</h2>
        <Field label="Thank-you title">
          <input value={form.confirmation_title ?? ""} onChange={e => onChange({ confirmation_title: e.target.value || null })}
            placeholder="Thank you!" className={inputCls + " h-9"} />
        </Field>
        <Field label="Thank-you message">
          <textarea value={form.confirmation_message ?? ""} onChange={e => onChange({ confirmation_message: e.target.value || null })}
            rows={3} placeholder="Your response has been received."
            className={textareaCls} />
        </Field>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
        <h2 className="font-semibold">Consent & Notice</h2>
        <Field label="Consent / privacy notice text">
          <textarea value={form.consent_text ?? ""} onChange={e => onChange({ consent_text: e.target.value || null })}
            rows={3} placeholder="By submitting this form, you agree to…"
            className={textareaCls} />
        </Field>
      </div>
    </div>
  );
}
