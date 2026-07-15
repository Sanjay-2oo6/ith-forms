import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  QUESTION_TYPES, RATING_DEFAULT_MAX, RATING_MIN_ALLOWED, RATING_MAX_ALLOWED,
  type QuestionType,
} from "@/lib/question-types";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ConfirmFn } from "@/components/ConfirmDialog";
import type { Question, QuestionConfig } from "./types";

const CATEGORIES = [...new Set(QUESTION_TYPES.map(q => q.category))];
const CHOICE = ["dropdown", "radio", "checkbox", "poll"];

export const MemoQuestionCard = React.memo(QuestionCard, (prev, next) => {
  return prev.question === next.question && prev.isNew === next.isNew;
});

export function QuestionCard({ question, onUpdate, onDelete, isNew, onMounted, confirm }: {
  question: Question;
  onUpdate: (p: Partial<Question>) => void;
  onDelete: () => void;
  isNew?: boolean;
  onMounted?: () => void;
  confirm: ConfirmFn;
}) {
  const hasOptions = CHOICE.includes(question.type);
  const cfg = question.config ?? {};
  const setCfg = (patch: Partial<QuestionConfig>) => onUpdate({ config: { ...cfg, ...patch } });
  const [expanded, setExpanded] = useState(!!isNew);
  const labelRef = useRef<HTMLInputElement>(null);

  // Sortable inside the section's nested DndContext.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });

  useEffect(() => {
    if (isNew) {
      labelRef.current?.focus();
      labelRef.current?.select();
      onMounted?.();
    }
  }, []);

  // Change an existing question's type. Guard the data transition:
  // → switching TO a choice type with no options seeds two defaults
  // → switching AWAY from a choice type drops the options
  async function changeType(nextType: QuestionType) {
    // Warn before a transition that discards configured options.
    const losesOptions =
      CHOICE.includes(question.type) && !CHOICE.includes(nextType) && (question.options?.length ?? 0) > 0;
    if (losesOptions) {
      const confirmed = await confirm({
        title: "Change Question Type",
        message: "Switching to a non-choice type will remove this question's options. Continue?",
        confirmLabel: "Continue",
        variant: "default",
      });
      if (!confirmed) return;
    }
    const patch: Partial<Question> = { type: nextType };
    if (CHOICE.includes(nextType)) {
      if (!question.options || question.options.length === 0) {
        patch.options = [{ label: "Option 1", value: "option_1" }, { label: "Option 2", value: "option_2" }];
      }
    } else {
      patch.options = [];
    }
    // Seed per-type config when switching into a configurable type.
    if (nextType === "file" && cfg.accept === undefined) patch.config = { ...cfg, accept: [".pdf", ".docx", ".jpg", ".jpeg", ".png"], maxFiles: 1 };
    else if (nextType === "rating" && cfg.ratingMax === undefined) patch.config = { ...cfg, ratingMax: RATING_DEFAULT_MAX };
    else if (nextType === "grid" && !cfg.rows) patch.config = { ...cfg, rows: ["Row 1", "Row 2"], cols: ["Column 1", "Column 2"] };
    onUpdate(patch);
    setExpanded(true);
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className="rounded-lg border border-border/40 bg-background shadow-sm"
    >
      {/* ITEM 4: Redesigned Header - Compact */}
      <div className="flex items-center gap-3 px-3 py-2 bg-secondary/20 border-b border-border/30">
        <button {...attributes} {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none shrink-0 p-0.5 -m-0.5"
          title="Drag to reorder question">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <span className="text-xs text-muted-foreground flex-1">
          {QUESTION_TYPES.find(t => t.type === question.type)?.label ?? question.type}
        </span>
        {/* ITEM 5: Required Toggle Switch */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">Required</span>
          <button
            type="button"
            onClick={() => onUpdate({ required: !question.required })}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              question.required ? 'bg-primary' : 'bg-secondary border border-border'
            }`}
            aria-label={question.required ? "Mark as optional" : "Mark as required"}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform shadow-sm ${
                question.required ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <button onClick={() => setExpanded(v => !v)} className="p-1 text-muted-foreground hover:text-foreground" aria-label={expanded ? "Collapse question" : "Expand question"}>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <button onClick={onDelete} className="p-1 hover:text-destructive transition-colors" aria-label="Delete question">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* ITEM 4: Redesigned Layout - Left/Right Split */}
      {expanded && (
        <div className="flex gap-4 p-4">
          {/* LEFT SIDE: Question Fields (70%) */}
          <div className="flex-1 space-y-3">
            {/* Question Input - LARGE and PROMINENT */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Question {question.required && <span className="text-destructive">*</span>}
              </label>
              <input
                ref={labelRef}
                value={question.label}
                onChange={e => onUpdate({ label: e.target.value })}
                className="w-full text-base font-medium rounded-lg border border-input bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors"
                placeholder="What would you like to ask?"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Description (optional)
              </label>
              <textarea
                value={question.description ?? ""}
                onChange={e => onUpdate({ description: e.target.value || null })}
                className="w-full text-sm rounded-lg border border-input bg-card px-3 py-2 outline-none focus:ring-1 focus:ring-ring resize-none"
                placeholder="Add help text or additional context"
                rows={2}
              />
            </div>

            {/* Placeholder */}
            {!["section_heading","information_paragraph","hidden","yes_no","consent","rating","linear_scale"].includes(question.type) && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Placeholder (optional)
                </label>
                <input
                  value={question.placeholder ?? ""}
                  onChange={e => onUpdate({ placeholder: e.target.value || null })}
                  className="w-full text-sm rounded-lg border border-input bg-card px-3 py-2 outline-none focus:ring-1 focus:ring-ring"
                  placeholder="e.g., John Doe"
                />
              </div>
            )}

            {/* Options Editor (if applicable) */}
            {hasOptions && (
              <div>
                <OptionsEditor
                  options={question.options}
                  onChange={opts => onUpdate({ options: opts })}
                />
              </div>
            )}

            {/* Per-type configuration (requirements #4/#5/#6) */}
            <ConfigEditor type={question.type} cfg={cfg} setCfg={setCfg} />
          </div>

          {/* RIGHT SIDE: Question Type Selector (30%) */}
          <div className="w-64 shrink-0">
            <label className="block text-sm font-semibold text-foreground mb-3">
              Question Type
            </label>
            <div className="space-y-1 max-h-96 overflow-y-auto pr-2">
              {CATEGORIES.map(category => (
                <div key={category} className="mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-2">
                    {category}
                  </p>
                  {QUESTION_TYPES.filter(t => t.category === category).map(qType => (
                    <button
                      key={qType.type}
                      onClick={() => changeType(qType.type)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        question.type === qType.type
                          ? 'bg-primary text-primary-foreground font-medium'
                          : 'hover:bg-secondary text-foreground'
                      }`}
                    >
                      {qType.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Collapsed Preview */}
      {!expanded && (
        <div className="px-4 py-3">
          <p className="text-sm font-medium text-foreground truncate">
            {question.label || <span className="text-muted-foreground italic">Untitled question</span>}
          </p>
        </div>
      )}
    </div>
  );
}

function OptionsEditor({ options, onChange }: {
  options: { label: string; value: string }[];
  onChange: (opts: { label: string; value: string }[]) => void;
}) {
  function addOption() {
    // F2/F3: generate a STABLE, unique, slug-safe value (no commas, never
    // collides). The value is fixed at creation and never derived from the
    // label again, so editing a label can't orphan already-stored answers.
    const existing = new Set(options.map(o => o.value));
    let n = options.length + 1;
    while (existing.has(`option_${n}`)) n++;
    onChange([...options, { label: `Option ${n}`, value: `option_${n}` }]);
  }
  function updateOption(i: number, label: string) {
    // Only the label changes; the value stays stable (F3).
    const next = options.map((o, idx) => idx === i ? { ...o, label } : o);
    onChange(next);
  }
  function removeOption(i: number) {
    onChange(options.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">Options</p>
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            value={opt.label}
            onChange={e => updateOption(i, e.target.value)}
            className="flex-1 text-xs rounded border border-input bg-card px-2 py-1 outline-none focus:ring-1 focus:ring-ring"
          />
          <button onClick={() => removeOption(i)} className="p-1 hover:text-destructive" aria-label="Remove option"><Trash2 className="h-3 w-3" /></button>
        </div>
      ))}
      <button onClick={addOption} className="flex items-center gap-1 text-xs text-primary hover:underline">
        <Plus className="h-3 w-3" /> Add option
      </button>
    </div>
  );
}

// A small editable list of plain-string labels (used for grid rows/columns).
function StringListEditor({ label, items, onChange, addLabel }: {
  label: string; items: string[]; onChange: (v: string[]) => void; addLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input value={it}
            onChange={e => onChange(items.map((v, idx) => idx === i ? e.target.value : v))}
            className="flex-1 text-xs rounded border border-input bg-card px-2 py-1 outline-none focus:ring-1 focus:ring-ring" />
          <button onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            className="p-1 hover:text-destructive" aria-label={`Remove ${label}`}><Trash2 className="h-3 w-3" /></button>
        </div>
      ))}
      <button onClick={() => onChange([...items, `${addLabel} ${items.length + 1}`])}
        className="flex items-center gap-1 text-xs text-primary hover:underline">
        <Plus className="h-3 w-3" /> Add {addLabel.toLowerCase()}
      </button>
    </div>
  );
}

// #10: per-question media (one image OR one video), stored in form-assets.
const MEDIA_IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".heic"];
const MEDIA_VIDEO_EXTS = [".mp4", ".mov"];

function MediaEditor({ cfg, setCfg }: {
  cfg: QuestionConfig; setCfg: (p: Partial<QuestionConfig>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const media = cfg.media;
  const mediaUrl = media
    ? media.pendingDataUrl ?? (media.path ? supabase.storage.from("form-assets").getPublicUrl(media.path).data.publicUrl : null)
    : null;

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const lower = file.name.toLowerCase();
    const isImage = MEDIA_IMAGE_EXTS.some(x => lower.endsWith(x));
    const isVideo = MEDIA_VIDEO_EXTS.some(x => lower.endsWith(x));
    if (!isImage && !isVideo) {
      toast.error(`Unsupported media type. Images: ${MEDIA_IMAGE_EXTS.join(", ")} · Videos: ${MEDIA_VIDEO_EXTS.join(", ")}`);
      return;
    }
    if (file.size > 25 * 1024 * 1024) { toast.error("Media must be under 25 MB."); return; }
    setBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      setBusy(false);
      setCfg({
        media: {
          kind: isImage ? "image" : "video",
          pendingDataUrl: String(reader.result),
          pendingName: file.name,
          pendingType: file.type,
          oldPath: media?.oldPath ?? media?.path,
        },
      });
      toast.success("Media ready to save");
    };
    reader.onerror = () => {
      setBusy(false);
      toast.error("Media could not be read. Please try another file.");
    };
    reader.readAsDataURL(file);
  }

  function removeMedia() {
    setCfg({ media: undefined });
  }

  return (
    <div className="space-y-2 pt-2 border-t border-border/30">
      <p className="text-xs text-muted-foreground">Question media (optional — one image or video)</p>
      {media && mediaUrl ? (
        <div className="space-y-2">
          {media.kind === "image"
            ? <img src={mediaUrl} alt="Question media" className="max-h-32 rounded-lg border border-border object-cover" />
            : <video src={mediaUrl} controls className="max-h-32 rounded-lg border border-border" />}
          <div className="flex gap-2">
            <button onClick={() => inputRef.current?.click()} disabled={busy}
              className="px-2.5 py-1 rounded-md border border-border text-xs hover:bg-secondary disabled:opacity-60">
              Replace
            </button>
            <button onClick={removeMedia}
              className="px-2.5 py-1 rounded-md border border-border text-xs text-destructive hover:bg-destructive/10">
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()} disabled={busy}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:border-primary/60 hover:text-primary transition-colors disabled:opacity-60">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add media
        </button>
      )}
      <input ref={inputRef} type="file" hidden
        accept={[...MEDIA_IMAGE_EXTS, ...MEDIA_VIDEO_EXTS].join(",")}
        onChange={upload} />
    </div>
  );
}

// Per-question configuration controls, shown only for the types that need them.
function ConfigEditor({ type, cfg, setCfg }: {
  type: QuestionType; cfg: QuestionConfig; setCfg: (p: Partial<QuestionConfig>) => void;
}) {
  const FILE_EXTS = [".pdf", ".docx", ".jpg", ".jpeg", ".png"];
  const numInput = "w-24 text-xs rounded border border-input bg-card px-2 py-1 outline-none focus:ring-1 focus:ring-ring";

  // Media is available on EVERY question type (#10).
  const media = <MediaEditor cfg={cfg} setCfg={setCfg} />;

  if (type === "file") {
    const accept = cfg.accept ?? FILE_EXTS;
    return (
      <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Accepted file types</p>
        <div className="flex flex-wrap gap-2">
          {FILE_EXTS.map(ext => {
            const on = accept.includes(ext);
            return (
              <label key={ext} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={on} className="accent-primary rounded"
                  onChange={e => {
                    const next = e.target.checked ? [...accept, ext] : accept.filter(a => a !== ext);
                    setCfg({ accept: next.length ? next : [ext] }); // keep at least one
                  }} />
                {ext}
              </label>
            );
          })}
        </div>
        {/* #11: admin-configurable max file size */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Max file size (MB)</label>
          <input type="number" min={1} max={50} value={cfg.maxSizeMB ?? 10}
            onChange={e => setCfg({ maxSizeMB: Math.max(1, Math.min(50, parseInt(e.target.value) || 10)) })}
            className={numInput} />
        </div>
        <p className="text-[11px] text-muted-foreground">Only one file may be uploaded per question.</p>
      </div>
      {media}
      </div>
    );
  }

  if (type === "rating") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Rating scale: 1 to</label>
          <input type="number" min={RATING_MIN_ALLOWED} max={RATING_MAX_ALLOWED}
            value={cfg.ratingMax ?? RATING_DEFAULT_MAX}
            onChange={e => {
              const v = Math.max(RATING_MIN_ALLOWED, Math.min(RATING_MAX_ALLOWED, parseInt(e.target.value) || RATING_DEFAULT_MAX));
              setCfg({ ratingMax: v });
            }}
            className={numInput} />
        </div>
        {media}
      </div>
    );
  }

  if (type === "short_text" || type === "long_text") {
    return (
      <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Min length</label>
          <input type="number" min={0} value={cfg.minLength ?? ""} placeholder="0"
            onChange={e => setCfg({ minLength: e.target.value === "" ? undefined : Math.max(0, parseInt(e.target.value) || 0) })}
            className={numInput} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Max length</label>
          <input type="number" min={1} value={cfg.maxLength ?? ""} placeholder="none"
            onChange={e => setCfg({ maxLength: e.target.value === "" ? undefined : Math.max(1, parseInt(e.target.value) || 1) })}
            className={numInput} />
        </div>
      </div>
      {media}
      </div>
    );
  }

  if (type === "checkbox") {
    return (
      <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Min selections</label>
          <input type="number" min={0} value={cfg.minSelections ?? ""} placeholder="0"
            onChange={e => setCfg({ minSelections: e.target.value === "" ? undefined : Math.max(0, parseInt(e.target.value) || 0) })}
            className={numInput} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Max selections</label>
          <input type="number" min={1} value={cfg.maxSelections ?? ""} placeholder="none"
            onChange={e => setCfg({ maxSelections: e.target.value === "" ? undefined : Math.max(1, parseInt(e.target.value) || 1) })}
            className={numInput} />
        </div>
      </div>
      {media}
      </div>
    );
  }

  if (type === "grid") {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <StringListEditor label="Rows" items={cfg.rows ?? []} addLabel="Row"
            onChange={rows => setCfg({ rows })} />
          <StringListEditor label="Columns" items={cfg.cols ?? []} addLabel="Column"
            onChange={cols => setCfg({ cols })} />
        </div>
        {media}
      </div>
    );
  }

  // All remaining types: media only.
  return media;
}
