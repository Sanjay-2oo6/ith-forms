import { describe, expect, it } from "vitest";
import { auditActionLabel, AUDIT_ACTION_LABELS } from "./audit-labels";

describe("auditActionLabel", () => {
  it("maps every stored action to the approved readable label", () => {
    expect(auditActionLabel("form.updated")).toBe("Form updated");
    expect(auditActionLabel("form.published")).toBe("Form published");
    expect(auditActionLabel("form.deleted")).toBe("Form deleted");
    expect(auditActionLabel("theme.updated")).toBe("Theme updated");
    expect(auditActionLabel("admin.login")).toBe("Admin signed in");
  });

  it("covers the full DB CHECK constraint list (023)", () => {
    const constraintActions = [
      "admin.login", "admin.logout",
      "form.created", "form.published", "form.unpublished",
      "form.deleted", "form.restored", "form.updated",
      "theme.updated",
      "submission.status_changed", "submission.exported",
    ];
    for (const action of constraintActions) {
      expect(AUDIT_ACTION_LABELS[action], `${action} must have a label`).toBeTruthy();
    }
  });

  it("degrades unknown values to readable text without throwing", () => {
    expect(auditActionLabel("legacy.some_action")).toBe("legacy some action");
  });
});
