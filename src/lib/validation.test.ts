import { describe, expect, it } from "vitest";
import { AppSettingsSchema, fileExtensionCheck, fileSizeCheck, FormCreateSchema, fieldErrors, SubmitPayloadSchema, uuidv4 } from "./validation";

describe("uuidv4", () => {
  it("returns a valid UUID v4 string", () => {
    const id = uuidv4();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
});

describe("SubmitPayloadSchema", () => {
  it("accepts a valid payload", () => {
    const formId = uuidv4();
    const qId = uuidv4();
    const result = SubmitPayloadSchema.safeParse({
      form_id: formId,
      answers: [{ question_id: qId, value: "hello" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than 50 answers", () => {
    const formId = uuidv4();
    const answers = Array.from({ length: 51 }, () => ({
      question_id: uuidv4(),
      value: "x",
    }));
    const result = SubmitPayloadSchema.safeParse({ form_id: formId, answers });
    expect(result.success).toBe(false);
  });
});

describe("FormCreateSchema", () => {
  it("accepts a valid form", () => {
    const r = FormCreateSchema.safeParse({ title: "Event Registration", slug: "event-registration-2026" });
    expect(r.success).toBe(true);
  });

  it("rejects a too-short title", () => {
    const r = FormCreateSchema.safeParse({ title: "ab", slug: "valid-slug" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).title).toContain("at least 3");
  });

  it("rejects invalid slug formats", () => {
    for (const slug of ["Has Spaces", "UPPERCASE", "double--hyphen", "-leading", "trailing-", "sym$bols"]) {
      const r = FormCreateSchema.safeParse({ title: "Valid Title", slug });
      expect(r.success, `slug "${slug}" should be rejected`).toBe(false);
    }
  });

  it("accepts single-hyphen-separated lowercase slugs", () => {
    for (const slug of ["abc", "a-b-c", "form-2026", "x1-y2"]) {
      const r = FormCreateSchema.safeParse({ title: "Valid Title", slug });
      expect(r.success, `slug "${slug}" should be accepted`).toBe(true);
    }
  });

  it("maps field errors to the first message per field", () => {
    const r = FormCreateSchema.safeParse({ title: "", slug: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const errs = fieldErrors(r.error);
      expect(errs.title).toBeTruthy();
      expect(errs.slug).toBeTruthy();
    }
  });
});

describe("AppSettingsSchema", () => {
  const valid = {
    app_name: "ITH-FORMS",
    org_name: "InnoTech-Hub",
    powered_by: "Powered by InnoTech-Hub",
    default_appearance: "dark",
    default_confirmation_message: "Your response has been submitted successfully.",
  };

  it("accepts the shipped defaults", () => {
    expect(AppSettingsSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects empty branding fields with per-field errors", () => {
    const r = AppSettingsSchema.safeParse({ ...valid, app_name: " ", org_name: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const errs = fieldErrors(r.error);
      expect(errs.app_name).toBeTruthy();
      expect(errs.org_name).toBeTruthy();
    }
  });

  it("rejects unknown appearance values", () => {
    expect(AppSettingsSchema.safeParse({ ...valid, default_appearance: "sepia" }).success).toBe(false);
  });

  it("rejects an over-long confirmation message", () => {
    expect(AppSettingsSchema.safeParse({ ...valid, default_confirmation_message: "x".repeat(501) }).success).toBe(false);
  });
});

describe("fileExtensionCheck", () => {
  it("allows matching extensions", () => {
    expect(fileExtensionCheck("report.pdf", [".pdf", ".png"]).ok).toBe(true);
  });

  it("rejects non-matching extensions", () => {
    const r = fileExtensionCheck("virus.exe", [".pdf"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain(".pdf");
  });
});

describe("fileSizeCheck", () => {
  it("allows files within limit", () => {
    expect(fileSizeCheck(5 * 1024 * 1024, 10).ok).toBe(true);
  });

  it("rejects files over limit", () => {
    const r = fileSizeCheck(11 * 1024 * 1024, 10);
    expect(r.ok).toBe(false);
  });
});
