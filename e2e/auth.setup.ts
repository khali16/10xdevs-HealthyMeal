import { test as setup, expect } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";

const authFile = ".auth/user.json";

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_USERNAME and E2E_PASSWORD must be set in .env.test file"
    );
  }

  const loginPage = new LoginPage(page);

  await loginPage.goto();
  await loginPage.login(email, password);

  // Czekamy na przekierowanie po udanym logowaniu
  await page.waitForURL(/\/recipes/, { timeout: 10000 });

  // Sprawdzamy czy rzeczywiście jesteśmy zalogowani
  await expect(page).toHaveURL(/\/recipes/);

  // Zapisujemy stan uwierzytelnienia
  await page.context().storageState({ path: authFile });

  console.log("✓ Authentication setup completed");
});
