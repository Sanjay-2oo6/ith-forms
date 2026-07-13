import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Sparkles, FileText } from "lucide-react";
import { toast } from "sonner";
import { FORM_TEMPLATES, getTemplateCategories, type FormTemplate } from "@/lib/form-templates";
import { FormCreateSchema, fieldErrors } from "@/lib/validation";
import { Field, LoadingButton, inputCls, textareaCls, selectCls } from "@/components/ui";
import { useAppSettings } from "@/lib/use-app-settings";

export const Route = createFileRoute("/_admin/forms/new")({
  ssr: false,
  component: NewForm,
});

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function NewForm() {
  const navigate = useNavigate();
  const appSettings = useAppSettings();
  const [step, setStep] = useState<"template" | "details">("template");
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function selectTemplate(template: FormTemplate | null) {
    setSelectedTemplate(template);
    if (template) {
      setTitle(template.name);
      setSlug(slugify(template.name));
      setDescription(template.description);
      setCategory(template.category);
    }
    setStep("details");
  }

  function onTitleChange(v: string) {
    setTitle(v);
    if (!slugManual) setSlug(slugify(v));
  }

  async function createFromTemplate(formId: string) {
    if (!selectedTemplate) return;

    for (let i = 0; i < selectedTemplate.sections.length; i++) {
      const section = selectedTemplate.sections[i];
      const { data: sectionData, error: sectionError } = await supabase
        .from("form_sections")
        .insert({
          form_id: formId,
          title: section.title,
          description: section.description || null,
          position: i,
        })
        .select("id")
        .single();

      if (sectionError || !sectionData) {
        throw new Error(sectionError?.message ?? `Failed to create section "${section.title}"`);
      }

      const questions = section.questions.map((q, idx) => ({
        form_id: formId,
        section_id: sectionData.id,
        type: q.type,
        label: q.label,
        description: q.description || null,
        placeholder: q.placeholder || null,
        required: q.required,
        position: idx,
        options: q.options ?? [],
      }));

      const { error: questionsError } = await supabase.from("form_questions").insert(questions);
      if (questionsError) {
        throw new Error(questionsError.message ?? `Failed to create questions for "${section.title}"`);
      }
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    // Schema validation BEFORE any DB call — field-level errors inline.
    const parsed = FormCreateSchema.safeParse({
      title, slug,
      description: description || undefined,
      category: category || undefined,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});

    setSaving(true);
    try {
      // Pre-check slug uniqueness for a friendly early error. The DB unique
      // constraint (23505 below) stays the final source of truth for races.
      const { data: existing } = await supabase.from("forms").select("id").eq("slug", parsed.data.slug).maybeSingle();
      if (existing) {
        setErrors({ slug: "This slug is already in use. Choose another." });
        return;
      }

      const { data: form, error } = await supabase
        .from("forms")
        .insert({
          title: parsed.data.title,
          slug: parsed.data.slug,
          description: parsed.data.description || null,
          category: parsed.data.category || null,
          // App-wide default applies to NEW forms only; the admin can change
          // it per form in Settings → Confirmation, and existing forms are
          // never touched by later changes to the app default.
          confirmation_message: appSettings.default_confirmation_message,
        })
        .select("id")
        .single();
      if (error || !form) {
        // 23505 = unique_violation — the DB constraint is the source of truth,
        // so this also catches races that slip past the pre-check above.
        if (error?.code === "23505") { setErrors({ slug: "This slug is already in use. Choose another." }); return; }
        toast.error(error?.message ?? "Failed to create form");
        return;
      }

      const { error: themeError } = await supabase
        .from("form_themes")
        .insert({ form_id: form.id, preset: "ith-default" });
      if (themeError) {
        toast.error(themeError.message);
        return;
      }

      if (selectedTemplate) {
        await createFromTemplate(form.id);
        toast.success(`Form created from "${selectedTemplate.name}" template`);
      } else {
        const { error: sectionError } = await supabase
          .from("form_sections")
          .insert({ form_id: form.id, title: "Section 1", position: 0 });
        if (sectionError) {
          toast.error(sectionError.message);
          return;
        }
        toast.success("Form created");
      }

      navigate({ to: "/forms/$formId/edit", params: { formId: form.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create form");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell>
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">New Form</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {step === "template" ? "Choose a template or start from scratch" : "Configure your form details"}
        </p>

        {step === "template" ? (
          <TemplateSelector onSelect={selectTemplate} />
        ) : (
          <form onSubmit={handleCreate} className="max-w-xl space-y-5 rounded-xl border border-border/60 bg-card p-6">
            {selectedTemplate && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30 mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Using "{selectedTemplate.name}" template</p>
                  <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep("template")}
                  className="text-xs text-primary hover:underline"
                >
                  Change
                </button>
              </div>
            )}

            <Field label="Form Title *" error={errors.title}>
              <input
                type="text"
                value={title}
                onChange={e => onTitleChange(e.target.value)}
                required
                aria-invalid={!!errors.title}
                className={inputCls}
                placeholder="e.g. Event Registration 2026"
              />
            </Field>

            <Field label="URL Slug *" hint={`Public URL: /forms/${slug || "your-slug"}`} error={errors.slug}>
              <input
                type="text"
                value={slug}
                onChange={e => { setSlug(slugify(e.target.value)); setSlugManual(true); }}
                required
                pattern="[a-z0-9-]+"
                aria-invalid={!!errors.slug}
                className={inputCls + " font-mono"}
                placeholder="event-registration-2026"
              />
            </Field>

            <Field label="Description" error={errors.description}>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className={textareaCls}
                placeholder="Brief description shown to respondents"
              />
            </Field>

            <Field label="Category" error={errors.category}>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className={selectCls + " w-full bg-background"}
              >
                <option value="">Select category…</option>
                {["Event Registration","Application","Survey","Feedback","Internship","Workshop","Other"].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (selectedTemplate) {
                    setStep("template");
                  } else {
                    navigate({ to: "/forms" });
                  }
                }}
                className="flex-1 h-10 rounded-md border border-border text-sm hover:bg-secondary transition-colors"
              >
                {selectedTemplate ? "Back" : "Cancel"}
              </button>
              <LoadingButton
                type="submit"
                loading={saving}
                className="flex-1 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60"
              >
                Create Form
              </LoadingButton>
            </div>
          </form>
        )}
      </div>
    </AdminShell>
  );
}

function TemplateSelector({ onSelect }: { onSelect: (template: FormTemplate | null) => void }) {
  const [filter, setFilter] = useState<FormTemplate["category"] | "all">("all");
  const categories = getTemplateCategories();
  
  const templates = filter === "all" 
    ? FORM_TEMPLATES 
    : FORM_TEMPLATES.filter(t => t.category === filter);

  return (
    <div className="space-y-5">
      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            filter === "all"
              ? "bg-primary text-primary-foreground"
              : "border border-border hover:bg-secondary"
          }`}
        >
          All Templates
        </button>
        {categories.map(cat => (
          <button
            key={cat.value}
            onClick={() => setFilter(cat.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === cat.value
                ? "bg-primary text-primary-foreground"
                : "border border-border hover:bg-secondary"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Blank form option */}
      <button
        onClick={() => onSelect(null)}
        className="w-full text-left rounded-xl border-2 border-dashed border-border/60 hover:border-primary/60 bg-card p-5 transition-colors group"
      >
        <div className="flex items-start gap-4">
          <div className="shrink-0 h-12 w-12 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <FileText className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold mb-1">Blank Form</h3>
            <p className="text-sm text-muted-foreground">Start from scratch with an empty form</p>
          </div>
        </div>
      </button>

      {/* Template cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {templates.map(template => (
          <button
            key={template.id}
            onClick={() => onSelect(template)}
            className="text-left rounded-xl border border-border/60 hover:border-primary/60 bg-card p-5 transition-colors group"
          >
            <div className="flex items-start gap-4">
              <div className="shrink-0 h-12 w-12 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Sparkles className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{template.name}</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground uppercase font-medium">
                    {template.category}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{template.description}</p>
                <p className="text-xs text-muted-foreground">
                  {template.sections.length} section{template.sections.length !== 1 ? "s" : ""} · {" "}
                  {template.sections.reduce((sum, s) => sum + s.questions.length, 0)} questions
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
