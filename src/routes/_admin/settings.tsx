import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Field, LoadingButton, inputCls, textareaCls, selectCls } from "@/components/ui";
import { AppSettingsSchema, fieldErrors } from "@/lib/validation";
import {
  fetchAppSettings, DEFAULT_APP_SETTINGS,
  type AppSettings, type AppearanceDefault,
} from "@/lib/use-app-settings";
import { Loader2, Check, AlertCircle, Info } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/settings")({
  ssr: false,
  component: SettingsPage,
});

// Read-only platform facts, phrased for admins (no internal table/bucket
// names, no raw placeholders).
const SYSTEM_INFO = [
  { label: "Maximum questions per form", value: "25" },
  { label: "Reference ID format", value: "Organization – Form – Sequence" },
  { label: "Maximum upload size", value: "Up to 50 MB per question" },
  { label: "Authentication", value: "Admin access enabled" },
  { label: "File storage", value: "Secure private file storage" },
];

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

function SettingsPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: saved, isLoading } = useQuery({
    queryKey: ["app-settings"],
    queryFn: fetchAppSettings,
    staleTime: 5 * 60_000,
  });

  // Seed the editable draft once loaded; never clobber in-progress edits.
  useEffect(() => {
    if (saved && draft === null) setDraft(saved);
  }, [saved, draft]);

  function update(patch: Partial<AppSettings>) {
    setDraft(d => (d ? { ...d, ...patch } : d));
    setStatus("dirty");
  }

  async function save() {
    if (!draft || status === "saving") return; // no duplicate saves

    const parsed = AppSettingsSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setStatus("dirty");
      return;
    }
    setErrors({});
    setStatus("saving");

    // UPDATE (not upsert): RLS only grants admins UPDATE on the seeded row.
    const { error, data } = await supabase
      .from("app_settings")
      .update(parsed.data)
      .eq("id", 1)
      .select("id");
    if (error || !data?.length) {
      // Draft is kept as-is so the admin can retry without losing edits.
      setStatus("error");
      toast.error(error?.message ?? "Settings row not found — run migration 024_app_settings.sql first.");
      return;
    }

    setDraft({ ...parsed.data });
    setStatus("saved");
    queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    toast.success("Settings saved");
  }

  return (
    <AdminShell>
      <div className="p-6 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">Application branding and defaults.</p>
        </div>

        {isLoading || !draft ? (
          <div className="rounded-xl border border-border/60 bg-card p-6 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading settings…</span>
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-card p-6 space-y-5 mb-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Application Settings</h2>
              <StatusChip status={status} />
            </div>

            <Field label="Application name" error={errors.app_name}>
              <input value={draft.app_name} onChange={e => update({ app_name: e.target.value })}
                aria-invalid={!!errors.app_name} className={inputCls} placeholder={DEFAULT_APP_SETTINGS.app_name} />
            </Field>

            <Field label="Organization name" error={errors.org_name}>
              <input value={draft.org_name} onChange={e => update({ org_name: e.target.value })}
                aria-invalid={!!errors.org_name} className={inputCls} placeholder={DEFAULT_APP_SETTINGS.org_name} />
            </Field>

            <Field label="Powered-by text" error={errors.powered_by}
              hint="Shown in the app header, login page, and public form footer.">
              <input value={draft.powered_by} onChange={e => update({ powered_by: e.target.value })}
                aria-invalid={!!errors.powered_by} className={inputCls} placeholder={DEFAULT_APP_SETTINGS.powered_by} />
            </Field>

            <Field label="Default appearance" error={errors.default_appearance}
              hint="Applies to admins who haven't picked a theme themselves.">
              <select value={draft.default_appearance}
                onChange={e => update({ default_appearance: e.target.value as AppearanceDefault })}
                className={selectCls + " w-full bg-background"}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </Field>

            <Field label="Default confirmation message" error={errors.default_confirmation_message}
              hint="Used for NEW forms only — forms you've already customized keep their own message.">
              <textarea value={draft.default_confirmation_message}
                onChange={e => update({ default_confirmation_message: e.target.value })}
                aria-invalid={!!errors.default_confirmation_message}
                rows={3} className={textareaCls}
                placeholder={DEFAULT_APP_SETTINGS.default_confirmation_message} />
            </Field>

            <div className="flex justify-end pt-1">
              <LoadingButton loading={status === "saving"} disabled={status !== "dirty" && status !== "error"} onClick={save}>
                Save settings
              </LoadingButton>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border/60 bg-card p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" /> System Information
          </h2>
          <div className="space-y-3">
            {SYSTEM_INFO.map(({ label, value }) => (
              <p key={label} className="text-sm">
                <span className="text-muted-foreground">{label}: </span>
                <span className="font-semibold">{value}</span>
              </p>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function StatusChip({ status }: { status: SaveStatus }) {
  if (status === "saving") return <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Saving…</span>;
  if (status === "dirty") return <span className="flex items-center gap-1 text-xs text-amber-500"><AlertCircle className="h-3 w-3" />Unsaved changes</span>;
  if (status === "error") return <span className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3 w-3" />Save failed</span>;
  if (status === "saved") return <span className="flex items-center gap-1 text-xs text-green-400"><Check className="h-3 w-3" />Saved</span>;
  return null;
}
