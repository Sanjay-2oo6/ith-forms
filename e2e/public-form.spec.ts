import { test, expect } from "@playwright/test";

/**
 * Public-form specs that need NO admin credentials. They rely on an existing
 * published form; set E2E_PUBLIC_SLUG to point at one (a form whose first
 * section has a text-like "name"-ish question gives the pre-fill assertions
 * something to bite on). Skipped when unset.
 */
const PUBLIC_SLUG = process.env.E2E_PUBLIC_SLUG ?? "";

test.describe("public form", () => {
  test.skip(PUBLIC_SLUG === "", "Set E2E_PUBLIC_SLUG to a published form slug to run public-form specs");

  test("renders the published form", async ({ page }) => {
    await page.goto(`/forms/${PUBLIC_SLUG}`);
    await expect(page.getByRole("button", { name: /Submit|Next/ })).toBeVisible({ timeout: 20_000 });
  });

  test("URL pre-fill populates a compatible text field and stays editable", async ({ page }) => {
    await page.goto(`/forms/${PUBLIC_SLUG}?name=Prefill%20Person`);
    await expect(page.getByRole("button", { name: /Submit|Next/ })).toBeVisible({ timeout: 20_000 });

    // Match priority prefers a `name`-TYPED question over label matches, so
    // WHICH input receives the value depends on the form's questions —
    // assert exactly one text-like input got it, wherever it rendered.
    const countFilled = () =>
      page.locator("input[type=text], input[type=email]").evaluateAll(els =>
        els.filter(e => (e as HTMLInputElement).value === "Prefill Person").length);
    await expect.poll(countFilled, { timeout: 20_000 }).toBe(1);

    // Still editable after pre-fill.
    const idx = await page.locator("input[type=text], input[type=email]").evaluateAll(els =>
      els.findIndex(e => (e as HTMLInputElement).value === "Prefill Person"));
    const target = page.locator("input[type=text], input[type=email]").nth(idx);
    await target.fill("Edited After Prefill");
    await expect(target).toHaveValue("Edited After Prefill");
  });

  test("pre-fill does not bypass required validation", async ({ page }) => {
    await page.goto(`/forms/${PUBLIC_SLUG}?name=Only%20Name`);
    // Try to advance/submit with everything else empty — validation errors appear.
    await page.getByRole("button", { name: /Submit|Next/ }).first().click();
    await expect(page.getByText("This field is required").first()).toBeVisible();
  });

  test("unknown query params are ignored safely", async ({ page }) => {
    await page.goto(`/forms/${PUBLIC_SLUG}?nonexistent_param=<script>alert(1)</script>&x=1`);
    await expect(page.getByRole("button", { name: /Submit|Next/ })).toBeVisible({ timeout: 20_000 });
    // Nothing crashed, no injected content rendered outside inputs.
    const alerts: string[] = [];
    page.on("dialog", d => { alerts.push(d.message()); d.dismiss(); });
    expect(alerts).toHaveLength(0);
  });

  test("anon ?preview=1 does NOT activate preview mode (admin-gated)", async ({ page }) => {
    // Preview affordances (banner, gate-skipping, validation-free navigation)
    // require a verified active-admin session. For the public, ?preview=1
    // must behave exactly like the normal form — including validation.
    await page.goto(`/forms/${PUBLIC_SLUG}?preview=1`);
    await expect(page.getByRole("button", { name: /Submit|Next/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Preview mode/)).not.toBeVisible();
    await page.getByRole("button", { name: /Submit|Next/ }).first().click();
    await expect(page.getByText("This field is required").first()).toBeVisible();
  });

  test("an unknown slug shows Form Unavailable", async ({ page }) => {
    await page.goto(`/forms/definitely-not-a-real-slug-xyz`);
    await expect(page.getByText("Form Unavailable")).toBeVisible({ timeout: 20_000 });
  });

  test("a draft form is unavailable to anonymous visitors even with ?preview=1", async ({ page }) => {
    // Preview grants nothing to anon: RLS hides non-published rows entirely.
    const draftSlug = process.env.E2E_DRAFT_SLUG ?? "";
    test.skip(draftSlug === "", "Set E2E_DRAFT_SLUG to a draft form slug to run this check");
    await page.goto(`/forms/${draftSlug}?preview=1`);
    await expect(page.getByText("Form Unavailable")).toBeVisible({ timeout: 20_000 });
  });
});
