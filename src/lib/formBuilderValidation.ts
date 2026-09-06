/**
 * Form Builder Validation Rules
 *
 * Testable validation logic for form builder operations.
 * Separate from UI so it can be unit tested.
 *
 * Usage:
 * ```
 * const validation = validateFormForSave(form, sections, questions);
 * if (!validation.valid) {
 *   toast.error(validation.errors[0]);
 *   if (validation.emptyIds?.length) {
 *     scrollToSection(validation.emptyIds[0]);
 *   }
 * }
 * ```
 */

import type { Question, Section } from "@/components/form-builder/types";
import type { BuilderForm as Form } from "@/components/form-builder/types";

interface ValidationResult {
  valid: boolean;
  errors: string[];
  emptyIds?: string[]; // Sections with no questions
}

/**
 * Validate form before saving to database
 */
export function validateFormForSave(
  form: Form | null,
  sections: Section[],
  questions: Question[]
): ValidationResult {
  const errors: string[] = [];

  // Form must exist
  if (!form) {
    errors.push("Form not loaded");
    return { valid: false, errors };
  }

  // Form title required
  if (!form.title.trim()) {
    errors.push("Form title is required");
  }

  // Question limit
  if (questions.length > 25) {
    errors.push("Form has reached the 25 question limit");
  }

  // Each section must have at least one question
  const emptyIds = sections
    .filter(sec => !questions.some(q => q.section_id === sec.id))
    .map(sec => sec.id);

  if (emptyIds.length > 0) {
    errors.push("Each section must contain at least one question");
  }

  return {
    valid: errors.length === 0,
    errors,
    emptyIds: emptyIds.length > 0 ? emptyIds : undefined,
  };
}

/**
 * Validate form before publishing
 */
export function validateFormForPublish(
  sections: Section[],
  questions: Question[]
): ValidationResult {
  const errors: string[] = [];

  // Must have at least one section
  if (sections.length === 0) {
    errors.push("Add at least one section before publishing");
  }

  // Must have at least one real question (not just headers/info)
  const realQuestions = questions.filter(
    q => !["section_heading", "information_paragraph", "hidden"].includes(q.type)
  );
  if (realQuestions.length === 0) {
    errors.push("Add at least one question before publishing");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate that a question type is allowed
 */
export function isValidQuestionType(type: string): boolean {
  const validTypes = [
    "text", "long_text", "email", "phone", "number", "url",
    "date", "time", "datetime",
    "dropdown", "radio", "checkbox",
    "rating", "poll", "grid",
    "file", "document", "image",
    "section_heading", "information_paragraph",
    "hidden",
  ];
  return validTypes.includes(type);
}

/**
 * Get user-friendly error message for common validation failures
 */
export function getValidationErrorMessage(error: string): string {
  const messages: Record<string, string> = {
    "Form title is required": "Please enter a form title",
    "Form has reached the 25 question limit": "You can add up to 25 questions. To add more, create a new form.",
    "Each section must contain at least one question": "Every section needs at least one question. Add a question or delete the empty section.",
    "Add at least one section before publishing": "Create at least one section before publishing",
    "Add at least one question before publishing": "Add at least one question before publishing",
  };
  return messages[error] || error;
}
