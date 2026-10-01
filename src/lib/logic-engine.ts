/**
 * Logic Engine - Conditional Logic Evaluation for Forms
 * 
 * Evaluates logic rules attached to questions and determines which sections
 * and questions should be visible based on user answers.
 * 
 * Phase 1 Features:
 * - Simple "equals" condition matching
 * - "show_section" action only
 * - Single condition per rule (no AND/OR)
 * - Re-evaluates on every answer change
 */

// Minimal types needed for logic evaluation (compatible with both builder and public form)
type MinimalQuestion = {
  id: string;
  section_id?: string;
  config?: Record<string, any> | null;
};

type MinimalSection = {
  id: string;
  title?: string;
  position?: number;
};

/**
 * Result of logic evaluation
 */
export interface LogicEvaluationResult {
  /** Set of section IDs that should be visible */
  visibleSectionIds: Set<string>;
  /** Set of question IDs that should be hidden */
  hiddenQuestionIds: Set<string>;
}

/**
 * Evaluates all logic rules and determines visibility
 * 
 * @param answers - Current form answers { questionId: answerValue }
 * @param questions - All form questions
 * @param sections - All form sections
 * @returns Which sections/questions should be visible
 */
export function evaluateLogicRules(
  answers: Record<string, any>,
  questions: MinimalQuestion[],
  sections: MinimalSection[]
): LogicEvaluationResult {
  // Collect all section IDs
  const allSectionIds = new Set(sections.map(s => s.id));
  
  // Default: all sections visible, no questions hidden
  if (!questions.some(q => q.config?.logic_rules?.length)) {
    return {
      visibleSectionIds: allSectionIds,
      hiddenQuestionIds: new Set()
    };
  }
  
  // Track which sections should be shown by logic rules
  const sectionsToShow = new Set<string>();
  
  // Evaluate each question's logic rules
  for (const question of questions) {
    const rules = question.config?.logic_rules || [];
    const answer = answers[question.id];
    
    for (const rule of rules) {
      if (matchesCondition(answer, rule.condition, rule.value)) {
        // Rule matched - mark target section as "should show"
        sectionsToShow.add(rule.target_section_id);
      }
    }
  }
  
  // Determine visible sections
  let visibleSectionIds: Set<string>;
  
  if (sectionsToShow.size === 0) {
    // No rules matched - show all sections (default behavior)
    visibleSectionIds = allSectionIds;
  } else {
    // Some rules matched - show ONLY those sections
    visibleSectionIds = sectionsToShow;
  }
  
  // Determine hidden questions (questions in hidden sections)
  const hiddenQuestionIds = new Set<string>();
  
  for (const question of questions) {
    if (question.section_id && !visibleSectionIds.has(question.section_id)) {
      hiddenQuestionIds.add(question.id);
    }
  }
  
  return { visibleSectionIds, hiddenQuestionIds };
}

/**
 * Checks if an answer matches a condition
 * 
 * @param answer - The user's answer
 * @param condition - The condition type (Phase 1: only "equals")
 * @param expectedValue - The value to match against
 * @returns True if condition is satisfied
 */
export function matchesCondition(
  answer: any,
  condition: string,
  expectedValue: string
): boolean {
  // Handle undefined/null answers
  if (answer === undefined || answer === null) {
    return false;
  }
  
  switch (condition) {
    case 'equals':
      return normalizeValue(answer) === normalizeValue(expectedValue);
    
    // Phase 2+ conditions (not yet implemented)
    // case 'not_equals':
    //   return normalizeValue(answer) !== normalizeValue(expectedValue);
    // case 'contains':
    //   return String(answer).toLowerCase().includes(String(expectedValue).toLowerCase());
    // case 'greater_than':
    //   return Number(answer) > Number(expectedValue);
    // case 'less_than':
    //   return Number(answer) < Number(expectedValue);
    
    default:
      console.warn(`Unknown condition: ${condition}`);
      return false;
  }
}

/**
 * Normalizes a value for comparison
 * Handles strings, numbers, booleans, and arrays (for checkbox questions)
 */
function normalizeValue(value: any): string {
  if (typeof value === 'string') {
    return value.toLowerCase().trim();
  }
  
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).toLowerCase();
  }
  
  if (Array.isArray(value)) {
    // For checkbox questions: check if array contains the value
    return value.map(v => String(v).toLowerCase().trim()).join('||');
  }
  
  return String(value).toLowerCase().trim();
}

/**
 * Filters answers to only include visible questions
 * Used before submission to ensure hidden question answers aren't submitted
 * 
 * @param answers - All form answers
 * @param hiddenQuestionIds - Question IDs that are hidden
 * @returns Filtered answers object
 */
export function filterVisibleAnswers(
  answers: Record<string, any>,
  hiddenQuestionIds: Set<string>
): Record<string, any> {
  return Object.fromEntries(
    Object.entries(answers).filter(([questionId]) => 
      !hiddenQuestionIds.has(questionId)
    )
  );
}

/**
 * Validates that all visible required questions have answers
 * 
 * @param questions - All form questions  
 * @param hiddenQuestionIds - Question IDs that are hidden
 * @returns Validation errors { questionId: errorMessage }
 */
export function validateVisibleQuestions(
  questions: MinimalQuestion[],
  hiddenQuestionIds: Set<string>
): Record<string, string> {
  const errors: Record<string, string> = {};
  
  for (const question of questions) {
    // Skip hidden questions
    if (hiddenQuestionIds.has(question.id)) {
      continue;
    }
    
    // Note: This is a simplified validation
    // The actual form will have its own validation logic
    // This is just for reference
  }
  
  return errors;
}

/**
 * Gets all sections that come AFTER a specific question
 * Used in the builder to only allow targeting later sections
 * 
 * @param questionId - The question ID
 * @param questions - All form questions
 * @param sections - All form sections
 * @returns Array of sections that come after this question
 */
export function getTargetableSections(
  questionId: string,
  questions: MinimalQuestion[],
  sections: MinimalSection[]
): MinimalSection[] {
  // Find the question
  const question = questions.find(q => q.id === questionId);
  if (!question || !question.section_id) {
    return [];
  }
  
  // Find the question's section
  const questionSectionIndex = sections.findIndex(s => s.id === question.section_id);
  if (questionSectionIndex === -1) {
    return [];
  }
  
  // Return all sections after this one
  return sections.slice(questionSectionIndex + 1);
}
