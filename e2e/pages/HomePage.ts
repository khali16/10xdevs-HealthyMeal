import type { Locator, Page } from "@playwright/test";

export class HomePage {
  private readonly page: Page;
  readonly welcomeHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.welcomeHeading = page.getByRole("heading", {
      name: /Witaj w 10xDevs Astro Starter!/i,
    });
  }

  async goto() {
    await this.page.goto("/");
  }
}

