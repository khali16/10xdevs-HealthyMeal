import type { Locator, Page } from "@playwright/test";

export class RecipesPagination {
  private readonly page: Page;
  readonly container: Locator;
  readonly info: Locator;
  readonly prevButton: Locator;
  readonly nextButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.getByTestId("recipes-pagination");
    this.info = page.getByTestId("recipes-pagination-info");
    this.prevButton = page.getByTestId("recipes-pagination-prev");
    this.nextButton = page.getByTestId("recipes-pagination-next");
  }

  async goToNextPage() {
    await this.nextButton.click();
  }

  async goToPreviousPage() {
    await this.prevButton.click();
  }

  async isPreviousDisabled() {
    return await this.prevButton.isDisabled();
  }

  async isNextDisabled() {
    return await this.nextButton.isDisabled();
  }

  async getPaginationInfo() {
    return await this.info.textContent();
  }

  async isVisible() {
    return await this.container.isVisible();
  }

  async waitForEnabled() {
    await this.nextButton.waitFor({ state: "visible" });
    await this.prevButton.waitFor({ state: "visible" });
  }
}
