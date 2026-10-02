# Implementation Plan: Payment Question Type + Description Enhancements

**Goal**: Add payment question type with URL/screenshot upload, expose section descriptions, and enhance description UI/formatting WITHOUT breaking existing conditional logic or any other features.

**Testing Strategy**: Implement incrementally, test locally after each phase, commit everything together only after full verification.

---

## Phase 1: Section Description Field (Backend Ready, UI Only)

### Status
✅ Database: `sections.description` column already exists (TEXT, nullable)  
🎯 Task: Expose in builder UI only

### Changes Required

#### File: `src/components/form-builder/types.ts`
**Change**: Ensure `Section` type includes `description` field
```typescript
export interface Section {
  id: string;
  title: string;
  description?: string | null; // ← Confirm this exists
  order_position: number;
  form_id: string;
}
```
**Reason**: Type safety for description field

#### File: `src/components/form-builder/SectionBlock.tsx`
**Changes**:
1. Add state for section description
2. Add textarea input below title input
3. Handle description save (debounced like title)

**Detailed Implementation**:
```typescript
// Add to component state (near title state)
const [description, setDescription] = useState(section.description || '');

// Add debounced save handler for description
const debouncedSaveDescription = useMemo(
  () =>
    debounce(async (sectionId: string, newDescription: string) => {
      const { error } = await supabase
        .from('sections')
        .update({ description: newDescription })
        .eq('id', sectionId);
      
      if (error) {
        console.error('Failed to save section description:', error);
        toast.error('Failed to save description');
      }
    }, 600),
  []
);

// Add useEffect to sync description changes
useEffect(() => {
  debouncedSaveDescription(section.id, description);
}, [description, section.id, debouncedSaveDescription]);

// Add textarea in JSX (after title input, before "Add Question" button)
<div className="mt-3">
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Description (Optional)
  </label>
  <textarea
    value={description}
    onChange={(e) => setDescription(e.target.value)}
    placeholder="Add an optional description for this section..."
    className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-y min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    rows={3}
  />
</div>
```

**Testing Checklist**:
- [ ] Can add description to new section
- [ ] Can edit description on existing section
- [ ] Description saves automatically (600ms debounce)
- [ ] Can clear description (set to empty)
- [ ] Textarea resizes vertically
- [ ] No conflicts with existing section features (title, reorder, delete)

---

## Phase 2: Description UI Enhancements (Textarea + Formatting)

### Issue
Current description inputs show one line at a time, newlines/spaces are removed on display.

### Changes Required

#### File: `src/components/form-builder/SectionBlock.tsx`
**Already addressed in Phase 1** with:
- Multi-line textarea (`rows={3}`, `min-h-[80px]`)
- Vertical resize enabled (`resize-y`)

#### File: `src/routes/forms/$slug.tsx` (Public Form Renderer)
**Change**: Preserve formatting when displaying section descriptions

**Find** the section header rendering (likely around line 800-900):
```typescript
<h2 className="text-2xl font-bold mb-4">{currentSection.title}</h2>
```

**Add** description display with preserved formatting:
```typescript
<h2 className="text-2xl font-bold mb-4">{currentSection.title}</h2>
{currentSection.description && (
  <div className="mb-6 text-gray-700 whitespace-pre-wrap">
    {currentSection.description}
  </div>
)}
```

**Key**: `whitespace-pre-wrap` CSS class preserves newlines and spaces while allowing text wrapping.

#### File: `src/components/form-builder/PreviewModal.tsx` (Builder Preview)
**Change**: Same as public form - preserve formatting in preview

**Find** section rendering in preview:
```typescript
<h2 className="text-xl font-bold mb-4">{section.title}</h2>
```

**Add** description display:
```typescript
<h2 className="text-xl font-bold mb-4">{section.title}</h2>
{section.description && (
  <div className="mb-4 text-gray-600 whitespace-pre-wrap text-sm">
    {section.description}
  </div>
)}
```

**Testing Checklist**:
- [ ] Multi-line input visible in builder textarea
- [ ] Newlines preserved when typing in builder
- [ ] Description displays with preserved formatting in preview
- [ ] Description displays with preserved formatting on public form
- [ ] Long descriptions wrap properly (don't overflow)
- [ ] Empty lines render correctly

---

## Phase 3: Payment Question Type (New Type + File Upload)

### Architecture Decision
**Type**: New question type `"payment"` (not enhancement to `information_paragraph`)  
**Reason**: Different validation, UI, and submission handling

### Database Schema

#### File: `supabase/migrations/061_add_payment_question_type.sql`
```sql
-- Migration 061: Add payment question type

-- 1. Add 'payment' to question_type enum
-- Note: PostgreSQL doesn't support ALTER TYPE ADD VALUE in transaction
-- Must run separately or commit before adding
ALTER TYPE question_type ADD VALUE IF NOT EXISTS 'payment';

-- 2. No new columns needed in form_questions
-- Payment URL will be stored in config JSONB: { paymentUrl: string }

-- 3. Payment proof (screenshot) will use existing submission_files table
-- with file_type = 'payment_proof'

COMMENT ON TYPE question_type IS 'Updated 2024-01: Added payment type for payment section with URL and screenshot upload';
```

**Migration Order**: This becomes migration 061 (next after 060_add_conditional_logic.sql)

### Type Definitions

#### File: `src/lib/question-types.ts`
**Add** payment type to union:
```typescript
export type QuestionType =
  | 'short_answer'
  | 'long_answer'
  | 'single_choice'
  | 'multiple_choice'
  | 'dropdown'
  | 'linear_scale'
  | 'file_upload'
  | 'information_paragraph'
  | 'payment'; // ← NEW

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  // ... existing types
  payment: 'Payment',
};

export const QUESTION_TYPE_DESCRIPTIONS: Record<QuestionType, string> = {
  // ... existing types
  payment: 'Payment section with external URL and screenshot upload',
};
```

#### File: `src/components/form-builder/types.ts`
**Extend** QuestionConfig to support payment URL:
```typescript
export interface QuestionConfig {
  // ... existing fields (min, max, options, etc.)
  paymentUrl?: string; // ← NEW: URL for payment gateway
  logic_rules?: LogicRule[]; // existing
}
```

### Builder UI Changes

#### File: `src/components/form-builder/QuestionCard.tsx`
**Add** payment URL input when question type is 'payment':

**Find** the settings section (where min/max/required are configured)

**Add** payment URL field:
```typescript
{question.question_type === 'payment' && (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Payment URL <span className="text-red-500">*</span>
    </label>
    <input
      type="url"
      value={config.paymentUrl || ''}
      onChange={(e) => {
        setConfig({ ...config, paymentUrl: e.target.value });
      }}
      placeholder="https://payment-gateway.com/checkout/..."
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
      required
    />
    <p className="mt-1 text-sm text-gray-500">
      Users will be redirected to this URL when they click "Pay Now"
    </p>
  </div>
)}
```

**Validation**: Add check in save handler to ensure paymentUrl is not empty when type is 'payment'.

#### File: `src/components/form-builder/BuilderTab.tsx`
**Add** 'Payment' option to question type selector dropdown:
```typescript
<option value="payment">💳 Payment</option>
```

**Testing Checklist**:
- [ ] Payment type appears in question type dropdown
- [ ] Can create payment question
- [ ] Payment URL input appears for payment questions
- [ ] URL validation works (must be valid URL format)
- [ ] Cannot save payment question without URL
- [ ] Payment URL saves correctly to config JSONB

### Public Form Rendering

#### File: `src/routes/forms/$slug.tsx`
**Add** payment question rendering logic (around line 1000-1100 where other question types are rendered)

**Implementation**:
```typescript
{question.question_type === 'payment' && (
  <div className="space-y-4">
    {/* Payment button to external URL */}
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <p className="text-sm text-gray-700 mb-3">
        Please complete the payment using the button below, then upload a screenshot as proof of payment.
      </p>
      <a
        href={question.config.paymentUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        💳 Pay Now
      </a>
    </div>

    {/* Screenshot upload */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Upload Payment Screenshot {question.required && <span className="text-red-500">*</span>}
      </label>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => handlePaymentScreenshot(question.id, e.target.files?.[0])}
        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        required={question.required}
      />
      {/* Show uploaded file name if exists */}
      {uploadedPaymentProofs[question.id] && (
        <p className="mt-2 text-sm text-green-600">
          ✓ Uploaded: {uploadedPaymentProofs[question.id].name}
        </p>
      )}
    </div>
  </div>
)}
```

**Add** state for tracking uploaded payment proofs:
```typescript
const [uploadedPaymentProofs, setUploadedPaymentProofs] = useState<Record<string, File>>({});
```

**Add** upload handler:
```typescript
const handlePaymentScreenshot = (questionId: string, file: File | undefined) => {
  if (!file) return;

  // Validate file type (images only)
  if (!file.type.startsWith('image/')) {
    toast.error('Please upload an image file');
    return;
  }

  // Validate file size (max 10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    toast.error('File size must be under 10MB');
    return;
  }

  setUploadedPaymentProofs((prev) => ({
    ...prev,
    [questionId]: file,
  }));
};
```

**Modify** submission handler to upload payment screenshots:
```typescript
// In handleSubmit function, after regular file uploads

// Upload payment screenshots
for (const [questionId, file] of Object.entries(uploadedPaymentProofs)) {
  const question = allQuestions.find((q) => q.id === questionId);
  if (!question) continue;

  const filePath = `${submissionId}/${uuidv4()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from('submission-files')
    .upload(filePath, file);

  if (uploadError) {
    throw new Error(`Failed to upload payment proof: ${uploadError.message}`);
  }

  // Register file with RPC
  const { error: registerError } = await supabase.rpc('register_submission_file', {
    p_submission_id: submissionId,
    p_question_id: questionId,
    p_file_path: filePath,
    p_file_type: 'payment_proof',
  });

  if (registerError) {
    throw new Error(`Failed to register payment proof: ${registerError.message}`);
  }

  // Store file path in answers
  formData[questionId] = filePath;
}
```

**Testing Checklist**:
- [ ] Payment question renders with "Pay Now" button
- [ ] Clicking "Pay Now" opens payment URL in new tab
- [ ] Can upload image file as screenshot
- [ ] File type validation works (only images)
- [ ] File size validation works (max 10MB)
- [ ] Shows uploaded file name
- [ ] Required validation works (can't submit without screenshot if required)
- [ ] Payment proof uploads to Supabase storage
- [ ] Payment proof registers in submission_files table
- [ ] File path stores in submission answers

### Response Viewing

#### File: `src/components/responses/ResponseDetailDialog.tsx`
**Add** payment question display in detail view:

**Find** where question answers are displayed (likely around line 150-250)

**Add** payment rendering:
```typescript
{question.question_type === 'payment' && (
  <div className="space-y-2">
    <div className="flex items-center space-x-2">
      <span className="text-sm font-medium text-gray-700">Payment URL:</span>
      <a
        href={question.config.paymentUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-blue-600 hover:underline"
      >
        {question.config.paymentUrl}
      </a>
    </div>
    <div>
      <span className="text-sm font-medium text-gray-700">Payment Proof:</span>
      {answer ? (
        <div className="mt-1">
          <img
            src={getPublicFileUrl(answer)}
            alt="Payment proof"
            className="max-w-md rounded-lg border border-gray-300"
          />
        </div>
      ) : (
        <span className="text-sm text-gray-500 ml-2">No proof uploaded</span>
      )}
    </div>
  </div>
)}
```

**Helper function** to get public URL:
```typescript
const getPublicFileUrl = (filePath: string) => {
  const { data } = supabase.storage
    .from('submission-files')
    .getPublicUrl(filePath);
  return data.publicUrl;
};
```

**Testing Checklist**:
- [ ] Payment proof image displays in response detail dialog
- [ ] Payment URL is clickable and opens in new tab
- [ ] Shows "No proof uploaded" if missing
- [ ] Image is properly sized and doesn't overflow

### Validation Updates

#### File: `src/lib/validation.ts`
**Add** payment validation to `SubmitPayloadSchema`:

**Find** the `answerSchema` definition

**Add** payment case:
```typescript
.superRefine((data, ctx) => {
  const question = /* lookup question by data.questionId */;
  
  // ... existing validation cases
  
  if (question.question_type === 'payment') {
    if (question.required && !data.answer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Payment proof screenshot is required',
        path: ['answer'],
      });
    }
    
    // Validate answer is a file path string
    if (data.answer && typeof data.answer !== 'string') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Payment proof must be a valid file path',
        path: ['answer'],
      });
    }
  }
})
```

---

## Phase 4: Conditional Logic Compatibility

### Verification
Ensure payment questions work with existing conditional logic.

#### File: `src/lib/logic-engine.ts`
**Review**: Payment questions should:
- ✅ Can be hidden by logic rules (like any question)
- ✅ Can be shown by logic rules (like any question)
- ❌ Cannot be used as trigger questions (no answer value to compare)

**Add** guard in `evaluateRule` function:
```typescript
const triggerQuestion = questions.find((q) => q.id === rule.triggerQuestionId);
if (!triggerQuestion) return false;

// Payment questions cannot be triggers (no comparable answer value)
if (triggerQuestion.question_type === 'payment') return false;
```

#### File: `src/components/form-builder/LogicRuleEditor.tsx`
**Filter** payment questions from trigger question dropdown:
```typescript
const availableTriggerQuestions = allQuestions.filter(
  (q) => q.question_type !== 'information_paragraph' && 
         q.question_type !== 'payment' // ← NEW
);
```

**Testing Checklist**:
- [ ] Payment questions don't appear in trigger question dropdown
- [ ] Payment questions CAN be hidden by logic rules
- [ ] Payment questions CAN be shown by logic rules
- [ ] Hiding payment question also hides screenshot upload field

---

## Phase 5: Export/Audit Integration

### Export Updates

#### File: `src/lib/responses.ts`
**Update** `buildTabularData` to handle payment questions:

**Add** to the switch statement:
```typescript
case 'payment': {
  // Export the file path (admins can view in response detail)
  return answer || 'No proof uploaded';
}
```

**Testing Checklist**:
- [ ] Payment columns appear in CSV export
- [ ] Shows file path or "No proof uploaded"
- [ ] XLSX export includes payment columns

### Audit Trail

#### File: `src/lib/audit.ts` (if exists, otherwise skip)
**Verify**: Payment question creation/editing logs to audit trail automatically (no special handling needed since it uses existing question CRUD).

**Testing Checklist**:
- [ ] Creating payment question logs to audit_logs
- [ ] Editing payment URL logs to audit_logs
- [ ] Deleting payment question logs to audit_logs

---

## Phase 6: Comprehensive Testing Plan

### Unit Tests
**New test files needed**:
1. `src/lib/payment-validation.test.ts` - Validate payment question validation logic
2. Add payment cases to `src/lib/logic-engine.test.ts` - Ensure payment questions can't be triggers

### Integration Tests
**Test scenarios**:
1. Create form with payment question + regular questions
2. Add section descriptions with formatting (newlines, spaces)
3. Add conditional logic that hides payment question
4. Submit form with payment proof
5. View response with payment proof
6. Export responses with payment data

### Manual Test Script

```markdown
## Test Script: Payment + Description Features

### Setup
1. Start dev server: `npm run dev`
2. Login as admin
3. Create new form: "Payment Test Form"

### Test 1: Section Descriptions
- [ ] Add section "Personal Info"
- [ ] Add description with multiple lines:
      ```
      Please provide your details.
      
      All fields are required.
      Use your legal name.
      ```
- [ ] Save and preview
- [ ] Verify description shows with preserved newlines
- [ ] Verify long descriptions wrap properly
- [ ] Edit description, verify changes save
- [ ] Clear description, verify it disappears

### Test 2: Payment Question Type
- [ ] Add new section "Payment"
- [ ] Add description explaining payment process
- [ ] Add payment question
- [ ] Enter payment URL: `https://example.com/pay`
- [ ] Try to save without URL (should fail)
- [ ] Save with URL (should succeed)
- [ ] Preview form
- [ ] Verify "Pay Now" button appears
- [ ] Click button (should open in new tab)
- [ ] Verify screenshot upload field appears
- [ ] Try uploading non-image (should fail)
- [ ] Try uploading 15MB image (should fail)
- [ ] Upload valid 2MB screenshot (should succeed)
- [ ] Verify file name displays

### Test 3: Conditional Logic + Payment
- [ ] Add single choice question "Are you a member?" (Yes/No)
- [ ] Add logic rule: Show Payment section if answer is "Yes"
- [ ] Preview form
- [ ] Select "No" → payment section hidden
- [ ] Select "Yes" → payment section shown
- [ ] Verify payment URL and upload still work

### Test 4: Form Submission
- [ ] Fill all fields
- [ ] Upload payment screenshot
- [ ] Submit form
- [ ] Verify success message
- [ ] Check responses page
- [ ] Open response detail
- [ ] Verify payment screenshot displays
- [ ] Verify payment URL is clickable

### Test 5: Export
- [ ] Export responses as CSV
- [ ] Verify payment column exists
- [ ] Verify shows file path or "No proof uploaded"
- [ ] Export as XLSX
- [ ] Verify same data appears

### Test 6: Edge Cases
- [ ] Create payment question, delete it (no errors)
- [ ] Create payment question, make it optional
- [ ] Submit without screenshot (should succeed if optional)
- [ ] Add 5 sections with descriptions (performance test)
- [ ] Section description with 1000 characters (should wrap)
- [ ] Payment URL with special characters (should work)
```

---

## Risk Assessment & Mitigation

### Risk 1: Breaking Existing Conditional Logic
**Mitigation**:
- Payment questions filtered from trigger dropdown
- Logic engine ignores payment as triggers
- Test all existing logic scenarios after implementation

### Risk 2: File Upload Conflicts
**Mitigation**:
- Use existing `submission-files` bucket
- Use existing `register_submission_file` RPC
- Separate state for payment uploads (`uploadedPaymentProofs` vs `uploadedFiles`)
- Unique file type identifier (`payment_proof`)

### Risk 3: Migration Issues
**Mitigation**:
- Test migration 061 on local database first
- Add `IF NOT EXISTS` clause to enum value addition
- Document that enum addition must run outside transaction if needed

### Risk 4: Description Formatting Breaking Layout
**Mitigation**:
- Use `whitespace-pre-wrap` (allows wrapping)
- Test with very long descriptions
- Test with many newlines
- Add max-height if needed for extremely long descriptions

---

## Implementation Order Summary

1. **Phase 1**: Section descriptions (UI only, backend ready)
2. **Phase 2**: Description formatting (textarea + whitespace-pre-wrap)
3. **Phase 3**: Payment question type (migration → types → builder → public form)
4. **Phase 4**: Conditional logic compatibility (filter payment from triggers)
5. **Phase 5**: Export/audit integration
6. **Phase 6**: Comprehensive testing

**After each phase**: Test locally, verify no regressions, continue to next phase.

**Final step**: Run full test script, verify all features work, then commit everything together.

---

## Files Affected (Complete List)

### New Files
- `supabase/migrations/061_add_payment_question_type.sql`
- `src/lib/payment-validation.test.ts` (optional, for unit tests)

### Modified Files
1. `src/lib/question-types.ts` - Add payment type
2. `src/components/form-builder/types.ts` - Add paymentUrl to config
3. `src/components/form-builder/SectionBlock.tsx` - Add description textarea
4. `src/components/form-builder/QuestionCard.tsx` - Add payment URL input
5. `src/components/form-builder/BuilderTab.tsx` - Add payment to type dropdown
6. `src/components/form-builder/PreviewModal.tsx` - Display section descriptions
7. `src/components/form-builder/LogicRuleEditor.tsx` - Filter payment from triggers
8. `src/routes/forms/$slug.tsx` - Render payment question + section descriptions
9. `src/components/responses/ResponseDetailDialog.tsx` - Display payment proof
10. `src/lib/responses.ts` - Export payment data
11. `src/lib/logic-engine.ts` - Prevent payment as trigger
12. `src/lib/logic-engine.test.ts` - Add payment test cases
13. `src/lib/validation.ts` - Add payment validation

**Total**: 2 new files, 13 modified files

---

## Git Commit Strategy

**Current Status**: 16 files staged (conditional logic feature)

**Plan**:
1. Do NOT commit yet
2. Implement all 6 phases above
3. Test everything locally
4. Stage all new changes
5. Single commit with message:
   ```
   feat: add conditional logic, payment questions, and section descriptions
   
   - Conditional logic with dropdown-based rule editor
   - Payment question type with external URL and screenshot upload
   - Section descriptions with preserved formatting
   - Enhanced description textarea in builder
   - Payment questions excluded from logic triggers
   - Export support for payment data
   
   Tests: 50 passing (26 logic engine, 16 validation, 5 export, 3 audit)
   ```

---

## Success Criteria

### Must Have
- ✅ Section descriptions display with preserved newlines/spaces
- ✅ Textarea shows multiple lines while editing
- ✅ Payment question type exists and is selectable
- ✅ Payment URL configuration works
- ✅ "Pay Now" button opens URL in new tab
- ✅ Screenshot upload validates file type and size
- ✅ Payment proof displays in response detail
- ✅ Payment data exports correctly
- ✅ Payment questions cannot be logic triggers
- ✅ All existing features still work (especially conditional logic)
- ✅ No TypeScript errors
- ✅ All tests passing

### Nice to Have
- Unit tests for payment validation
- Integration tests for full payment flow
- Performance testing with many sections

---

## User Requirements Confirmed

1. **Screenshot requirement**: ✅ Tied to question's required field (flexible)
2. **Payment URL validation**: ✅ Accept any valid URL (no domain restrictions) 
3. **Multiple payments**: ✅ NO for now (single payment per form)
4. **Payment tracking**: ✅ Screenshot proof only (sufficient)

---

## Next Steps

Ready to begin Phase 1 implementation: Section Description Field UI exposure.