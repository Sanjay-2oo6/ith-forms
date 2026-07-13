import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  QUESTION_TYPES, QUESTION_TEMPLATES,
  type QuestionType, type QuestionTemplate,
} from "@/lib/question-types";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ConfirmFn } from "@/components/ConfirmDialog";
import { MemoQuestionCard } from "./QuestionCard";
import type { Question, Section } from "./types";

const CATEGORIES = [...new Set(QUESTION_TYPES.map(q => q.category))];

export function SectionBlock({ section, questions, canDelete, onUpdate, onDelete, onAddQuestion, onAddTemplate, onUpdateQuestion, onDeleteQuestion, atLimit, lastAddedId, onClearLastAdded, isNew, onMounted, invalid, onReorderQuestions, confirm }: {
  section: Section;
  questions: Question[];
  canDelete: boolean;
  onUpdate: (p: Partial<Section>) => void;
  onDelete: () => void;
  onAddQuestion: (type: QuestionType) => void;
  onAddTemplate: (tpl: QuestionTemplate) => void;
  onUpdateQuestion: (id: string, p: Partial<Question>) => void;
  onDeleteQuestion: (id: string) => void;
  atLimit: boolean;
  lastAddedId: string | null;
  onClearLastAdded: () => void;
  isNew?: boolean;
  onMounted?: () => void;
  invalid?: boolean;
  onReorderQuestions: (activeId: string, overId: string) => void;
  confirm: ConfirmFn;
}) {
  const [pickerRect, setPickerRect] = useState<DOMRect | null>(null);
  const qSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const containerRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Section itself is sortable inside the BuilderTab DndContext.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });

  // A freshly added section can land far below the fold on a long form —
  // without this scroll+focus the header's "Add section" click looked like
  // it did nothing. Mirrors the lastAddedId pattern used for questions.
  useEffect(() => {
    if (isNew) {
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      titleRef.current?.focus();
      titleRef.current?.select();
      onMounted?.();
    }
  }, []);

  return (
    <div
      id={`builder-section-${section.id}`}
      ref={node => { setNodeRef(node); containerRef.current = node; }}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className={`rounded-xl border bg-card overflow-hidden ${
        invalid ? "border-destructive ring-2 ring-destructive/40" : "border-border/60"
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-secondary/30">
        <button {...attributes} {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none p-0.5 -m-0.5"
          title="Drag to reorder section">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <input
          ref={titleRef}
          value={section.title}
          onChange={e => onUpdate({ title: e.target.value })}
          className="flex-1 font-semibold bg-transparent border-none outline-none text-sm"
          placeholder="Section title"
        />
        {canDelete && (
          <button onClick={onDelete} className="p-1 hover:text-destructive transition-colors" aria-label="Delete section">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Nested context: questions reorder within this section only */}
        <DndContext
          sensors={qSensors}
          collisionDetection={closestCenter}
          onDragEnd={e => {
            if (e.over && e.active.id !== e.over.id) onReorderQuestions(String(e.active.id), String(e.over.id));
          }}
        >
          <SortableContext items={questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
            {questions.map(q => (
              <MemoQuestionCard
                key={q.id}
                question={q}
                onUpdate={p => onUpdateQuestion(q.id, p)}
                onDelete={() => onDeleteQuestion(q.id)}
                isNew={lastAddedId === q.id}
                onMounted={onClearLastAdded}
                confirm={confirm}
              />
            ))}
          </SortableContext>
        </DndContext>

        {!atLimit && (
          <div className="relative">
            <button
              onClick={e => {
                // #6: capture the anchor rect AT CLICK TIME (not render time).
                // A stale/unattached ref used to leave the picker unpositioned
                // and clipped, while its invisible backdrop swallowed the next
                // click — making "Add question" appear dead.
                //
                // The rect MUST be read here, synchronously: React nulls
                // e.currentTarget once the handler returns, and the setState
                // updater runs after that — reading it inside the updater
                // crashed with "Cannot read properties of null".
                const rect = e.currentTarget.getBoundingClientRect();
                setPickerRect(prev => (prev ? null : rect));
              }}
              className="flex items-center gap-2 w-full py-2 px-3 rounded-md border border-dashed border-border/60 text-sm text-muted-foreground hover:border-primary/60 hover:text-primary transition-colors"
            >
              <Plus className="h-4 w-4" /> Add question
            </button>
            {pickerRect && (
              <QuestionTypePicker
                rect={pickerRect}
                onPick={type => { onAddQuestion(type); setPickerRect(null); }}
                onPickTemplate={tpl => { onAddTemplate(tpl); setPickerRect(null); }}
                onClose={() => setPickerRect(null)}
              />
            )}
          </div>
        )}
        {atLimit && (
          <p className="text-xs text-muted-foreground text-center py-2">25 question limit reached</p>
        )}
      </div>
    </div>
  );
}

export function QuestionTypePicker({ onPick, onPickTemplate, onClose, rect }: {
  onPick: (type: QuestionType) => void;
  onPickTemplate: (tpl: QuestionTemplate) => void;
  onClose: () => void;
  rect: DOMRect | null;
}) {
  const PICKER_W = 256;
  const PICKER_MAX_H = 320; // max-h-80 = 20rem
  const GAP = 8;
  const EDGE = 12;
  // #6: rect is captured at click time by the caller. If it's ever missing,
  // fall back to a CENTERED fixed position so the picker is always visible —
  // an unpositioned picker was the root cause of "Add question does nothing".
  const style: React.CSSProperties = rect
    ? (() => {
        const viewportH = window.innerHeight;
        const viewportW = window.innerWidth;
        const spaceBelow = viewportH - rect.bottom - GAP;
        const spaceAbove = rect.top - GAP;
        const openUpward = spaceBelow < PICKER_MAX_H && spaceAbove > spaceBelow;
        const maxHeight = Math.min(PICKER_MAX_H, Math.max(160, openUpward ? spaceAbove : spaceBelow));
        const desiredTop = openUpward ? rect.top - GAP - maxHeight : rect.bottom + GAP;
        const top = Math.max(EDGE, Math.min(desiredTop, viewportH - maxHeight - EDGE));
        const left = Math.max(EDGE, Math.min(rect.left, viewportW - PICKER_W - EDGE));
        return {
          position: "fixed",
          top,
          left,
          width: PICKER_W,
          maxHeight,
          zIndex: 50,
        };
      })()
    : { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: PICKER_W, maxHeight: PICKER_MAX_H, zIndex: 50 };

  // Portal to <body>: the picker positions itself with viewport (fixed)
  // coordinates from getBoundingClientRect. Rendered inside the section it
  // sits under transformed ancestors (AdminShell's animated panel, dnd-kit
  // items mid-drag), which hijack position:fixed — once the builder page was
  // scrolled, the picker landed off-screen and "Add question" looked dead.
  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="z-50 rounded-xl border border-border bg-card shadow-xl p-3 space-y-3 overflow-y-auto" style={style}>
        {/* #8: quick templates — one click adds a fully-configured question */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 px-1">Templates</p>
          <div className="space-y-0.5">
            {QUESTION_TEMPLATES.map(tpl => (
              <button key={tpl.id} onClick={() => onPickTemplate(tpl)}
                className="w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-secondary transition-colors">
                {tpl.label}
              </button>
            ))}
          </div>
        </div>
        {CATEGORIES.map(cat => (
          <div key={cat}>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 px-1">{cat}</p>
            <div className="space-y-0.5">
              {QUESTION_TYPES.filter(t => t.category === cat).map(t => (
                <button key={t.type} onClick={() => onPick(t.type)}
                  className="w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-secondary transition-colors">
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>,
    document.body
  );
}
