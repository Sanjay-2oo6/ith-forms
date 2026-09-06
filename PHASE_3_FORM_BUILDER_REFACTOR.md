# PHASE 3: Form Builder Refactoring
## Code Organization & Maintainability Improvements

**Status**: Analysis complete, refactoring plan ready  
**Timeline**: Week 3–4 (8 hours, can be phased in)  
**Benefit**: Easier testing, better separation of concerns, clearer code intent

---

## 📊 Current State Analysis

### File: `src/routes/_admin/forms/$formId/edit.tsx`

**Size**: 535 lines  
**Responsibilities**: 
1. Route setup (createFileRoute)
2. State management (14 useState calls)
3. Data loading (async load)
4. Form/section/question mutations (add/update/delete/reorder)
5. Media upload handling
6. Save/publish RPC calls
7. Validation logic
8. UI rendering + layout

**Pain Points**:
- Too many state variables (hard to track)
- Long async functions (saveAll, publish)
- Validation logic mixed with mutation logic
- Reusable logic (normalize, renumber, renamePositions) at module level but not tested
- Hard to unit test component because of tight coupling to Supabase

### Positive Aspects ✅
- Already splits into `BuilderTab` + `SettingsTab` components
- Good separation of server mutations
- Clear variable names
- Inline comments explain non-obvious behavior

---

## 🎯 Refactoring Strategy

### NOT Recommended: Breaking into 6–10 Tiny Components
This would just move complexity around (lots of prop drilling). Instead:

### RECOMMENDED: Extract Concerns into Hooks & Modules

**Goal**: Make edit.tsx ~350 lines (pure render logic + orchestration)

---

## 📋 Refactoring Tasks

### Task 1: Extract Form State Hook

**File**: `src/lib/useFormBuilder.ts` (new)

```typescript
/**
 * Manages form/sections/questions state + mutations
 * Handles: state updates, validation, normalization
 */
export function useFormBuilder(initialForm: Form | null) {
  const [form, setForm] = useState<Form | null>(initialForm);
  const [sections, setSections] = useState<Section[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [savedQuestions, setSavedQuestions] = useState<Question[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [invalidSectionIds, setInvalidSectionIds] = useState<string[]>([]);

  const updateForm = (patch: Partial<Form>) => { /* ... */ };
  const addSection = (afterPosition?: number) => { /* ... */ };
  const updateSection = (id: string, patch: Partial<Section>) => { /* ... */ };
  const deleteSection = (id: string) => { /* ... */ };
  const addQuestion = (sectionId: string, type: QuestionType, overrides?: {...}) => { /* ... */ };
  const updateQuestion = (id: string, patch: Partial<Question>) => { /* ... */ };
  const deleteQuestion = (id: string) => { /* ... */ };
  const reorderSections = (activeId: string, overId: string) => { /* ... */ };
  const reorderQuestions = (sectionId: string, activeId: string, overId: string) => { /* ... */ };

  return {
    form, setForm,
    sections, setSections,
    questions, setQuestions,
    savedQuestions, setSavedQuestions,
    hasUnsavedChanges, setHasUnsavedChanges,
    invalidSectionIds, setInvalidSectionIds,
    updateForm,
    addSection, updateSection, deleteSection,
    addQuestion, updateQuestion, deleteQuestion,
    reorderSections, reorderQuestions,
  };
}
```

**Benefits**:
- Easy to test: just pass data, check mutations
- Reusable in other components
- Easier to understand state flow

**Effort**: 2 hours

---

### Task 2: Extract Save/Publish Hooks

**File**: `src/lib/useFormSave.ts` (new)

```typescript
/**
 * Handles form persistence: save, publish, unpublish
 * Manages: media upload, RPC calls, error handling
 */
export function useFormSave() {
  const uploadPendingMedia = async (questions: Question[]) => { /* ... */ };
  const saveAll = async (
    form: Form,
    sections: Section[],
    questions: Question[],
    savedQuestions: Question[]
  ) => { /* ... */ };
  const publish = async (form: Form, sections: Section[], questions: Question[]) => { /* ... */ };
  const unpublish = async (form: Form) => { /* ... */ };

  return { uploadPendingMedia, saveAll, publish, unpublish };
}
```

**Benefits**:
- Isolates Supabase calls for easier mocking
- Easier to test upload + save logic
- Can be reused elsewhere

**Effort**: 2 hours

---

### Task 3: Extract Validation Logic

**File**: `src/lib/formBuilderValidation.ts` (new or extend `src/lib/validation.ts`)

```typescript
/**
 * Validation rules for form builder
 */
export function validateForm(
  form: Form,
  sections: Section[],
  questions: Question[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!form.title.trim()) errors.push("Form title is required");
  if (questions.length > 25) errors.push("Form has reached the 25 question limit");
  
  const emptyIds = sections
    .filter(sec => !questions.some(q => q.section_id === sec.id))
    .map(sec => sec.id);
  if (emptyIds.length > 0) errors.push("Each section must contain at least one question");

  return {
    valid: errors.length === 0,
    errors,
    emptyIds: emptyIds.length > 0 ? emptyIds : undefined,
  };
}

export function validatePublish(
  sections: Section[],
  questions: Question[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (sections.length === 0) errors.push("Add at least one section before publishing");
  
  const realQuestions = questions.filter(
    q => !["section_heading", "information_paragraph", "hidden"].includes(q.type)
  );
  if (realQuestions.length === 0) errors.push("Add at least one question before publishing");

  return { valid: errors.length === 0, errors };
}
```

**Benefits**:
- Testable validation (pass data, check results)
- Reusable in form submission too
- Easier to modify rules

**Effort**: 1 hour

---

### Task 4: Extract Normalization Utilities

**File**: Keep in `src/lib/formBuilder.ts` (rename/consolidate existing utils)

```typescript
/**
 * Data normalization helpers
 */
export function renumberSections(list: Section[]): Section[] { /* ... */ }
export function normalizeSections(list: Section[]): Section[] { /* ... */ }
export function normalizeQuestions(list: Question[], sections: Section[]): Question[] { /* ... */ }
export function buildFormPayload(form: Form): FormPayload { /* ... */ }
export function stripPendingMedia(question: Question): Question { /* ... */ }
export function mediaPaths(questions: Question[]): Set<string> { /* ... */ }
```

Already at module level — just ensure they're exported and documented.

**Effort**: 0.5 hour (just move + document)

---

### Task 5: Refactor edit.tsx to Use Hooks

**File**: `src/routes/_admin/forms/$formId/edit.tsx` (refactored)

**Before**: 535 lines  
**After**: ~300 lines

```typescript
export function FormEditor() {
  const { formId } = Route.useParams();
  
  // Import extracted hooks
  const builder = useFormBuilder(null);
  const { uploadPendingMedia, saveAll, publish, unpublish } = useFormSave();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [activeTab, setActiveTab] = useState<"builder" | "settings">("builder");
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [lastAddedSectionId, setLastAddedSectionId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Load form
  useEffect(() => {
    const load = async () => {
      const [fRes, sRes, qRes] = await Promise.all([...]);
      builder.setForm(fRes.data as Form);
      builder.setSections(sRes.data as Section[]);
      // ...
    };
    load();
  }, [formId]);

  // Unsaved changes warning
  useBlocker({...});

  // Handle save
  const handleSave = async () => {
    const validation = validateForm(builder.form, builder.sections, builder.questions);
    if (!validation.valid) {
      toast.error(validation.errors[0]);
      return;
    }
    setSaveState("saving");
    const result = await saveAll(...);
    setSaveState(result ? "saved" : "error");
  };

  // Render: same as before but calls builder.* for mutations
  return (
    <AdminShell>
      {/* header with form title, save button */}
      {/* tabs: builder / settings */}
      {/* content */}
    </AdminShell>
  );
}
```

**Benefits**:
- Easier to read (clear what each hook does)
- Easier to test (mock the hooks)
- Logic is in hooks (unit testable)

**Effort**: 2 hours

---

### Task 6: Add Unit Tests for Hooks

**Files**: 
- `src/lib/useFormBuilder.test.ts`
- `src/lib/useFormSave.test.ts`
- `src/lib/formBuilderValidation.test.ts`

Example test:

```typescript
// src/lib/formBuilderValidation.test.ts
import { describe, it, expect } from "vitest";
import { validateForm, validatePublish } from "./formBuilderValidation";

describe("validateForm", () => {
  it("rejects empty title", () => {
    const form = { title: "", ...otherFields };
    const result = validateForm(form, [], []);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Form title is required");
  });

  it("rejects >25 questions", () => {
    const form = { title: "Test", ...otherFields };
    const questions = Array(26).fill({...});
    const result = validateForm(form, [], questions);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("reached the 25 question limit");
  });

  it("rejects empty sections", () => {
    const form = { title: "Test", ...otherFields };
    const sections = [{ id: "1", ...otherFields }];
    const questions = [];
    const result = validateForm(form, sections, questions);
    expect(result.valid).toBe(false);
    expect(result.emptyIds).toContain("1");
  });
});

describe("validatePublish", () => {
  it("requires at least one section", () => {
    const result = validatePublish([], []);
    expect(result.valid).toBe(false);
  });

  it("requires real questions (not just headers)", () => {
    const sections = [{ id: "1", ...otherFields }];
    const questions = [{ id: "1", section_id: "1", type: "section_heading", ...otherFields }];
    const result = validatePublish(sections, questions);
    expect(result.valid).toBe(false);
  });
});
```

**Benefits**:
- Catch regressions early
- Document expected behavior
- Make refactoring safer

**Effort**: 2 hours

---

## 🚀 Implementation Plan

### Week 3–4 Phased Approach

**Option A: All at Once (faster, riskier)**
- Day 1–2: Extract hooks + utilities
- Day 3: Refactor edit.tsx
- Day 4: Add tests
- Day 5: Deploy & test in staging

**Option B: Gradual (safer, slower)**
- Week 3 Day 1–2: Extract hooks + tests
- Week 3 Day 3–5: Refactor edit.tsx incrementally
- Week 4 Day 1–2: Final testing + fixes
- Week 4 Day 3: Deploy

**Recommendation**: Option A (all at once) because:
- Changes are self-contained (no API changes)
- Well-tested can be deployed immediately
- Easier to review as a unit

---

## ✅ Success Criteria

After refactoring:

- [ ] edit.tsx ≤ 350 lines (was 535)
- [ ] All mutations moved to hooks
- [ ] All state moved to `useFormBuilder`
- [ ] All validation in separate module
- [ ] Full typecheck passing
- [ ] All new hooks have unit tests (80%+ coverage)
- [ ] Form builder UI works identically (no user-facing changes)
- [ ] No console errors or warnings
- [ ] Performance same or better

---

## 📚 File Structure After Refactoring

```
src/
├── lib/
│   ├── useFormBuilder.ts          (new - state management)
│   ├── useFormSave.ts             (new - persistence)
│   ├── formBuilderValidation.ts   (new - validation rules)
│   ├── formBuilder.ts             (existing - normalization utils)
│   └── validation.ts              (existing - general validation)
├── routes/
│   └── _admin/forms/
│       └── $formId/
│           └── edit.tsx           (refactored - 300 lines)
└── __tests__/
    ├── useFormBuilder.test.ts     (new)
    ├── useFormSave.test.ts        (new)
    └── formBuilderValidation.test.ts (new)
```

---

## 🔄 Rollback Plan

If issues arise after deployment:

1. Revert to previous commit (all changes in single PR)
2. Revert takes 5 minutes (one git revert)
3. Features are additive (no data model changes)
4. No database migrations needed

---

## 💡 Future Enhancements (Phase 4+)

After this refactoring:

- [ ] Add Zod schemas for form/section/question validation
- [ ] Create form builder context for deeply nested components
- [ ] Add keyboard shortcuts (Ctrl+S to save, Ctrl+P to preview)
- [ ] Extract question card into sub-components
- [ ] Add form builder animations (fade in new items)
- [ ] Implement undo/redo (with history hook)

---

## 📝 Notes

- **No breaking changes**: All exported APIs remain the same
- **No new dependencies**: Uses existing hooks (useState, useEffect)
- **Testable immediately**: Tests can be added incrementally
- **Safe to deploy**: Can be feature-flagged if needed (but not necessary)

---

**Next Steps**:

1. Review this plan ✅
2. Create hooks in order (useFormBuilder → useFormSave → validation)
3. Refactor edit.tsx to use hooks
4. Add tests
5. Deploy!

Estimated total effort: **8 hours** (matches Phase 3 budget)
