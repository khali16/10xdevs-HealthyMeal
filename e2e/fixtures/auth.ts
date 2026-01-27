import { test as base } from "@bgotink/playwright-coverage";
import { LoginPage } from "../pages/LoginPage";

type AuthFixtures = {
  loginPage: LoginPage;
  authenticatedPage: typeof base;
};

export const test = base.extend<AuthFixtures>({
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },
});

export { expect } from "@bgotink/playwright-coverage";

/**
 * Helper function to perform login programmatically in tests
 */
export async function login(loginPage: LoginPage) {
  const email = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_USERNAME and E2E_PASSWORD must be set in .env.test file"
    );
  }

  await loginPage.goto();
  await loginPage.loginAndWaitForNavigation(email, password);
}
