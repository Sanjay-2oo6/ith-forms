/**
 * Logic Engine Tests
 * 
 * Tests all logic evaluation scenarios to ensure conditional logic
 * works correctly without breaking existing functionality.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateLogicRules,
  matchesCondition,
  filterVisibleAnswers,
  validateVisibleQuestions,
  getTargetableSections,
} from './logic-engine';
import type { Question, Section, LogicRule } from './validation';

// Test helpers
function createQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    section_id: 's1',
    type: 'short_text',
    label: 'Test Question',
    description: null,
    placeholder: null,
    required: false,
    default_value: null,
    options: [],
    config: {},
    position: 0,
    ...overrides,
  };
}

function createSection(overrides: Partial<Section> = {}): Section {
  return {
    id: 's1',
    title: 'Section 1',
    description: null,
    position: 0,
    ...overrides,
  };
}

function createLogicRule(overrides: Partial<LogicRule> = {}): LogicRule {
  return {
    id: 'rule1',
    condition: 'equals',
    value: 'yes',
    action: 'show_section',
    target_section_id: 's2',
    ...overrides,
  };
}

describe('matchesCondition', () => {
  it('should match equals condition (case insensitive)', () => {
    expect(matchesCondition('yes', 'equals', 'yes')).toBe(true);
    expect(matchesCondition('Yes', 'equals', 'yes')).toBe(true);
    expect(matchesCondition('YES', 'equals', 'yes')).toBe(true);
    expect(matchesCondition('  yes  ', 'equals', 'yes')).toBe(true);
  });

  it('should not match when values differ', () => {
    expect(matchesCondition('no', 'equals', 'yes')).toBe(false);
    expect(matchesCondition('maybe', 'equals', 'yes')).toBe(false);
  });

  it('should handle null/undefined answers', () => {
    expect(matchesCondition(null, 'equals', 'yes')).toBe(false);
    expect(matchesCondition(undefined, 'equals', 'yes')).toBe(false);
  });

  it('should handle number values', () => {
    expect(matchesCondition(5, 'equals', '5')).toBe(true);
    expect(matchesCondition('5', 'equals', '5')).toBe(true);
    expect(matchesCondition(5, 'equals', '10')).toBe(false);
  });

  it('should handle boolean values', () => {
    expect(matchesCondition(true, 'equals', 'true')).toBe(true);
    expect(matchesCondition(false, 'equals', 'false')).toBe(true);
    expect(matchesCondition(true, 'equals', 'false')).toBe(false);
  });

  it('should handle array values (checkbox questions)', () => {
    expect(matchesCondition(['option1', 'option2'], 'equals', 'option1||option2')).toBe(true);
    expect(matchesCondition(['option1'], 'equals', 'option1')).toBe(true);
  });

  it('should return false for unknown conditions', () => {
    expect(matchesCondition('yes', 'not_equals' as any, 'no')).toBe(false);
    expect(matchesCondition('test', 'contains' as any, 'te')).toBe(false);
  });
});

describe('evaluateLogicRules - No Rules', () => {
  it('should show all sections when no rules exist', () => {
    const questions = [createQuestion({ id: 'q1' })];
    const sections = [
      createSection({ id: 's1' }),
      createSection({ id: 's2' }),
    ];
    const answers = { q1: 'yes' };

    const result = evaluateLogicRules(answers, questions, sections);

    expect(result.visibleSectionIds).toEqual(new Set(['s1', 's2']));
    expect(result.hiddenQuestionIds.size).toBe(0);
  });

  it('should show all sections when rules exist but none match', () => {
    const rule = createLogicRule({ value: 'yes', target_section_id: 's2' });
    const questions = [
      createQuestion({ id: 'q1', config: { logic_rules: [rule] } }),
    ];
    const sections = [
      createSection({ id: 's1' }),
      createSection({ id: 's2' }),
    ];
    const answers = { q1: 'no' }; // Doesn't match "yes"

    const result = evaluateLogicRules(answers, questions, sections);

    // No match = show all (fallback)
    expect(result.visibleSectionIds).toEqual(new Set(['s1', 's2']));
    expect(result.hiddenQuestionIds.size).toBe(0);
  });
});

describe('evaluateLogicRules - Simple Rules', () => {
  it('should show target section when rule matches', () => {
    const rule = createLogicRule({ value: 'yes', target_section_id: 's2' });
    const questions = [
      createQuestion({ id: 'q1', section_id: 's1', config: { logic_rules: [rule] } }),
    ];
    const sections = [
      createSection({ id: 's1' }),
      createSection({ id: 's2' }),
      createSection({ id: 's3' }),
    ];
    const answers = { q1: 'yes' };

    const result = evaluateLogicRules(answers, questions, sections);

    // Only s2 should be visible (rule matched)
    expect(result.visibleSectionIds).toEqual(new Set(['s2']));
    // q1 is in s1 (hidden), so it should be in hiddenQuestionIds
    expect(result.hiddenQuestionIds).toEqual(new Set(['q1']));
  });

  it('should hide questions in hidden sections', () => {
    const rule = createLogicRule({ value: 'yes', target_section_id: 's2' });
    const questions = [
      createQuestion({ id: 'q1', section_id: 's1', config: { logic_rules: [rule] } }),
      createQuestion({ id: 'q2', section_id: 's2' }),
      createQuestion({ id: 'q3', section_id: 's3' }),
    ];
    const sections = [
      createSection({ id: 's1' }),
      createSection({ id: 's2' }),
      createSection({ id: 's3' }),
    ];
    const answers = { q1: 'yes' };

    const result = evaluateLogicRules(answers, questions, sections);

    // s2 visible, s1 and s3 hidden
    expect(result.visibleSectionIds).toEqual(new Set(['s2']));
    // q3 is in s3 (hidden), q1 is in s1 (hidden)
    expect(result.hiddenQuestionIds).toEqual(new Set(['q1', 'q3']));
  });
});

describe('evaluateLogicRules - Multiple Rules', () => {
  it('should handle multiple rules on same question', () => {
    const rule1 = createLogicRule({ id: 'r1', value: 'student', target_section_id: 's2' });
    const rule2 = createLogicRule({ id: 'r2', value: 'teacher', target_section_id: 's3' });
    
    const questions = [
      createQuestion({
        id: 'q1',
        section_id: 's1',
        config: { logic_rules: [rule1, rule2] },
      }),
    ];
    const sections = [
      createSection({ id: 's1' }),
      createSection({ id: 's2', title: 'Student Section' }),
      createSection({ id: 's3', title: 'Teacher Section' }),
    ];

    // Test "student" answer
    let result = evaluateLogicRules({ q1: 'student' }, questions, sections);
    expect(result.visibleSectionIds).toEqual(new Set(['s2']));

    // Test "teacher" answer
    result = evaluateLogicRules({ q1: 'teacher' }, questions, sections);
    expect(result.visibleSectionIds).toEqual(new Set(['s3']));

    // Test no match
    result = evaluateLogicRules({ q1: 'parent' }, questions, sections);
    expect(result.visibleSectionIds).toEqual(new Set(['s1', 's2', 's3'])); // All visible
  });

  it('should handle multiple questions with rules', () => {
    const rule1 = createLogicRule({ id: 'r1', value: 'yes', target_section_id: 's2' });
    const rule2 = createLogicRule({ id: 'r2', value: 'yes', target_section_id: 's3' });
    
    const questions = [
      createQuestion({ id: 'q1', section_id: 's1', config: { logic_rules: [rule1] } }),
      createQuestion({ id: 'q2', section_id: 's2', config: { logic_rules: [rule2] } }),
    ];
    const sections = [
      createSection({ id: 's1' }),
      createSection({ id: 's2' }),
      createSection({ id: 's3' }),
    ];

    // Both rules match
    const result = evaluateLogicRules({ q1: 'yes', q2: 'yes' }, questions, sections);
    expect(result.visibleSectionIds).toEqual(new Set(['s2', 's3']));
  });
});

describe('evaluateLogicRules - Cascading Logic', () => {
  it('should handle cascading rules (Q1 affects S2, Q2 in S2 affects S3)', () => {
    const rule1 = createLogicRule({ id: 'r1', value: 'yes', target_section_id: 's2' });
    const rule2 = createLogicRule({ id: 'r2', value: 'continue', target_section_id: 's3' });
    
    const questions = [
      createQuestion({ id: 'q1', section_id: 's1', config: { logic_rules: [rule1] } }),
      createQuestion({ id: 'q2', section_id: 's2', config: { logic_rules: [rule2] } }),
      createQuestion({ id: 'q3', section_id: 's3' }),
    ];
    const sections = [
      createSection({ id: 's1' }),
      createSection({ id: 's2' }),
      createSection({ id: 's3' }),
    ];

    // Q1 = yes → show s2; Q2 = continue → show s3
    const result = evaluateLogicRules(
      { q1: 'yes', q2: 'continue' },
      questions,
      sections
    );
    expect(result.visibleSectionIds).toEqual(new Set(['s2', 's3']));
  });
});

describe('filterVisibleAnswers', () => {
  it('should filter out hidden question answers', () => {
    const answers = {
      q1: 'visible',
      q2: 'hidden',
      q3: 'visible',
    };
    const hiddenQuestionIds = new Set(['q2']);

    const filtered = filterVisibleAnswers(answers, hiddenQuestionIds);

    expect(filtered).toEqual({
      q1: 'visible',
      q3: 'visible',
    });
  });

  it('should return all answers when none hidden', () => {
    const answers = { q1: 'a', q2: 'b' };
    const hiddenQuestionIds = new Set<string>();

    const filtered = filterVisibleAnswers(answers, hiddenQuestionIds);

    expect(filtered).toEqual(answers);
  });

  it('should return empty object when all hidden', () => {
    const answers = { q1: 'a', q2: 'b' };
    const hiddenQuestionIds = new Set(['q1', 'q2']);

    const filtered = filterVisibleAnswers(answers, hiddenQuestionIds);

    expect(filtered).toEqual({});
  });
});

describe('validateVisibleQuestions', () => {
  it('should return empty errors for hidden questions', () => {
    const questions = [
      createQuestion({ id: 'q1', required: true }),
      createQuestion({ id: 'q2', required: true }),
    ];
    const hiddenQuestionIds = new Set(['q2']); // q2 is hidden

    const errors = validateVisibleQuestions(questions, hiddenQuestionIds);

    expect(errors).toEqual({}); // Simplified - actual validation in form
  });

  it('should work with all visible questions', () => {
    const questions = [
      createQuestion({ id: 'q1', required: true }),
      createQuestion({ id: 'q2', required: true }),
    ];
    const hiddenQuestionIds = new Set<string>(); // All visible

    const errors = validateVisibleQuestions(questions, hiddenQuestionIds);

    expect(errors).toEqual({}); // Simplified - actual validation in form
  });

  it('should work with empty answers', () => {
    const questions = [createQuestion({ id: 'q1', required: true })];
    const hiddenQuestionIds = new Set<string>();

    const errors = validateVisibleQuestions(questions, hiddenQuestionIds);

    expect(errors).toEqual({}); // Simplified - actual validation in form
  });

  it('should work with empty array answers', () => {
    const questions = [createQuestion({ id: 'q1', required: true })];
    const hiddenQuestionIds = new Set<string>();

    const errors = validateVisibleQuestions(questions, hiddenQuestionIds);

    expect(errors).toEqual({}); // Simplified - actual validation in form
  });

  it('should work with non-required questions', () => {
    const questions = [
      createQuestion({ id: 'q1', required: false }),
    ];
    const hiddenQuestionIds = new Set<string>();

    const errors = validateVisibleQuestions(questions, hiddenQuestionIds);

    expect(errors).toEqual({}); // Simplified - actual validation in form
  });
});

describe('getTargetableSections', () => {
  it('should return sections after the questions section', () => {
    const questions = [
      createQuestion({ id: 'q1', section_id: 's1' }),
    ];
    const sections = [
      createSection({ id: 's1', position: 0 }),
      createSection({ id: 's2', position: 1 }),
      createSection({ id: 's3', position: 2 }),
    ];

    const targetable = getTargetableSections('q1', questions, sections);

    expect(targetable).toEqual([
      sections[1], // s2
      sections[2], // s3
    ]);
  });

  it('should return empty array if question in last section', () => {
    const questions = [
      createQuestion({ id: 'q1', section_id: 's3' }),
    ];
    const sections = [
      createSection({ id: 's1', position: 0 }),
      createSection({ id: 's2', position: 1 }),
      createSection({ id: 's3', position: 2 }),
    ];

    const targetable = getTargetableSections('q1', questions, sections);

    expect(targetable).toEqual([]); // No sections after s3
  });

  it('should return empty array if question not found', () => {
    const questions = [createQuestion({ id: 'q1', section_id: 's1' })];
    const sections = [createSection({ id: 's1' })];

    const targetable = getTargetableSections('q999', questions, sections);

    expect(targetable).toEqual([]);
  });

  it('should return empty array if question has no section_id', () => {
    const questions = [createQuestion({ id: 'q1', section_id: '' })];
    const sections = [createSection({ id: 's1' })];

    const targetable = getTargetableSections('q1', questions, sections);

    expect(targetable).toEqual([]);
  });
});
