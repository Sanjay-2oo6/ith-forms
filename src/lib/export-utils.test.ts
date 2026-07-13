import { describe, expect, it } from "vitest";
import { displayAnswer, safeCell } from "./export-utils";

describe("safeCell", () => {
  it("prefixes formula injection triggers", () => {
    expect(safeCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(safeCell("  =cmd")).toBe("'  =cmd");
  });

  it("leaves safe strings unchanged", () => {
    expect(safeCell("hello")).toBe("hello");
    expect(safeCell(42)).toBe(42);
  });
});

describe("displayAnswer", () => {
  it("maps choice values to labels", () => {
    const result = displayAnswer("opt_1", "radio", { opt_1: "Yes" });
    expect(result).toBe("Yes");
  });

  it("formats checkbox values with delimiter", () => {
    const result = displayAnswer("a||b", "checkbox", { a: "Alpha", b: "Beta" });
    expect(result).toBe("Alpha, Beta");
  });

  it("formats consent as Agreed", () => {
    expect(displayAnswer("agreed", "consent")).toBe("Agreed");
  });
});
