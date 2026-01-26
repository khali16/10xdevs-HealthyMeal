import type { Locator, Page } from "@playwright/test";

export class RecipeIngredientsEditor {
  private readonly page: Page;
  readonly container: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.getByTestId("recipe-ingredients-editor");
  }

  ingredientRow(index: number) {
    return this.page.getByTestId(`recipe-ingredient-${index}`);
  }

  ingredientTextInput(index: number) {
    return this.page.getByTestId(`recipe-ingredient-${index}-text`);
  }

  ingredientAmountInput(index: number) {
    return this.page.getByTestId(`recipe-ingredient-${index}-amount`);
  }

  ingredientUnitInput(index: number) {
    return this.page.getByTestId(`recipe-ingredient-${index}-unit`);
  }

  async fillIngredientText(index: number, value: string) {
    await this.ingredientTextInput(index).fill(value);
  }

  async fillIngredientAmount(index: number, value: string) {
    await this.ingredientAmountInput(index).fill(value);
  }

  async fillIngredientUnit(index: number, value: string) {
    await this.ingredientUnitInput(index).fill(value);
  }
}
