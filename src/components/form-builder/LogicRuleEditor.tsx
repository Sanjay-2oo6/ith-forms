/**
 * Logic Rule Editor - Conditional Logic UI for Form Builder
 * 
 * Allows admins to add/edit/delete logic rules that control section visibility
 * based on question answers.
 * 
 * Phase 1 Features:
 * - Simple "equals" condition
 * - "show_section" action
 * - Target section selector (only sections AFTER this question)
 */

import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { uuidv4 } from '@/lib/validation';
import { getTargetableSections } from '@/lib/logic-engine';
import type { LogicRule, Section, Question } from '@/components/form-builder/types';

export function LogicRuleEditor({
  questionId,
  rules,
  onChange,
  allQuestions,
  allSections,
}: {
  questionId: string;
  rules: LogicRule[];
  onChange: (rules: LogicRule[]) => void;
  allQuestions: Question[];
  allSections: Section[];
}) {
  // Get sections that can be targeted (only sections after this question)
  const targetableSections = getTargetableSections(questionId, allQuestions, allSections);
  
  // Find the question to check if it has options (for validation)
  const question = allQuestions.find(q => q.id === questionId);
  const hasOptions = question && ['dropdown', 'radio', 'checkbox', 'poll', 'yes_no'].includes(question.type);
  
  // Payment questions don't have user-selectable answer values for conditional logic
  const isPaymentQuestion = question?.type === 'payment';
  
  function addRule() {
    const newRule: LogicRule = {
      id: uuidv4(),
      condition: 'equals',
      value: '',
      action: 'show_section',
      target_section_id: targetableSections[0]?.id || '',
    };
    onChange([...rules, newRule]);
  }
  
  function updateRule(ruleId: string, updates: Partial<LogicRule>) {
    onChange(rules.map(r => r.id === ruleId ? { ...r, ...updates } : r));
  }
  
  function deleteRule(ruleId: string) {
    onChange(rules.filter(r => r.id !== ruleId));
  }
  
  // Can't add logic if no targetable sections or if this is a payment question
  if (targetableSections.length === 0 || isPaymentQuestion) {
    const message = isPaymentQuestion 
      ? "Payment questions cannot be used for conditional logic"
      : "No sections available";
    const description = isPaymentQuestion
      ? "Payment questions don't have selectable answer values that can trigger conditional logic rules."
      : "Add more sections after this question to enable conditional logic.";
      
    return (
      <div className="rounded-lg border border-border/40 bg-secondary/10 p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {message}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {description}
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Conditional Logic</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Show or hide sections based on the answer to this question
          </p>
        </div>
        <button
          type="button"
          onClick={addRule}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Rule
        </button>
      </div>
      
      {/* Warning if question doesn't have options */}
      {!hasOptions && rules.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-200">
              This question type may require specific answer values. Make sure the answer value exactly matches your logic rule value.
            </p>
          </div>
        </div>
      )}
      
      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-secondary/5 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No logic rules yet. Click "Add Rule" to create one.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule, index) => (
            <div
              key={rule.id}
              className="rounded-lg border border-border/40 bg-card p-3 space-y-3"
            >
              {/* Rule Header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Rule {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => deleteRule(rule.id)}
                  className="p-1 hover:text-destructive transition-colors"
                  aria-label="Delete rule"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              
              {/* Rule Configuration */}
              <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-2 text-sm">
                {/* "If answer" */}
                <span className="text-muted-foreground text-xs">If answer</span>
                
                {/* Condition (Phase 1: always "equals") */}
                <select
                  value={rule.condition}
                  onChange={(e) => updateRule(rule.id, { condition: e.target.value as 'equals' })}
                  className="text-xs rounded border border-input bg-background px-2 py-1 outline-none focus:ring-1 focus:ring-ring"
                  disabled // Phase 1: only "equals" supported
                >
                  <option value="equals">equals</option>
                </select>
                
                {/* Empty cell for alignment */}
                <span />
                
                {/* Value Input/Select - Use dropdown for questions with options */}
                {hasOptions && question?.options && question.options.length > 0 ? (
                  <select
                    value={rule.value}
                    onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                    className="text-xs rounded border border-input bg-background px-2 py-1.5 outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Select an option...</option>
                    {question.options.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label} ({opt.value})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={rule.value}
                    onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                    placeholder="Enter answer value"
                    className="text-xs rounded border border-input bg-background px-2 py-1.5 outline-none focus:ring-1 focus:ring-ring"
                  />
                )}
                
                {/* "Then" */}
                <span className="text-muted-foreground text-xs">Then</span>
                
                {/* Action (Phase 1: always "show section") */}
                <select
                  value={rule.action}
                  onChange={(e) => updateRule(rule.id, { action: e.target.value as 'show_section' })}
                  className="text-xs rounded border border-input bg-background px-2 py-1 outline-none focus:ring-1 focus:ring-ring"
                  disabled // Phase 1: only "show_section" supported
                >
                  <option value="show_section">show section</option>
                </select>
                
                {/* Empty cell for alignment */}
                <span />
                
                {/* Target Section Selector */}
                <select
                  value={rule.target_section_id}
                  onChange={(e) => updateRule(rule.id, { target_section_id: e.target.value })}
                  className="text-xs rounded border border-input bg-background px-2 py-1.5 outline-none focus:ring-1 focus:ring-ring"
                >
                  {targetableSections.map(section => (
                    <option key={section.id} value={section.id}>
                      {section.title || 'Untitled Section'}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Validation warning for empty values */}
              {!rule.value && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>Select an answer value for this rule to work</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Phase 1 Limitations Notice */}
      {rules.length > 0 && (
        <div className="rounded-lg border border-border/30 bg-secondary/5 p-3">
          <p className="text-xs text-muted-foreground">
            <strong>Phase 1:</strong> Only "equals" matching and "show section" actions are supported. 
            Advanced conditions and actions coming in future updates.
          </p>
        </div>
      )}
    </div>
  );
}
