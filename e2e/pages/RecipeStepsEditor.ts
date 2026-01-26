import type { Locator, Page } from "@playwright/test";

export class RecipeStepsEditor {
  private readonly page: Page;
  readonly container: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.getByTestId("recipe-steps-editor");
  }

  stepRow(index: number) {
    return this.page.getByTestId(`recipe-step-${index}`);
  }

  stepTextInput(index: number) {
    return this.page.getByTestId(`recipe-step-${index}-text`);
  }

  async fillStepText(index: number, value: string) {
    await this.stepTextInput(index).fill(value);
  }
}
