import { expect, type Page } from "@playwright/test";

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
export const hasAdminCreds = ADMIN_EMAIL !== "" && ADMIN_PASSWORD !== "";

// Reference IDs look like "JA-a1b2c3d4-00001" (per-form prefix + zero-padded
// sequence, migration 010). Assert loosely so prefix changes don't break tests.
export const REFERENCE_ID_PATTERN = /^[A-Z0-9]{2,8}-[a-z0-9-]+-\d{4,6}$/;

export async function adminLogin(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("**/dashboard", { timeout: 20_000 });
}

// Unique per-run suffix so parallel/repeated runs never collide on slugs.
export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

// Create a blank form through the real UI. Returns { title, slug }.
export async function createBlankForm(page: Page, baseName: string) {
  const suffix = uniqueSuffix();
  const title = `${baseName} ${suffix}`;
  await page.goto("/forms/new");
  await page.getByRole("button", { name: /Blank Form/ }).click();
  await page.getByPlaceholder("e.g. Event Registration 2026").fill(title);
  const slug = await page.getByPlaceholder("event-registration-2026").inputValue();
  await page.getByRole("button", { name: "Create Form" }).click();
  await page.waitForURL("**/forms/*/edit", { timeout: 20_000 });
  return { title, slug };
}

// Move a form to trash from the Forms list so test runs don't pile up
// published junk. (Soft delete — recoverable from Trash, like the real UI.)
export async function trashFormByTitle(page: Page, title: string) {
  await page.goto("/forms");
  const row = page.locator("div").filter({ has: page.getByText(title, { exact: true }) }).last();
  await row.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).last().click();
  await expect(page.getByText("Form deleted")).toBeVisible({ timeout: 10_000 });
}
