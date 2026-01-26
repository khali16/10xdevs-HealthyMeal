import type { Locator, Page } from "@playwright/test";
import { RecipesFiltersBar } from "./RecipesFiltersBar.js";
import { RecipesGrid } from "./RecipesGrid.js";
import { RecipesPagination } from "./RecipesPagination.js";

export class RecipesListPage {
  private readonly page: Page;
  readonly container: Locator;
  readonly createNewRecipeButton: Locator;
  readonly filtersBar: RecipesFiltersBar;
  readonly grid: RecipesGrid;
  readonly pagination: RecipesPagination;
  readonly emptyState: Locator;
  readonly errorState: Locator;
  readonly errorRetryButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.getByTestId("recipes-list-page");
    this.createNewRecipeButton = page.getByTestId("create-new-recipe-button");
    this.filtersBar = new RecipesFiltersBar(page);
    this.grid = new RecipesGrid(page);
    this.pagination = new RecipesPagination(page);
    this.emptyState = page.getByTestId("recipes-empty-state");
    this.errorState = page.getByTestId("recipes-error-state");
    this.errorRetryButton = page.getByTestId("recipes-error-retry-button");
  } 

  async goto() {
    await this.page.goto("/recipes");
  }

  async waitForLoad() {
    await this.container.waitFor({ state: "visible" });
  }
 
  async isEmptyStateVisible() {
    return await this.emptyState.isVisible();
  }

  async isErrorStateVisible() {
    return await this.errorState.isVisible();
  }

  async retryOnError() {
    await this.errorRetryButton.click();
  }

  async clickCreateNewRecipe() {
    await this.createNewRecipeButton.click();
  }
}
