/**
 * Form Builder State Management Hook
 *
 * Centralizes all state and mutations for form/sections/questions.
 * Handles: state tracking, normalization, validation flags.
 *
 * Usage:
 * ```
 * const builder = useFormBuilder(initialForm);
 * builder.addQuestion(sectionId, "text");
 * builder.updateForm({ title: "New Title" });
 * ```
 */

import { useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { uuidv4 } from "./validation";
import type { QuestionType } from "./question-types";
import type { Question, QuestionConfig, Section } from "@/components/form-builder/types";
import type { BuilderForm as Form } from "@/components/form-builder/types";

interface UseFormBuilderState {
  form: Form | null;
  sections: Section[];
  questions: Question[];
  savedQuestions: Question[];
  hasUnsavedChanges: boolean;
  invalidSectionIds: string[];
}

interface UseFormBuilderActions {
  setForm: (form: Form | null) => void;
  setSections: (sections: Section[]) => void;
  setQuestions: (questions: Question[]) => void;
  setSavedQuestions: (questions: Question[]) => void;
  setHasUnsavedChanges: (unsaved: boolean) => void;
  setInvalidSectionIds: (ids: string[]) => void;
  updateForm: (patch: Partial<Form>) => void;
  addSection: (afterPosition?: number) => void;
  updateSection: (id: string, patch: Partial<Section>) => void;
  deleteSection: (id: string) => void;
  addQuestion: (sectionId: string, type: QuestionType, overrides?: { label?: string; placeholder?: string | null; config?: QuestionConfig }) => void;
  updateQuestion: (id: string, patch: Partial<Question>) => void;
  deleteQuestion: (id: string) => void;
  reorderSections: (activeId: string, overId: string) => void;
  reorderQuestions: (sectionId: string, activeId: string, overId: string) => void;
}

export function useFormBuilder(initialForm: Form | null = null): UseFormBuilderState & UseFormBuilderActions {
  const [form, setForm] = useState<Form | null>(initialForm);
  const [sections, setSections] = useState<Section[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [savedQuestions, setSavedQuestions] = useState<Question[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [invalidSectionIds, setInvalidSectionIds] = useState<string[]>([]);

  const markDirty = () => setHasUnsavedChanges(true);

  const updateForm = (patch: Partial<Form>) => {
    setForm(f => f ? { ...f, ...patch } : f);
    markDirty();
  };

  const addSection = (afterPosition?: number) => {
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
    markDirty();
  };

  const updateSection = (id: string, patch: Partial<Section>) => {
    setSections(s => s.map(sec => sec.id === id ? { ...sec, ...patch } : sec));
    markDirty();
  };

  const deleteSection = (id: string) => {
    const remaining = sections.filter(sec => sec.id !== id);
    const firstRemaining = remaining[0];
    setSections(renumberSections(remaining));
    if (firstRemaining) {
      setQuestions(q => q.map(qn =>
        qn.section_id === id ? { ...qn, section_id: firstRemaining.id } : qn
      ));
    }
    markDirty();
  };

  const addQuestion = (
    sectionId: string,
    type: QuestionType,
    overrides?: { label?: string; placeholder?: string | null; config?: QuestionConfig }
  ) => {
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
    // Adding a question satisfies the empty-section rule for that section
    setInvalidSectionIds(ids => ids.filter(id => id !== sectionId));
    markDirty();
  };

  const updateQuestion = (id: string, patch: Partial<Question>) => {
    setQuestions(q => q.map(qn => qn.id === id ? { ...qn, ...patch } : qn));
    markDirty();
  };

  const deleteQuestion = (id: string) => {
    setQuestions(q => q.filter(qn => qn.id !== id));
    markDirty();
  };

  const reorderSections = (activeId: string, overId: string) => {
    const ordered = normalizeSections(sections);
    const oldIndex = ordered.findIndex(s => s.id === activeId);
    const newIndex = ordered.findIndex(s => s.id === overId);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    setSections(renumberSections(arrayMove(ordered, oldIndex, newIndex)));
    markDirty();
  };

  const reorderQuestions = (sectionId: string, activeId: string, overId: string) => {
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
  };

  return {
    // State
    form, setForm,
    sections, setSections,
    questions, setQuestions,
    savedQuestions, setSavedQuestions,
    hasUnsavedChanges, setHasUnsavedChanges,
    invalidSectionIds, setInvalidSectionIds,
    // Actions
    updateForm,
    addSection, updateSection, deleteSection,
    addQuestion, updateQuestion, deleteQuestion,
    reorderSections, reorderQuestions,
  };
}

// ─── Utility Functions ──────────────────────────────────────────────────

function renumberSections(list: Section[]): Section[] {
  return list.map((s, i) => ({
    ...s,
    position: i,
    title: /^Section \d+$/.test(s.title) ? `Section ${i + 1}` : s.title,
  }));
}

function normalizeSections(list: Section[]): Section[] {
  return renumberSections([...list].sort((a, b) => a.position - b.position));
}

export function normalizeQuestions(list: Question[], sections: Section[]): Question[] {
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
