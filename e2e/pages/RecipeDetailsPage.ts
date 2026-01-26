import type { Locator, Page } from "@playwright/test";

export class RecipeDetailsPage {
  readonly container: Locator;
  readonly title: Locator;

  constructor(page: Page) {
    this.container = page.getByTestId("recipe-details-page");
    this.title = page.getByTestId("recipe-details-title");
  }

  async waitForLoad() {
    await this.container.waitFor({ state: "visible" });
  }

  async getTitle() {
    return await this.title.textContent();
  }
}
