import { test, expect } from "@playwright/test";
import {
  adminLogin, createBlankForm, trashFormByTitle,
  hasAdminCreds, REFERENCE_ID_PATTERN, uniqueSuffix,
} from "./helpers";

/**
 * Full admin lifecycle, exercised through the real UI against the real
 * Supabase backend (no mocks). Requires E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD.
 * Each test creates uniquely-slugged forms and trashes them afterwards.
 */
test.describe("admin flows", () => {
  test.skip(!hasAdminCreds, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin E2E specs");

  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  test("login lands on dashboard", async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("form creation validation rejects bad input before any DB write", async ({ page }) => {
    await page.goto("/forms/new");
    await page.getByRole("button", { name: /Blank Form/ }).click();

    // Too-short title (browser requiredness is satisfied, Zod rejects).
    await page.getByPlaceholder("e.g. Event Registration 2026").fill("ab");
    await page.getByRole("button", { name: "Create Form" }).click();
    await expect(page.getByText(/Title must be at least 3 characters/)).toBeVisible();

    // Stays on the creation page — nothing was created.
    await expect(page).toHaveURL(/\/forms\/new/);
  });

  test("blank form: build, publish, submit publicly, verify reference id, review + filter + export responses", async ({ page }) => {
    const { title, slug } = await createBlankForm(page, "E2E Lifecycle");

    // ── Build: rename the default section, add questions ──
    const sectionTitle = page.getByPlaceholder("Section title");
    await sectionTitle.fill("Applicant Details");

    // Add a Short Answer question.
    await page.getByRole("button", { name: "Add question" }).click();
    await page.getByRole("button", { name: "Short Answer", exact: true }).click();
    await page.getByPlaceholder("What would you like to ask?").fill("Your full name");

    // Make it required via the toggle.
    await page.getByRole("button", { name: "Mark as required" }).click();

    // Add an Email template question (one-click template).
    await page.getByRole("button", { name: "Add question" }).click();
    await page.getByRole("button", { name: "Email Address", exact: true }).click();

    // Edit the email question's label.
    const labels = page.getByPlaceholder("What would you like to ask?");
    await labels.last().fill("Your email");

    // Add a second section.
    await page.getByRole("button", { name: "Add section" }).first().click();
    await expect(page.getByPlaceholder("Section title").nth(1)).toBeVisible();

    // Question count reflects both questions.
    await expect(page.getByText(/2\/25 questions/)).toBeVisible();

    // ── Publish ──
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Form published! Share the link below.")).toBeVisible();

    // ── Fill the public form (fresh anonymous context) ──
    const anonPage = await (await page.context().browser()!.newContext()).newPage();
    await anonPage.goto(`/forms/${slug}`);
    await expect(anonPage.getByRole("heading", { name: title })).toBeVisible();

    await anonPage.getByLabel(/Your full name/).fill("Playwright Tester");
    await anonPage.getByLabel(/Your email/).fill("playwright@example.com");
    await anonPage.getByRole("button", { name: "Submit" }).click();

    // ── Reference ID appears on the confirmation page ──
    await expect(anonPage.getByText("Your reference ID")).toBeVisible({ timeout: 20_000 });
    const refId = (await anonPage.locator(".font-mono.tracking-wider").innerText()).trim();
    expect(refId).toMatch(REFERENCE_ID_PATTERN);
    await anonPage.context().close();

    // ── Review as admin ──
    await page.goto("/forms");
    const row = page.locator("div").filter({ has: page.getByText(title, { exact: true }) }).last();
    await row.getByRole("link", { name: "Responses" }).click();
    await expect(page.getByText(refId)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Playwright Tester")).toBeVisible();

    // Search narrows to the submission; a nonsense term empties the table.
    await page.getByPlaceholder(/Search by name, email/).fill("Playwright Tester");
    await expect(page.getByText(refId)).toBeVisible();
    await page.getByPlaceholder(/Search by name, email/).fill("zzz-no-such-respondent");
    await expect(page.getByText(/No submissions match your filters/)).toBeVisible();
    await page.getByPlaceholder(/Search by name, email/).fill("");

    // Status filter: "approved" excludes the new submission.
    await page.locator("select").first().selectOption("approved");
    await expect(page.getByText(/No submissions match your filters/)).toBeVisible();
    await page.locator("select").first().selectOption("all");
    await expect(page.getByText(refId)).toBeVisible();

    // Date-range filter: today includes it; far past excludes it.
    const today = new Date().toISOString().slice(0, 10);
    await page.locator("#resp-date-from").fill(today);
    await expect(page.getByText(refId)).toBeVisible();
    await page.locator("#resp-date-to").fill("2020-01-02");
    // from > to yields empty (or the 021-missing warning path shows all rows).
    await page.locator("#resp-date-from").fill("2020-01-01");
    await expect(
      page.getByText(/No submissions match your filters/).or(page.getByText(/requires database migration 021/))
    ).toBeVisible();
    await page.getByRole("button", { name: "Clear dates" }).click();
    await expect(page.getByText(refId)).toBeVisible();

    // View details modal shows the answers.
    await page.getByRole("button", { name: "View Details" }).first().click();
    await expect(page.getByText("Submission Details")).toBeVisible();
    await expect(page.getByText("playwright@example.com").first()).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();

    // Export downloads an .xlsx file.
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Export (All|Filtered)/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/-responses\.xlsx$/);
    await expect(page.getByText(/Exported \d+ response/)).toBeVisible({ timeout: 30_000 });

    await trashFormByTitle(page, title);
  });

  test("template-based form creation seeds sections and questions", async ({ page }) => {
    const suffix = uniqueSuffix();
    await page.goto("/forms/new");
    await page.getByRole("button", { name: /Event RSVP/ }).click();
    await expect(page.getByText(/Using "Event RSVP" template/)).toBeVisible();

    const title = `E2E Template ${suffix}`;
    await page.getByPlaceholder("e.g. Event Registration 2026").fill(title);
    await page.getByRole("button", { name: "Create Form" }).click();
    await page.waitForURL("**/forms/*/edit", { timeout: 20_000 });

    // Template content landed in the builder.
    await expect(page.getByText(/\d+\/25 questions/)).toBeVisible();
    await expect(page.getByPlaceholder("Section title").first()).toHaveValue("Attendee Information");

    await trashFormByTitle(page, title);
  });

  test("reordering questions persists after reload", async ({ page }) => {
    const { title } = await createBlankForm(page, "E2E Reorder");

    // Two questions with distinct labels.
    await page.getByRole("button", { name: "Add question" }).click();
    await page.getByRole("button", { name: "Short Answer", exact: true }).click();
    await page.getByPlaceholder("What would you like to ask?").fill("First question");

    await page.getByRole("button", { name: "Add question" }).click();
    await page.getByRole("button", { name: "Paragraph", exact: true }).click();
    await page.getByPlaceholder("What would you like to ask?").last().fill("Second question");

    // Collapse both (drag handles are on the headers either way).
    // Drag the second question's grip above the first one's.
    const grips = page.getByTitle("Drag to reorder question");
    const first = grips.first();
    const second = grips.last();
    const firstBox = (await first.boundingBox())!;
    const secondBox = (await second.boundingBox())!;
    await second.hover();
    await page.mouse.down();
    // dnd-kit needs >5px movement to activate, then a drop on the target.
    await page.mouse.move(secondBox.x, secondBox.y - 20, { steps: 5 });
    await page.mouse.move(firstBox.x + 2, firstBox.y - 5, { steps: 10 });
    await page.mouse.up();

    // Reload — order must come back from the DB, Second before First.
    await page.reload();
    const questionLabels = page.getByPlaceholder("What would you like to ask?");
    // Cards may load collapsed; expand info comes from collapsed previews instead.
    const collapsed = page.locator("p.truncate");
    const texts = (await collapsed.allInnerTexts()).map(t => t.trim()).filter(Boolean);
    const all = texts.length >= 2 ? texts : await questionLabels.evaluateAll(els => els.map(e => (e as HTMLInputElement).value));
    const idxFirst = all.findIndex(t => /First question/.test(t));
    const idxSecond = all.findIndex(t => /Second question/.test(t));
    expect(idxSecond).toBeGreaterThanOrEqual(0);
    expect(idxFirst).toBeGreaterThanOrEqual(0);
    expect(idxSecond).toBeLessThan(idxFirst);

    await trashFormByTitle(page, title);
  });

  test("duplicate copies structure into a new draft with unique slug", async ({ page }) => {
    const { title, slug } = await createBlankForm(page, "E2E Duplicate");

    // One question so the copy has content to prove itself with.
    await page.getByRole("button", { name: "Add question" }).click();
    await page.getByRole("button", { name: "Short Answer", exact: true }).click();
    await page.getByPlaceholder("What would you like to ask?").fill("Original question");

    await page.goto("/forms");
    const row = page.locator("div").filter({ has: page.getByText(title, { exact: true }) }).last();
    await row.getByRole("button", { name: "Duplicate" }).click();
    await page.getByRole("button", { name: "Duplicate", exact: true }).last().click();

    // Lands in the copy's builder with the copied question and new slug.
    await page.waitForURL("**/forms/*/edit", { timeout: 30_000 });
    await expect(page.getByText(`/forms/${slug}-copy`)).toBeVisible();
    await expect(page.getByPlaceholder("Form title")).toHaveValue(`${title} (Copy)`);
    await expect(page.getByText(/1\/25 questions/)).toBeVisible();

    await trashFormByTitle(page, `${title} (Copy)`);
    await trashFormByTitle(page, title);
  });

  test("mobile preview shows the live form in a phone frame", async ({ page }) => {
    const { title } = await createBlankForm(page, "E2E Preview");
    await page.getByRole("button", { name: "Add question" }).click();
    await page.getByRole("button", { name: "Short Answer", exact: true }).click();
    await page.getByPlaceholder("What would you like to ask?").fill("Preview question");

    await page.getByRole("button", { name: "Preview" }).click();
    const frame = page.frameLocator("iframe[title='Form preview']");
    // Draft renders inside preview (admin session) with the banner + question.
    await expect(frame.getByText(/Preview mode — this is how respondents/)).toBeVisible({ timeout: 20_000 });
    await expect(frame.getByText("Preview question")).toBeVisible();

    await page.getByRole("button", { name: "Close" }).click();
    await trashFormByTitle(page, title);
  });
});
