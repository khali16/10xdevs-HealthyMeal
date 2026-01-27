import type { Locator, Page } from "@playwright/test";

export class RecipeCard {
  private readonly page: Page;
  readonly container: Locator;
  private readonly recipeId: string;

  constructor(page: Page, cardLocator: Locator) {
    this.page = page;
    this.container = cardLocator;
    // Extract ID from data-testid attribute
    this.recipeId = this.extractIdFromLocator(cardLocator);
  }

  private extractIdFromLocator(_locator: Locator): string {
    // This is a placeholder - in actual implementation, the ID will be extracted dynamically
    return "";
  }

  get titleButton(): Locator {
    return this.container.locator('[data-testid^="recipe-card-title-"]');
  }

  get favoriteButton(): Locator {
    return this.container.locator('[data-testid^="recipe-card-favorite-"]');
  }

  async getTitle() {
    return await this.titleButton.textContent();
  }

  async clickTitle() {
    await this.titleButton.click();
  }

  async toggleFavorite() {
    await this.favoriteButton.click();
  }

  async isFavorite() {
    const ariaPressed = await this.favoriteButton.getAttribute("aria-pressed");
    return ariaPressed === "true";
  }

  async openRecipe() {
    await this.clickTitle();
  }

  async isVisible() {
    return await this.container.isVisible();
  }
}
