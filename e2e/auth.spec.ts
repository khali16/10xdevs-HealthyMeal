import { test, expect } from "./fixtures/auth";

test.describe("Authentication", () => {
  // Ten test NIE używa authenticated state (działa na czystym kontekście)
  test.use({ storageState: { cookies: [], origins: [] } });

  test("should login with valid credentials", async ({ loginPage, page }) => {
    const email = process.env.E2E_USERNAME;
    const password = process.env.E2E_PASSWORD;

    if (!email || !password) {
      test.skip();
      return;
    } 

    await loginPage.goto();

    // Sprawdzamy czy formularz jest widoczny
    await expect(loginPage.form).toBeVisible();

    // Logujemy się
    await loginPage.login(email, password);

    // Sprawdzamy przekierowanie po udanym logowaniu
    await expect(page).toHaveURL(/\/recipes/, { timeout: 10000 });
  });

  test("should show error with invalid credentials", async ({
    loginPage,
  }) => {
    await loginPage.goto();

    // Próbujemy zalogować się z nieprawidłowymi danymi
    await loginPage.login("invalid@example.com", "wrongpassword");

    // Czekamy na komunikat o błędzie
    await expect(loginPage.errorAlert).toBeVisible({ timeout: 5000 });
  });

  test("should disable submit button when fields are empty", async ({
    loginPage,
  }) => {
    await loginPage.goto();

    // Przycisk powinien być wyłączony gdy pola są puste
    const isDisabled = await loginPage.isSubmitDisabled();
    expect(isDisabled).toBe(true);
  });

  test("should enable submit button when fields are filled", async ({
    loginPage,
  }) => {
    await loginPage.goto();

    await loginPage.emailInput.fill("test@example.com");
    await loginPage.passwordInput.fill("password123");

    // Przycisk powinien być włączony
    const isDisabled = await loginPage.isSubmitDisabled();
    expect(isDisabled).toBe(false);
  });
});
