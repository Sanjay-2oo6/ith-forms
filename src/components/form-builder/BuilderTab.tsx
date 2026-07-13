import { Plus } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { QuestionType, QuestionTemplate } from "@/lib/question-types";
import type { ConfirmFn } from "@/components/ConfirmDialog";
import { SectionBlock } from "./SectionBlock";
import type { Question, Section } from "./types";

export function BuilderTab({ sections, questions, onAddSection, onUpdateSection, onDeleteSection, onAddQuestion, onAddTemplate, onUpdateQuestion, onDeleteQuestion, questionCount, lastAddedId, onClearLastAdded, lastAddedSectionId, onClearLastAddedSection, invalidSectionIds, onReorderSections, onReorderQuestions, confirm }: {
  sections: Section[];
  questions: Question[];
  onAddSection: (afterPosition?: number) => void;
  onUpdateSection: (id: string, p: Partial<Section>) => void;
  onDeleteSection: (id: string) => void;
  onAddQuestion: (sectionId: string, type: QuestionType) => void;
  onAddTemplate: (sectionId: string, tpl: QuestionTemplate) => void;
  onUpdateQuestion: (id: string, p: Partial<Question>) => void;
  onDeleteQuestion: (id: string) => void;
  questionCount: number;
  lastAddedId: string | null;
  onClearLastAdded: () => void;
  lastAddedSectionId: string | null;
  onClearLastAddedSection: () => void;
  invalidSectionIds: string[];
  onReorderSections: (activeId: string, overId: string) => void;
  onReorderQuestions: (sectionId: string, activeId: string, overId: string) => void;
  confirm: ConfirmFn;
}) {
  // distance: 5 so plain clicks on the grip don't start a drag accidentally
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{questionCount}/25 questions · drag the grips to reorder</p>
        <button onClick={() => onAddSection()} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
          <Plus className="h-4 w-4" /> Add section
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={e => {
          if (e.over && e.active.id !== e.over.id) onReorderSections(String(e.active.id), String(e.over.id));
        }}
      >
        <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
          {sections.map(sec => (
            <div key={sec.id} className="space-y-6">
              <SectionBlock
                section={sec}
                questions={questions.filter(q => q.section_id === sec.id).sort((a, b) => a.position - b.position)}
                canDelete={sections.length > 1}
                onUpdate={p => onUpdateSection(sec.id, p)}
                onDelete={() => onDeleteSection(sec.id)}
                onAddQuestion={type => onAddQuestion(sec.id, type)}
                onAddTemplate={tpl => onAddTemplate(sec.id, tpl)}
                onUpdateQuestion={onUpdateQuestion}
                onDeleteQuestion={onDeleteQuestion}
                atLimit={questionCount >= 25}
                lastAddedId={lastAddedId}
                onClearLastAdded={onClearLastAdded}
                isNew={sec.id === lastAddedSectionId}
                onMounted={onClearLastAddedSection}
                invalid={invalidSectionIds.includes(sec.id)}
                onReorderQuestions={(a, b) => onReorderQuestions(sec.id, a, b)}
                confirm={confirm}
              />
              {/* Fix #3: Add Section inserts immediately after current section */}
              <button onClick={() => onAddSection(sec.position)}
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground hover:border-primary/60 hover:text-primary transition-colors">
                <Plus className="h-4 w-4" /> Add section
              </button>
            </div>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
