import type { Locator, Page } from "@playwright/test";

export class RecipesFiltersBar {
  private readonly page: Page;
  readonly container: Locator;
  readonly searchInput: Locator;
  readonly dietSelect: Locator;
  readonly maxCaloriesInput: Locator;
  readonly maxTimeInput: Locator;
  readonly favoriteSwitch: Locator;
  readonly clearButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.getByTestId("recipes-filters-bar");
    this.searchInput = page.getByTestId("filter-search-input");
    this.dietSelect = page.getByTestId("filter-diet-select");
    this.maxCaloriesInput = page.getByTestId("filter-max-calories-input");
    this.maxTimeInput = page.getByTestId("filter-max-time-input");
    this.favoriteSwitch = page.getByTestId("filter-favorite-switch");
    this.clearButton = page.getByTestId("filter-clear-button");
  }

  async searchByQuery(query: string) {
    await this.searchInput.fill(query);
  }

  async selectDiet(diet: "vegan" | "vegetarian" | "keto") {
    await this.dietSelect.click();
    await this.page.getByRole("option", { name: getDietLabel(diet) }).click();
  }

  async setMaxCalories(calories: number) {
    await this.maxCaloriesInput.fill(calories.toString());
  }

  async setMaxTime(minutes: number) {
    await this.maxTimeInput.fill(minutes.toString());
  }

  async toggleFavorite() {
    await this.favoriteSwitch.click();
  }

  async clearFilters() {
    await this.clearButton.click();
  }

  async getSearchValue() {
    return await this.searchInput.inputValue();
  }

  async getMaxCaloriesValue() {
    return await this.maxCaloriesInput.inputValue();
  }

  async getMaxTimeValue() {
    return await this.maxTimeInput.inputValue();
  }
}

function getDietLabel(diet: "vegan" | "vegetarian" | "keto"): string {
  const labels = {
    vegan: "Wegańska",
    vegetarian: "Wegetariańska",
    keto: "Keto",
  };
  return labels[diet];
}
