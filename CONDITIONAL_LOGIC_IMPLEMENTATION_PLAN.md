# Conditional Logic Implementation Plan
**Feature**: Section branching based on question answers  
**Status**: Ready to implement  
**Risk Level**: Medium (affects form rendering & validation)  
**Estimated Time**: 6-8 hours  
**Testing Strategy**: Test locally at each phase before proceeding

---

## 🎯 Goal
Allow admins to show/hide form sections based on user answers.

**Example**: 
- Question: "Are you a student?"
- If answer = "Yes" → Show "Student Information" section
- If answer = "No" → Show "Professional Information" section

---

## 📊 Implementation Phases

### Phase 1: Database Schema (✅ SAFE - 5 minutes)
**What**: Add documentation comment to existing `config` field  
**Risk**: NONE (read-only comment)  
**Files**: 
- `supabase/migrations/060_add_conditional_logic.sql` (NEW)

**Test Command**:
```sql
-- Run in Supabase SQL Editor
SELECT config->>'logic_rules' FROM form_questions LIMIT 1;
-- Should return NULL (field exists but empty)
```

---

### Phase 2: Types & Logic Engine (✅ SAFE - 1 hour)
**What**: Create logic evaluation engine with unit tests  
**Risk**: NONE (new files, no side effects)  
**Files**:
- `src/lib/logic-engine.ts` (NEW)
- `src/lib/logic-engine.test.ts` (NEW)
- `src/lib/validation.ts` (MODIFY - add LogicRule type)

**Test Commands**:
```bash
# Type checking
npm run typecheck

# Unit tests
npm test -- logic-engine.test.ts

# Should pass all tests before proceeding
```

**Logic Engine Functions**:
```typescript
// Evaluate which sections should be visible
evaluateLogicRules(
  answers: Record<string, any>,
  questions: Question[],
  sections: Section[]
): {
  visibleSectionIds: Set<string>,
  hiddenQuestionIds: Set<string>
}

// Check if a specific answer triggers a rule
matchesCondition(
  answer: any,
  condition: "equals",
  value: string
): boolean
```

---

### Phase 3: Builder UI (⚠️ LOW RISK - 3 hours)
**What**: Add "Logic" tab to question editor  
**Risk**: LOW (builder-only, public forms unaffected)  
**Files**:
- `src/components/form-builder/LogicRuleEditor.tsx` (NEW)
- `src/components/form-builder/QuestionCard.tsx` (MODIFY - add Logic tab)

**Test Procedure**:
1. Start dev server: `npm run dev`
2. Open form builder at: `http://localhost:3000/admin/forms/edit/[form-id]`
3. Create a multiple choice question
4. Click new "Logic" tab
5. Add a logic rule:
   - Condition: "equals"
   - Value: "yes"
   - Target Section: Select from dropdown
6. Save form
7. Verify in Supabase database:
   ```sql
   SELECT config->'logic_rules' FROM form_questions WHERE id = '[question-id]';
   ```
8. Should see JSON array with the rule

**UI Features**:
- Add rule button
- Condition selector (Phase 1: only "equals")
- Value input
- Section dropdown (only sections AFTER current question)
- Delete rule button
- Visual indicator showing rule is active

---

### Phase 4: Public Form Integration (⚠️ MEDIUM RISK - 1.5 hours)
**What**: Integrate logic engine into public form rendering  
**Risk**: MEDIUM (affects form display)  
**Files**:
- `src/routes/forms/$slug.tsx` (MODIFY - integrate logic evaluation)

**Changes**:
```typescript
// Add logic evaluation hook
const { visibleSectionIds, hiddenQuestionIds } = useMemo(() => {
  if (!ENABLE_CONDITIONAL_LOGIC) {
    // Feature flag disabled - show everything
    return {
      visibleSectionIds: new Set(allSectionIds),
      hiddenQuestionIds: new Set()
    };
  }
  
  return evaluateLogicRules(answers, questions, sections);
}, [answers, questions, sections]);

// Filter visible sections
const visibleSections = sections.filter(s => 
  visibleSectionIds.has(s.id)
);

// Filter visible questions
const visibleQuestions = questions.filter(q => 
  !hiddenQuestionIds.has(q.id)
);
```

**Test Procedure**:
1. Create test form with logic rules
2. Open public form: `http://localhost:3000/forms/[slug]`
3. Test all scenarios:
   - Default state (no rules triggered)
   - Answer triggers "show section"
   - Answer triggers "hide section"
   - Multiple rules on same question
   - Cascading rules (Section A answer affects Section B)
4. Verify with browser DevTools:
   - Check rendered DOM
   - Verify hidden sections not in DOM
   - Check console for errors

**Test Cases**:
```bash
# Test 1: Simple show/hide
- Q1: "Are you a student?" (Yes/No)
- Rule: If "Yes" → Show "Student Info" section
- Expected: Selecting "Yes" shows section, "No" hides it

# Test 2: Multi-option branching
- Q1: "Your role?" (Student/Teacher/Parent)
- Rule 1: If "Student" → Show "Student Section"
- Rule 2: If "Teacher" → Show "Teacher Section"
- Rule 3: If "Parent" → Show "Parent Section"
- Expected: Only one section visible based on selection

# Test 3: Cascading logic
- Q1: "Type?" → Affects Section B
- Q2 in Section B: "Sub-type?" → Affects Section C
- Expected: Changes to Q1 re-evaluate all rules
```

---

### Phase 5: Validation & Submission (⚠️ MEDIUM RISK - 30 minutes)
**What**: Skip validation for hidden questions, filter answers  
**Risk**: MEDIUM (affects submission logic)  
**Files**:
- `src/routes/forms/$slug.tsx` (MODIFY - validation & submission)

**Changes**:
```typescript
// Validation: Skip hidden questions
const validateAnswers = () => {
  const errors = {};
  
  for (const question of questions) {
    // Skip if question is hidden
    if (hiddenQuestionIds.has(question.id)) {
      continue;
    }
    
    // Existing validation logic
    if (question.required && !answers[question.id]) {
      errors[question.id] = "This field is required";
    }
  }
  
  return errors;
};

// Submission: Filter hidden answers
const handleSubmit = async () => {
  const filteredAnswers = Object.fromEntries(
    Object.entries(answers).filter(([qId]) => 
      !hiddenQuestionIds.has(qId)
    )
  );
  
  await submitResponse(filteredAnswers);
};
```

**Test Procedure**:
1. Create form with required questions in hidden section
2. Fill form WITHOUT answering hidden section
3. Submit form
4. Expected: Submission succeeds (no validation errors for hidden)
5. Verify in database:
   ```sql
   SELECT answers FROM submissions WHERE id = '[submission-id]';
   ```
6. Expected: Only visible question answers stored

**Test Cases**:
```bash
# Test 1: Hidden required field
- Q1: "Type?" → Hides Section B
- Q2 (in Section B): Required field
- Expected: Can submit without answering Q2

# Test 2: Answer filtering
- Q1: "Type?" → Answer "A" (hides Q2)
- Previously answered Q2
- Submit form
- Expected: Q2 answer NOT included in submission
```

---

## 🚨 Feature Flag (Rollback Strategy)

Add environment variable for instant rollback:

**File**: `.env`
```bash
VITE_ENABLE_CONDITIONAL_LOGIC=false  # Set to false to disable
```

**File**: `src/lib/feature-flags.ts` (NEW)
```typescript
export const ENABLE_CONDITIONAL_LOGIC = 
  import.meta.env.VITE_ENABLE_CONDITIONAL_LOGIC === 'true';
```

**Rollback Time**: < 5 minutes
1. Set `VITE_ENABLE_CONDITIONAL_LOGIC=false` in `.env`
2. Rebuild: `npm run build`
3. Deploy
4. Forms revert to showing all sections (current behavior)

---

## 📋 Testing Checklist

Before pushing to GitHub:

### Phase 1 ✅
- [ ] Migration runs without errors in Supabase SQL Editor
- [ ] Can query `config->>'logic_rules'` field
- [ ] Returns NULL (field exists but empty)

### Phase 2 ✅
- [ ] `npm run typecheck` passes
- [ ] `npm test -- logic-engine.test.ts` passes (all tests green)
- [ ] No TypeScript errors in validation.ts

### Phase 3 ⚠️
- [ ] Builder loads without errors
- [ ] "Logic" tab appears in question editor
- [ ] Can add logic rule
- [ ] Can select target section from dropdown
- [ ] Can delete logic rule
- [ ] Save form succeeds
- [ ] Database contains logic_rules JSON

### Phase 4 ⚠️
- [ ] Public form renders without errors
- [ ] Sections show/hide based on answers
- [ ] Multiple rules work correctly
- [ ] Cascading rules work correctly
- [ ] No console errors
- [ ] Performance is acceptable (< 100ms re-evaluation)

### Phase 5 ⚠️
- [ ] Can submit form with hidden required questions
- [ ] Hidden answers not included in submission
- [ ] Validation errors only for visible questions
- [ ] Database submission data correct

### Regression Testing ✅
- [ ] Forms WITHOUT logic rules still work
- [ ] Existing forms render correctly
- [ ] Existing submissions load correctly
- [ ] Excel/CSV export still works
- [ ] Mobile responsive still works

### Final Checks ✅
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (all tests)
- [ ] `npm run build` succeeds
- [ ] Manual test all question types
- [ ] Test on mobile device/browser
- [ ] No errors in browser console
- [ ] No errors in Supabase logs

---

## 📁 Files Summary

### New Files (5)
1. `CONDITIONAL_LOGIC_IMPLEMENTATION_PLAN.md` (this file)
2. `supabase/migrations/060_add_conditional_logic.sql`
3. `src/lib/logic-engine.ts`
4. `src/lib/logic-engine.test.ts`
5. `src/lib/feature-flags.ts`
6. `src/components/form-builder/LogicRuleEditor.tsx`

### Modified Files (3)
1. `src/lib/validation.ts` - Add LogicRule type
2. `src/components/form-builder/QuestionCard.tsx` - Add Logic tab
3. `src/routes/forms/$slug.tsx` - Integrate logic engine

---

## 🎬 Implementation Order

1. **Phase 1** (5 min) → Test → Approve → Continue
2. **Phase 2** (1 hour) → Test → Approve → Continue
3. **Phase 3** (3 hours) → Test → Approve → Continue
4. **Phase 4** (1.5 hours) → Test → Approve → Continue
5. **Phase 5** (30 min) → Test → Approve → Continue
6. **Full regression testing** (30 min)
7. **Push to GitHub** ✅

**Total Time**: 6-8 hours

---

## 🚀 Ready to Start?

Type `start phase 1` when ready to begin implementation.

I will:
1. Implement Phase 1
2. Wait for your approval after testing
3. Continue to Phase 2
4. Repeat until all phases complete

**No pushing to GitHub until ALL phases tested and approved!** ✅
