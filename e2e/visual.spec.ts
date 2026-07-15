import { test, expect, type Page } from "@playwright/test";

/**
 * Visual regression coverage for the theme system and public forms.
 *
 * Run with:  npx playwright test --project=visual
 * First run creates baselines (test-results/…-snapshots); commit them and
 * subsequent runs diff against those baselines.
 *
 * Requires E2E_PUBLIC_SLUG (a published form). Dynamic content (dates,
 * response counters) is masked or absent on these surfaces; animations are
 * disabled so fade-ups can't smear the capture.
 */
const PUBLIC_SLUG = process.env.E2E_PUBLIC_SLUG ?? "";

async function settle(page: Page) {
  // Disable animations & lazy fades for deterministic pixels.
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `,
  });
  await page.waitForLoadState("networkidle");
}

test.describe("visual: public form themes", () => {
  test.skip(PUBLIC_SLUG === "", "Set E2E_PUBLIC_SLUG to a published form slug to run visual specs");

  test("default desktop", async ({ page }) => {
    await page.goto(`/forms/${PUBLIC_SLUG}`);
    await settle(page);
    await expect(page).toHaveScreenshot("public-form-desktop.png", { fullPage: true });
  });

  test("mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/forms/${PUBLIC_SLUG}`);
    await settle(page);
    await expect(page).toHaveScreenshot("public-form-mobile.png", { fullPage: true });
  });

  test("preview banner state", async ({ page }) => {
    await page.goto(`/forms/${PUBLIC_SLUG}?preview=1`);
    await settle(page);
    await expect(page).toHaveScreenshot("public-form-preview.png", { fullPage: true });
  });
});

test.describe("visual: admin login (light/dark)", () => {
  test("login dark", async ({ page }) => {
    await page.goto("/admin/login");
    await settle(page);
    await expect(page).toHaveScreenshot("login-dark.png");
  });

  test("login light", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByRole("button", { name: "Toggle theme" }).click();
    await settle(page);
    await expect(page).toHaveScreenshot("login-light.png");
  });
});

/**
 * Theme-editor permutations (colors, font, width, overlay) live behind admin
 * auth. When credentials are provided we capture the theme editor's live
 * preview pane while toggling presets — that pane feeds off the exact same
 * themeContainerStyle() pipeline the public form uses.
 */
import { adminLogin, hasAdminCreds, createBlankForm, trashFormByTitle } from "./helpers";

test.describe("visual: theme presets", () => {
  test.skip(!hasAdminCreds, "Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD for theme visual specs");

  test("preset permutations in the theme editor preview", async ({ page }) => {
    await adminLogin(page);
    const { title } = await createBlankForm(page, "Visual Theme");
    await page.getByRole("link", { name: "Theme" }).click();
    await page.waitForURL("**/theme");

    for (const preset of ["Professional", "Academic", "Minimal", "Dark"]) {
      await page.getByRole("button", { name: preset }).click();
      await settle(page);
      await expect(page.locator("div").filter({ hasText: "Live preview" }).last())
        .toHaveScreenshot(`theme-preset-${preset.toLowerCase()}.png`);
    }

    await trashFormByTitle(page, title);
  });
});
