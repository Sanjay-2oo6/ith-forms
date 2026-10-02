# Implementation Plan: Payment Question Type with Enhanced Section Descriptions

## Overview
Add a new 'payment' question type that displays a "Pay Now" button linking to a custom URL and allows users to upload a payment screenshot as proof. Also enhance section descriptions with better UI (multi-line editing and proper formatting preservation).

## Implementation Steps

- [ ] 1. Add payment question type to the type system
      Add 'payment' to QuestionType union in src/lib/question-types.ts and add entry to QUESTION_TYPES array with 'Payment' category. Add 'payment' to FILE_TYPES constant since payment questions use file uploads for screenshots.
      Files: src/lib/question-types.ts
      Verify: `npm run typecheck` passes with no type errors.

- [ ] 2. Extend QuestionConfig with paymentUrl field
      Add `paymentUrl?: string` to QuestionConfig interface in src/components/form-builder/types.ts.
      Files: src/components/form-builder/types.ts
      Verify: `npm run typecheck` passes with no type errors.

- [ ] 3. Add payment config panel in form builder
      Add new 'payment' case to ConfigEditor function in QuestionCard.tsx. Include input field for paymentUrl with validation and user-friendly placeholder text.
      Files: src/components/form-builder/QuestionCard.tsx
      Verify: Builder loads and payment questions can be created with URL configuration.

- [ ] 4. Add payment question rendering in public form
      Add new branch for `q.type === 'payment'` in QuestionField function in $slug.tsx. Render: (a) blue "Pay Now" button linking to config?.paymentUrl in new tab, (b) FileUploader component for screenshot upload using existing file upload infrastructure.
      Files: src/routes/forms/$slug.tsx
      Verify: Public form displays payment questions with working "Pay Now" button and file upload.

- [ ] 5. Update logic rule filtering to exclude payment questions
      Add 'payment' to the excluded types in LogicRuleEditor.tsx hasOptions check since payment questions don't have user-selectable answer values for conditional logic.
      Files: src/components/form-builder/LogicRuleEditor.tsx
      Verify: Payment questions don't appear in conditional logic rule creation.

- [ ] 6. Add payment handling in response export system
      Add 'payment' case to displayAnswer function in src/lib/export-utils.ts to properly format payment answers in exports.
      Files: src/lib/export-utils.ts
      Verify: Payment question responses export correctly in Excel/CSV with proper formatting.

- [ ] 7. Enhance payment display in response detail modal
      Modify SubmissionDetailModal.tsx to show payment screenshot images inline for better admin review experience, similar to how other file types are handled but with image preview.
      Files: src/components/SubmissionDetailModal.tsx
      Verify: Payment screenshot files display properly in response detail modal with preview capability.

- [ ] 8. Create database migration for payment question type
      Create migration 061_add_payment_question_type.sql with: `ALTER TYPE question_type ADD VALUE IF NOT EXISTS 'payment';` (if question_type enum exists, or document that text field supports payment type).
      Files: supabase/migrations/061_add_payment_question_type.sql
      Verify: Migration runs successfully in Supabase SQL editor.

- [ ] 9. Enhance section description UI in form builder
      Modify SectionBlock.tsx to: (a) increase textarea rows from 2 to 4 for better multi-line editing, (b) improve placeholder text, (c) ensure proper styling for longer descriptions.
      Files: src/components/form-builder/SectionBlock.tsx
      Verify: Section descriptions are easier to edit with better visual feedback.

- [ ] 10. Fix section description rendering to preserve formatting
      Update section description rendering in $slug.tsx to use `whitespace-pre-wrap` class and proper formatting preservation so newlines and spacing are maintained as entered.
      Files: src/routes/forms/$slug.tsx
      Verify: Section descriptions display with preserved newlines and formatting.

## Technical Details

### File Upload Integration
- Payment questions use the existing FILE_TYPES system for screenshot uploads
- Screenshots are stored in the same submission-files bucket as other uploads
- Payment question files flow through the existing register_submission_file RPC
- Default accepted file types for payment screenshots: .jpg, .jpeg, .png, .pdf

### Payment URL Handling  
- PaymentUrl stored in question.config.paymentUrl
- Pay Now button opens URL in new tab with proper security attributes
- URL validation should accept https:// URLs and common payment providers
- No server-side payment processing - purely a redirect with screenshot proof workflow

### Conditional Logic Integration
- Payment questions excluded from conditional logic triggers (no selectable answer values)
- Payment questions can still be targets of logic rules (can be hidden/shown)
- Logic evaluation skips payment questions when building trigger conditions

### Response Display
- Payment responses show as File[] like other file upload questions  
- Admin response detail modal shows payment screenshot with image preview
- Export system formats payment responses as "Payment completed - [screenshot filename]"

### Section Description Enhancement
- Preserve existing description field structure (string | null)
- Improve textarea UI for multi-line editing experience
- Use whitespace-pre-wrap for rendering to maintain formatting
- No database changes needed - only UI improvements

## Dependencies
Steps 1-2 must complete before step 3 (type system foundation)
Step 3 must complete before step 4 (config availability)
Steps 4 and 8 can be done in parallel
Steps 5-7 depend on the core type system (steps 1-2)  
Steps 9-10 are independent and can be done in parallel with payment implementation