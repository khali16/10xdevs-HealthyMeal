import type { Locator, Page } from "@playwright/test";
import { RecipeCard } from "./RecipeCard";

export class RecipesGrid {
  private readonly page: Page;
  readonly container: Locator;
  readonly skeletons: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.getByTestId("recipes-grid");
    this.skeletons = page.getByTestId("recipe-card-skeleton");
  }

  async getRecipeCards() {
    const cards = await this.page.locator('[data-testid^="recipe-card-"]').all();
    return cards.map((locator) => new RecipeCard(this.page, locator));
  }

  async getRecipeCardById(id: string) {
    const locator = this.page.getByTestId(`recipe-card-${id}`);
    return new RecipeCard(this.page, locator);
  }

  async getRecipeCardsCount() {
    return await this.page.locator('[data-testid^="recipe-card-"]').count();
  }

  async getFirstRecipeCard() {
    const locator = this.page.locator('[data-testid^="recipe-card-"]').first();
    return new RecipeCard(this.page, locator);
  }

  async waitForCards() {
    await this.container.waitFor({ state: "visible" });
    await this.page.locator('[data-testid^="recipe-card-"]').first().waitFor({ state: "visible" });
  }

  async isLoading() {
    return (await this.skeletons.count()) > 0;
  }
}
