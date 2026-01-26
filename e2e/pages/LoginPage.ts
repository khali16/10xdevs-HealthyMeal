import type { Locator, Page } from "@playwright/test";

export class LoginPage {
  private readonly page: Page;
  readonly container: Locator;
  readonly form: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly googleButton: Locator;
  readonly errorAlert: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.getByTestId("login-page");
    this.form = page.getByTestId("login-form");
    this.emailInput = page.getByTestId("auth-input-email");
    this.passwordInput = page.getByTestId("auth-input-password");
    this.submitButton = page.getByTestId("login-submit-button");
    this.googleButton = page.getByTestId("login-google-button");
    this.errorAlert = page.getByTestId("login-error-alert");
  }

  async goto() {
    await this.page.goto("/auth/login");
  }

  async login(email: string, password: string) {
    // Fill email field and trigger change event
    await this.emailInput.click();
    await this.emailInput.fill(email);
    await this.emailInput.blur();

    // Fill password field and trigger change event
    await this.passwordInput.click();
    await this.passwordInput.fill(password);
    await this.passwordInput.blur();

    // Wait for button to be enabled (react-hook-form needs time to validate)
    await this.page.waitForFunction(() => {
      const button = document.querySelector('[data-testid="login-submit-button"]');
      return button && !button.hasAttribute('disabled');
    }, { timeout: 5000 });
    
    await this.submitButton.click();
  }

  async loginAndWaitForNavigation(email: string, password: string) {
    await this.login(email, password);
    await this.page.waitForURL(/\/recipes/, { timeout: 10000 });
  }

  async isErrorVisible() {
    return await this.errorAlert.isVisible();
  }

  async getErrorMessage() {
    return await this.errorAlert.textContent();
  }

  async isSubmitDisabled() {
    return await this.submitButton.isDisabled();
  }
}
