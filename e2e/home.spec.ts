import { expect, test } from "@bgotink/playwright-coverage";
import { HomePage } from "./pages/HomePage";

test.describe("Home", () => {
  test("renders the welcome screen", async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goto();

    await expect(homePage.welcomeHeading).toBeVisible();
  });

  test.skip("visual regression snapshot (enable when ready)", async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goto();

    // Generate baselines with: `npm run test:e2e -- --update-snapshots`
    await expect(page).toHaveScreenshot("home.png");
  });
});

