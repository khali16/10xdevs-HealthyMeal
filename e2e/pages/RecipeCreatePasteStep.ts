import type { Locator, Page } from "@playwright/test";

export class RecipeCreatePasteStep {
  readonly container: Locator;
  readonly rawInput: Locator;
  readonly nextButton: Locator;

  constructor(page: Page) {
    this.container = page.getByTestId("recipe-paste-step");
    this.rawInput = page.getByTestId("recipe-raw-input");
    this.nextButton = page.getByTestId("recipe-paste-next-button");
  }

  async fillRawRecipe(value: string) {
    await this.rawInput.fill(value);
  }

  async goNext() {
    await this.nextButton.click();
  }

  async isNextDisabled() {
    return await this.nextButton.isDisabled();
  }
}
