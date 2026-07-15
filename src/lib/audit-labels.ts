// Human-readable labels for stored audit_logs.action values.
// Display-only: the stored values never change (the DB CHECK constraint and
// history stay exactly as they are).
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "admin.login": "Admin signed in",
  "admin.logout": "Admin signed out",
  "form.created": "Form created",
  "form.published": "Form published",
  "form.unpublished": "Form unpublished",
  "form.deleted": "Form deleted",
  "form.restored": "Form restored",
  "form.updated": "Form updated",
  "theme.updated": "Theme updated",
  "submission.status_changed": "Submission status changed",
  "submission.exported": "Responses exported",
};

// Unknown/legacy values fall back to a readable version of the raw action.
export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action.replace(/[._]/g, " ");
}
