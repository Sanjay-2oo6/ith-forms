import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { themeContainerStyle, type FormTheme } from "@/lib/theme-utils";
import { ArrowLeft, Loader2, Upload, Monitor, Smartphone, Trash2, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/forms/$formId/theme")({
  ssr: false,
  component: ThemeEditor,
});

type ThemeRow = FormTheme & { form_id: string };

const PRESETS: { key: string; label: string; primary: string; background: string; card: string }[] = [
  { key: "ith-default",  label: "ITH Default",  primary: "#4f9cf9", background: "#131530", card: "#1b1e40" },
  { key: "professional", label: "Professional", primary: "#1d4ed8", background: "#f1f5f9", card: "#ffffff" },
  { key: "academic",     label: "Academic",     primary: "#7c2d12", background: "#f5f1e8", card: "#fffdf7" },
  { key: "minimal",      label: "Minimal",      primary: "#171717", background: "#ffffff", card: "#fafafa" },
  { key: "dark",         label: "Dark",         primary: "#8b5cf6", background: "#09090b", card: "#18181b" },
];

const FONTS = [
  { label: "System (default)", value: "" },
  { label: "Serif",            value: "Georgia, 'Times New Roman', serif" },
  { label: "Monospace",        value: "'Courier New', monospace" },
];

const RADII = [
  { label: "Sharp (0px)",   value: "0px" },
  { label: "Subtle (8px)",  value: "0.5rem" },
  { label: "Default (12px)", value: "0.75rem" },
  { label: "Round (16px)",  value: "1rem" },
];

const WIDTHS = [
  { label: "Narrow (640px)", value: "640" },
  { label: "Wide (768px)",   value: "768" },
];

const DEFAULT_THEME = (formId: string): ThemeRow => ({
  form_id: formId,
  preset: "ith-default",
  primary_color: "#4f9cf9",
  background_color: "#131530",
  card_color: "#1b1e40",
  font_family: null,
  border_radius: null,
  form_width: null,
  bg_image_path: null,
  bg_overlay_opacity: 0.5,
});

function ThemeEditor() {
  const { formId } = Route.useParams();
  const [form, setForm] = useState<{ title: string } | null>(null);
  const [theme, setTheme] = useState<ThemeRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mobilePreview, setMobilePreview] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const [fRes, tRes] = await Promise.all([
        supabase.from("forms").select("title").eq("id", formId).single(),
        supabase.from("form_themes").select("*").eq("form_id", formId).maybeSingle(),
      ]);
      if (fRes.data) setForm(fRes.data);
      setTheme((tRes.data as ThemeRow) ?? DEFAULT_THEME(formId));
    })();
  }, [formId]);

  function patch(p: Partial<ThemeRow>) {
    setTheme(t => (t ? { ...t, ...p, preset: p.preset ?? "custom" } : t));
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setTheme(t => t ? {
      ...t, preset: p.key,
      primary_color: p.primary, background_color: p.background, card_color: p.card,
    } : t);
  }

  async function save() {
    if (!theme) return;
    setSaving(true);
    const { error } = await supabase.from("form_themes").upsert(
      {
        form_id: formId,
        preset: theme.preset,
        primary_color: theme.primary_color,
        background_color: theme.background_color,
        card_color: theme.card_color,
        font_family: theme.font_family,
        border_radius: theme.border_radius,
        form_width: theme.form_width,
        bg_image_path: theme.bg_image_path,
        bg_overlay_opacity: theme.bg_overlay_opacity,
      },
      { onConflict: "form_id" }
    );
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    const actorEmail = (await supabase.auth.getUser()).data.user?.email ?? null;
    supabase.from("audit_logs").insert({
      action: "theme.updated", entity: "form", entity_id: formId,
      actor_email: actorEmail, metadata: { preset: theme.preset },
    }).then(({ error: e }) => {
      if (e) console.error("[audit] insert failed:", e.code, e.message);
    });
    toast.success("Theme saved — the public form uses it immediately.");
  }

  async function uploadBg(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !theme) return;
    if (!file.type.startsWith("image/")) { toast.error("Background must be an image."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Background image must be under 5 MB."); return; }
    setUploading(true);
    const path = `${formId}/bg-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("form-assets").upload(path, file, { upsert: true });
    setUploading(false);
    if (error) { toast.error(`Upload failed: ${error.message}`); return; }
    patch({ bg_image_path: path });
    toast.success("Background uploaded — remember to Save.");
  }

  if (!theme) {
    return <AdminShell><div className="flex justify-center py-16"><Loader2 className="animate-spin" /></div></AdminShell>;
  }

  const bgUrl = theme.bg_image_path
    ? supabase.storage.from("form-assets").getPublicUrl(theme.bg_image_path).data.publicUrl
    : null;
  const previewStyle = themeContainerStyle(theme, bgUrl);

  return (
    <AdminShell>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/forms"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-sm hover:bg-secondary transition-colors shrink-0">
            <ArrowLeft className="h-4 w-4" /> Forms
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Theme</h1>
            <p className="text-xs text-muted-foreground">{form?.title ?? "Form"} — how respondents see it</p>
          </div>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save theme
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr]">
          {/* ── Controls ── */}
          <div className="space-y-5">
            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
              <h2 className="font-semibold text-sm">Preset</h2>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map(p => (
                  <button key={p.key} onClick={() => applyPreset(p)}
                    className={`rounded-lg border p-2.5 text-left transition-colors ${
                      theme.preset === p.key ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50"
                    }`}>
                    <div className="flex gap-1 mb-1.5">
                      <span className="h-4 w-4 rounded-full border border-black/20" style={{ background: p.background }} />
                      <span className="h-4 w-4 rounded-full border border-black/20" style={{ background: p.card }} />
                      <span className="h-4 w-4 rounded-full border border-black/20" style={{ background: p.primary }} />
                    </div>
                    <p className="text-xs font-medium">{p.label}</p>
                  </button>
                ))}
                <div className={`rounded-lg border p-2.5 ${theme.preset === "custom" ? "border-primary ring-1 ring-primary" : "border-border"}`}>
                  <p className="text-xs font-medium mt-4">Custom</p>
                  <p className="text-[10px] text-muted-foreground">edit colors below</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
              <h2 className="font-semibold text-sm">Colors</h2>
              {([
                ["Primary", "primary_color"],
                ["Background", "background_color"],
                ["Card", "card_color"],
              ] as const).map(([label, key]) => (
                <div key={key} className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground w-24">{label}</label>
                  <input type="color" value={theme[key] ?? "#000000"}
                    onChange={e => patch({ [key]: e.target.value } as Partial<ThemeRow>)}
                    className="h-8 w-10 rounded border border-input bg-transparent cursor-pointer" />
                  <input type="text" value={theme[key] ?? ""}
                    onChange={e => patch({ [key]: e.target.value } as Partial<ThemeRow>)}
                    placeholder="#rrggbb"
                    className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
              <h2 className="font-semibold text-sm">Layout & Type</h2>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground w-24">Font</label>
                <select value={theme.font_family ?? ""}
                  onChange={e => patch({ font_family: e.target.value || null })}
                  className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                  {FONTS.map(f => <option key={f.label} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground w-24">Corners</label>
                <select value={theme.border_radius ?? "0.75rem"}
                  onChange={e => patch({ border_radius: e.target.value })}
                  className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                  {RADII.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground w-24">Form width</label>
                <select value={theme.form_width ?? "640"}
                  onChange={e => patch({ form_width: e.target.value })}
                  className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                  {WIDTHS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
              <h2 className="font-semibold text-sm">Background image</h2>
              {theme.bg_image_path ? (
                <div className="space-y-2">
                  <div className="h-20 rounded-lg bg-cover bg-center border border-border"
                    style={{ backgroundImage: bgUrl ? `url(${bgUrl})` : undefined }} />
                  <div className="flex items-center gap-2">
                    <button onClick={() => patch({ bg_image_path: null })}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground block mb-1">
                        Overlay opacity: {(theme.bg_overlay_opacity ?? 0.5).toFixed(2)}
                      </label>
                      <input type="range" min={0} max={0.95} step={0.05}
                        value={theme.bg_overlay_opacity ?? 0.5}
                        onChange={e => patch({ bg_overlay_opacity: parseFloat(e.target.value) })}
                        className="w-full accent-primary" />
                    </div>
                  </div>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border hover:border-primary/60 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Upload image (max 5 MB)
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={uploadBg} />
            </div>
          </div>

          {/* ── Live preview ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">Live preview</h2>
              <div className="flex gap-1">
                <button onClick={() => setMobilePreview(false)}
                  className={`p-1.5 rounded-md border ${!mobilePreview ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
                  <Monitor className="h-4 w-4" />
                </button>
                <button onClick={() => setMobilePreview(true)}
                  className={`p-1.5 rounded-md border ${mobilePreview ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
                  <Smartphone className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-border overflow-hidden flex justify-center bg-black/20">
              <div style={{ ...previewStyle, width: mobilePreview ? 375 : "100%" }}
                className="bg-background text-foreground transition-all">
                <div className="px-6 py-8"
                  style={{ maxWidth: Number(theme.form_width ?? "640"), margin: "0 auto" }}>
                  <h1 className="text-xl font-bold mb-1">{form?.title ?? "Form title"}</h1>
                  <p className="text-sm text-muted-foreground mb-6">This is how respondents will see your form.</p>
                  <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5 text-card-foreground">
                        Full name <span className="text-destructive">*</span>
                      </label>
                      <input readOnly placeholder="Jane Respondent"
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm h-10" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5 text-card-foreground">Attending?</label>
                      <div className="flex gap-3">
                        <span className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium grid place-items-center">Yes</span>
                        <span className="flex-1 h-10 rounded-lg border border-input text-sm grid place-items-center">No</span>
                      </div>
                    </div>
                    <div className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm grid place-items-center">
                      Submit
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
