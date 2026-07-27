import { createFileRoute, Link, useBlocker } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { type QuestionType, type QuestionTemplate } from "@/lib/question-types";
import { ExternalLink, Loader2, Eye, Palette, ArrowLeft, Smartphone, Save } from "lucide-react";
import { toast } from "sonner";
import { arrayMove } from "@dnd-kit/sortable";
import { useConfirm } from "@/components/ConfirmDialog";
import { BuilderTab } from "@/components/form-builder/BuilderTab";
import { SettingsTab } from "@/components/form-builder/SettingsTab";
import { SaveIndicator } from "@/components/form-builder/SaveIndicator";
import { PreviewModal } from "@/components/form-builder/PreviewModal";
import { uuidv4 } from "@/lib/validation";
import type {
  BuilderForm as Form,
  BuilderPreviewDraft,
  Question,
  QuestionConfig,
  SaveState,
  Section,
} from "@/components/form-builder/types";

export const Route = createFileRoute("/_admin/forms/$formId/edit")({
  ssr: false,
  component: FormEditor,
});

const UNSAVED_MESSAGE = "You have unsaved changes. Leave without saving?";

type SaveRpcResult = { ok?: boolean };

function FormEditor() {
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();
  const { formId } = Route.useParams();
  const [form, setForm] = useState<Form | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [savedQuestions, setSavedQuestions] = useState<Question[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [activeTab, setActiveTab] = useState<"builder" | "settings">("builder");
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [lastAddedSectionId, setLastAddedSectionId] = useState<string | null>(null);
  // Sections flagged empty by the last Save/Publish attempt (highlighted red).
  const [invalidSectionIds, setInvalidSectionIds] = useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useBlocker({
    disabled: !hasUnsavedChanges && saveState !== "saving",
    enableBeforeUnload: () => hasUnsavedChanges || saveState === "saving",
    shouldBlockFn: ({ current, next }) => {
      if (current.pathname === next.pathname) return false;
      return !window.confirm(UNSAVED_MESSAGE);
    },
  });

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges && saveState !== "saving") return;
      e.preventDefault();
      e.returnValue = UNSAVED_MESSAGE;
      return UNSAVED_MESSAGE;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveState, hasUnsavedChanges]);

  useEffect(() => { load(); }, [formId]);

  const previewDraft = useMemo<BuilderPreviewDraft | null>(() => {
    if (!form) return null;
    return {
      form,
      sections: normalizeSections(sections),
      questions: normalizeQuestions(questions, normalizeSections(sections)),
      createdAt: Date.now(),
    };
  }, [form, sections, questions]);

  async function load() {
    const [fRes, sRes, qRes] = await Promise.all([
      supabase.from("forms").select("*").eq("id", formId).single(),
      supabase.from("form_sections").select("*").eq("form_id", formId).order("position"),
      supabase.from("form_questions").select("*").eq("form_id", formId).order("position"),
    ]);
    if (fRes.error) {
      toast.error(fRes.error.message);
      return;
    }
    const loadedSections = ((sRes.data ?? []) as Section[]).sort((a, b) => a.position - b.position);
    const loadedQuestions = ((qRes.data ?? []) as unknown as Question[]).sort((a, b) => a.position - b.position);
    setForm(fRes.data as Form);
    setSections(loadedSections);
    setQuestions(loadedQuestions);
    setSavedQuestions(loadedQuestions);
    setHasUnsavedChanges(false);
    setSaveState("saved");
  }

  function markDirty() {
    setHasUnsavedChanges(true);
    setSaveState("dirty");
  }

  function updateForm(patch: Partial<Form>) {
    setForm(f => f ? { ...f, ...patch } : f);
    markDirty();
  }

  async function uploadPendingMedia(inputQuestions: Question[]): Promise<{ questions: Question[]; uploadedPaths: string[] }> {
    const uploadedPaths: string[] = [];
    const updated: Question[] = [];
    for (const question of inputQuestions) {
      const media = question.config?.media;
      if (!media?.pendingDataUrl) {
        updated.push(question);
        continue;
      }
      const response = await fetch(media.pendingDataUrl);
      const blob = await response.blob();
      const safe = (media.pendingName ?? "media")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(0, 150);
      const path = `question-media/${question.id}/${Date.now()}-${safe}`;
      const file = new File([blob], safe, { type: media.pendingType || blob.type });
      const { error } = await supabase.storage.from("form-assets").upload(path, file, { upsert: true });
      if (error) throw new Error(`Media upload failed for "${question.label || "Untitled question"}": ${error.message}`);
      uploadedPaths.push(path);
      updated.push({
        ...question,
        config: {
          ...question.config,
          media: { path, kind: media.kind, oldPath: media.oldPath },
        },
      });
    }
    return { questions: updated, uploadedPaths };
  }

  async function saveAll(): Promise<boolean> {
    if (!form || saveState === "saving") return false;
    if (!form.title.trim()) {
      toast.error("Form title is required");
      return false;
    }
    if (questions.length > 25) {
      toast.error("Form has reached the 25 question limit");
      return false;
    }

    const normalizedSections = normalizeSections(sections);
    const normalizedQuestions = normalizeQuestions(questions, normalizedSections);

    // Empty sections may exist WHILE editing, but never in a saved form:
    // highlight each one, jump to the first, and keep the draft dirty so the
    // admin can add a question (or delete the section) and retry.
    const emptyIds = normalizedSections
      .filter(sec => !normalizedQuestions.some(q => q.section_id === sec.id))
      .map(sec => sec.id);
    if (emptyIds.length > 0) {
      setInvalidSectionIds(emptyIds);
      toast.error("Each section must contain at least one question.");
      document.getElementById(`builder-section-${emptyIds[0]}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    setInvalidSectionIds([]);
    setSaveState("saving");
    const uploadedPaths: string[] = [];
    try {
      const mediaResult = await uploadPendingMedia(normalizedQuestions);
      uploadedPaths.push(...mediaResult.uploadedPaths);
      const questionsForSave = mediaResult.questions.map(stripPendingMedia);
      const { data, error } = await supabase.rpc("save_form_builder", {
        p_form_id: form.id,
        p_form: buildFormPayload(form),
        p_sections: normalizedSections,
        p_questions: questionsForSave,
      });
      if (error) throw new Error(error.message);
      const result = data as SaveRpcResult | null;
      if (!result?.ok) throw new Error("Save did not complete");

      const oldMediaPaths = mediaPaths(savedQuestions);
      const currentMediaPaths = mediaPaths(questionsForSave);
      const replacedOrRemoved = [...oldMediaPaths].filter(path => !currentMediaPaths.has(path));
      if (replacedOrRemoved.length > 0) {
        await supabase.storage.from("form-assets").remove(replacedOrRemoved);
      }

      setSections(normalizedSections);
      setQuestions(questionsForSave);
      setSavedQuestions(questionsForSave);
      setHasUnsavedChanges(false);
      setSaveState("saved");
      toast.success("Saved successfully");
      return true;
    } catch (err) {
      if (uploadedPaths.length > 0) await supabase.storage.from("form-assets").remove(uploadedPaths);
      console.error("[builder-save] failed:", err);
      setSaveState("error");
      
      // Issue #16: Invalidate cache on mutation error so stale data doesn't persist
      // The next page load/refetch will get fresh data from the server
      await queryClient.invalidateQueries({ queryKey: ["form-meta", form.id] });
      await queryClient.invalidateQueries({ queryKey: ["form-questions", form.id] });
      await queryClient.invalidateQueries({ queryKey: ["form-sections", form.id] });
      
      toast.error(err instanceof Error ? err.message : "Save failed. Reloading...");
      return false;
    }
  }

  async function publish() {
    if (!form) return;
    if (hasUnsavedChanges) {
      toast.message("Saving changes before publishing...");
      const saved = await saveAll();
      if (!saved) return;
    }
    // Same empty-section rule as Save — covers forms saved before this guard
    // existed (nothing was dirty, so saveAll didn't run above).
    const emptyIds = sections
      .filter(sec => !questions.some(q => q.section_id === sec.id))
      .map(sec => sec.id);
    if (emptyIds.length > 0) {
      setInvalidSectionIds(emptyIds);
      toast.error("Each section must contain at least one question.");
      document.getElementById(`builder-section-${emptyIds[0]}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (sections.length === 0) { toast.error("Add at least one section before publishing"); return; }
    if (questions.filter(q => !["section_heading","information_paragraph","hidden"].includes(q.type)).length === 0) {
      toast.error("Add at least one question before publishing"); return;
    }
    setSaveState("saving");
    const patch: Partial<Form> = { status: "published" as never };
    if (!form.published_at) (patch as { published_at?: string }).published_at = new Date().toISOString();
    const { error } = await supabase.from("forms").update(patch as never).eq("id", form.id);
    if (error) { setSaveState("error"); toast.error(error.message); return; }
    setForm({ ...form, ...patch });
    setSaveState("saved");
    await supabase.from("audit_logs").insert({
      action: "form.published",
      entity: "form",
      entity_id: form.id,
      metadata: { title: form.title },
    });
    toast.success("Form published! Share the link below.");
  }

  async function unpublish() {
    if (!form) return;
    const { error } = await supabase.from("forms")
      .update({ status: "draft", published_at: null } as never)
      .eq("id", form.id);
    if (error) { toast.error(error.message); return; }
    setForm({ ...form, status: "draft", published_at: null });
    await supabase.from("audit_logs").insert({
      action: "form.unpublished",
      entity: "form",
      entity_id: form.id,
      metadata: { title: form.title },
    });
    toast.success("Form unpublished");
  }

  function addSection(afterPosition?: number) {
    const ordered = normalizeSections(sections);
    const insertPos = afterPosition !== undefined ? afterPosition + 1 : ordered.length;
    const newSection: Section = {
      id: uuidv4(),
      title: `Section ${insertPos + 1}`,
      description: null,
      position: insertPos,
    };
    const next = [...ordered];
    next.splice(insertPos, 0, newSection);
    setSections(renumberSections(next));
    // The header button appends at the END of what can be a very long page —
    // without scrolling the new section into view it looked like the click
    // did nothing. SectionBlock scrolls + focuses when it sees this id.
    setLastAddedSectionId(newSection.id);
    markDirty();
  }

  function updateSection(id: string, patch: Partial<Section>) {
    setSections(s => s.map(sec => sec.id === id ? { ...sec, ...patch } : sec));
    markDirty();
  }

  async function deleteSection(id: string) {
    if (sections.length <= 1) { toast.error("At least one section must remain"); return; }
    const confirmed = await confirm({
      title: "Delete Section",
      message: "Delete this section? Its questions will be moved to the first remaining section.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!confirmed) return;

    const remaining = sections.filter(sec => sec.id !== id);
    const firstRemaining = remaining[0];
    setSections(renumberSections(remaining));
    if (firstRemaining) {
      setQuestions(q => q.map(qn =>
        qn.section_id === id ? { ...qn, section_id: firstRemaining.id } : qn
      ));
    }
    markDirty();
  }

  function addQuestion(
    sectionId: string,
    type: QuestionType,
    overrides?: { label?: string; placeholder?: string | null; config?: QuestionConfig }
  ) {
    if (questions.length >= 25) { toast.error("Form has reached the 25 question limit"); return; }
    const sectionQs = questions.filter(q => q.section_id === sectionId);
    const defaultLabels: Record<string, string> = {
      email: "Email Address",
      phone: "Phone Number",
      name: "Full Name",
      address: "Address",
      organization: "Organization",
      url: "Website URL",
      date: "Date",
      time: "Time",
      datetime: "Date and Time",
      number: "Number",
      file: "File Upload",
      document: "Document Upload",
      image: "Image Upload",
    };
    const defaultOptions = ["dropdown","radio","checkbox","poll"].includes(type)
      ? [{ label: "Option 1", value: "option_1" }, { label: "Option 2", value: "option_2" }]
      : [];
    const baseConfig: QuestionConfig =
      type === "file"   ? { accept: [".pdf", ".docx", ".jpg", ".jpeg", ".png"], maxFiles: 1 } :
      type === "rating" ? { ratingMax: 10 } :
      type === "grid"   ? { rows: ["Row 1", "Row 2"], cols: ["Column 1", "Column 2"] } :
      {};
    const newQuestion: Question = {
      id: uuidv4(),
      section_id: sectionId,
      type,
      label: overrides?.label ?? (defaultLabels[type] || ""),
      description: null,
      placeholder: overrides?.placeholder ?? null,
      required: false,
      default_value: null,
      options: defaultOptions,
      config: { ...baseConfig, ...(overrides?.config ?? {}) },
      position: sectionQs.length,
    };
    setQuestions(q => [...q, newQuestion]);
    setLastAddedId(newQuestion.id);
    // Adding a question satisfies the empty-section rule for that section.
    setInvalidSectionIds(ids => ids.filter(id => id !== sectionId));
    markDirty();
  }

  function addTemplateQuestion(sectionId: string, tpl: QuestionTemplate) {
    return addQuestion(sectionId, tpl.type, {
      label: tpl.label,
      placeholder: tpl.placeholder ?? null,
      config: (tpl.config as QuestionConfig) ?? undefined,
    });
  }

  function updateQuestion(id: string, patch: Partial<Question>) {
    setQuestions(q => q.map(qn => qn.id === id ? { ...qn, ...patch } : qn));
    markDirty();
  }

  async function deleteQuestion(id: string) {
    const confirmed = await confirm({
      title: "Delete Question",
      message: "Are you sure you want to delete this question?",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!confirmed) return;
    setQuestions(q => q.filter(qn => qn.id !== id));
    markDirty();
  }

  function reorderSections(activeId: string, overId: string) {
    const ordered = normalizeSections(sections);
    const oldIndex = ordered.findIndex(s => s.id === activeId);
    const newIndex = ordered.findIndex(s => s.id === overId);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    setSections(renumberSections(arrayMove(ordered, oldIndex, newIndex)));
    markDirty();
  }

  function reorderQuestions(sectionId: string, activeId: string, overId: string) {
    const sectionQs = questions
      .filter(q => q.section_id === sectionId)
      .sort((a, b) => a.position - b.position);
    const oldIndex = sectionQs.findIndex(q => q.id === activeId);
    const newIndex = sectionQs.findIndex(q => q.id === overId);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    const reordered = arrayMove(sectionQs, oldIndex, newIndex).map((q, i) => ({ ...q, position: i }));
    const byId = new Map(reordered.map(q => [q.id, q]));
    setQuestions(prev => prev.map(q => byId.get(q.id) ?? q));
    markDirty();
  }

  if (!form) return <AdminShell><div className="p-6"><Loader2 className="animate-spin" /></div></AdminShell>;

  return (
    <AdminShell>
      <div>
        <div className="sticky top-0 z-20 flex items-center gap-4 px-6 py-4 border-b border-border/60 bg-card/95 backdrop-blur">
          <Link to="/forms"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-sm hover:bg-secondary transition-colors shrink-0" aria-label="Back to forms">
            <ArrowLeft className="h-4 w-4" /> Forms
          </Link>
          <div className="flex-1 min-w-0">
            <input
              value={form.title}
              onChange={e => updateForm({ title: e.target.value })}
              className="text-xl font-bold bg-transparent border-none outline-none w-full"
              placeholder="Form title"
            />
            <p className="text-xs text-muted-foreground">/forms/{form.slug}</p>
          </div>

          <SaveIndicator state={saveState} />

          <button onClick={saveAll} disabled={saveState === "saving" || !hasUnsavedChanges}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
            {saveState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saveState === "saving" ? "Saving..." : "Save"}
          </button>

          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${form.status === "published" ? "bg-green-500/20 text-green-400" : "bg-secondary text-secondary-foreground"}`}>
            {form.status}
          </span>

          <button onClick={() => setShowPreview(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-sm hover:bg-secondary">
            <Smartphone className="h-3.5 w-3.5" /> Preview
          </button>

          {form.status === "published" && (
            <a href={`/forms/${form.slug}.html`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-sm hover:bg-secondary">
              <ExternalLink className="h-3.5 w-3.5" /> View
            </a>
          )}

          <Link to="/forms/$formId/theme" params={{ formId }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-sm hover:bg-secondary">
            <Palette className="h-3.5 w-3.5" /> Theme
          </Link>

          <Link to="/forms/$formId/responses" params={{ formId }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-sm hover:bg-secondary">
            <Eye className="h-3.5 w-3.5" /> Responses
          </Link>

          {form.status === "published" ? (
            <button onClick={unpublish} className="px-4 py-1.5 rounded-md border border-border text-sm hover:bg-secondary">
              Unpublish
            </button>
          ) : (
            <button onClick={publish} disabled={saveState === "saving"}
              className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
              Publish
            </button>
          )}
        </div>

        <div className="sticky top-[57px] z-20 flex border-b border-border/60 px-6 bg-background">
          {(["builder", "settings"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              {tab}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === "builder" ? (
            <BuilderTab
              sections={sections}
              questions={questions}
              onAddSection={addSection}
              onUpdateSection={updateSection}
              onDeleteSection={deleteSection}
              onAddQuestion={addQuestion}
              onAddTemplate={addTemplateQuestion}
              onUpdateQuestion={updateQuestion}
              onDeleteQuestion={deleteQuestion}
              questionCount={questions.length}
              lastAddedId={lastAddedId}
              onClearLastAdded={() => setLastAddedId(null)}
              lastAddedSectionId={lastAddedSectionId}
              onClearLastAddedSection={() => setLastAddedSectionId(null)}
              invalidSectionIds={invalidSectionIds}
              onReorderSections={reorderSections}
              onReorderQuestions={reorderQuestions}
              confirm={confirm}
            />
          ) : (
            <SettingsTab form={form} onChange={updateForm} />
          )}
        </div>
      </div>

      {showPreview && previewDraft && <PreviewModal slug={form.slug} draft={previewDraft} onClose={() => setShowPreview(false)} />}
    </AdminShell>
  );
}

function renumberSections(list: Section[]) {
  return list.map((s, i) => ({
    ...s,
    position: i,
    title: /^Section \d+$/.test(s.title) ? `Section ${i + 1}` : s.title,
  }));
}

function normalizeSections(list: Section[]) {
  return renumberSections([...list].sort((a, b) => a.position - b.position));
}

function normalizeQuestions(list: Question[], sections: Section[]) {
  const sectionIds = new Set(sections.map(s => s.id));
  const firstSectionId = sections[0]?.id;
  const grouped = new Map<string, Question[]>();
  for (const question of list) {
    const sectionId = sectionIds.has(question.section_id) ? question.section_id : firstSectionId;
    if (!sectionId) continue;
    const nextQuestion = { ...question, section_id: sectionId };
    grouped.set(sectionId, [...(grouped.get(sectionId) ?? []), nextQuestion]);
  }
  return sections.flatMap(section =>
    (grouped.get(section.id) ?? [])
      .sort((a, b) => a.position - b.position)
      .map((question, index) => ({ ...question, position: index }))
  );
}

function buildFormPayload(form: Form) {
  return {
    title: form.title,
    description: form.description,
    opens_at: form.opens_at,
    closes_at: form.closes_at,
    max_responses: form.max_responses,
    allow_anonymous: form.allow_anonymous,
    consent_text: form.consent_text,
    confirmation_title: form.confirmation_title,
    confirmation_message: form.confirmation_message,
  };
}

function stripPendingMedia(question: Question): Question {
  const media = question.config?.media;
  if (!media) return question;
  const config = { ...question.config };
  config.media = media.path ? { path: media.path, kind: media.kind } : undefined;
  return { ...question, config };
}

function mediaPaths(inputQuestions: Question[]) {
  const paths = new Set<string>();
  for (const question of inputQuestions) {
    const path = question.config?.media?.path;
    if (path) paths.add(path);
  }
  return paths;
}
