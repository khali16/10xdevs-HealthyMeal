import type { Locator, Page } from "@playwright/test";
import { RecipeCreatePasteStep } from "./RecipeCreatePasteStep";
import { RecipeCreateReviewStep } from "./RecipeCreateReviewStep";

export class RecipeCreateWizardPage {
  readonly container: Locator;
  readonly pasteStep: RecipeCreatePasteStep;
  readonly reviewStep: RecipeCreateReviewStep;

  constructor(page: Page) {
    this.container = page.getByTestId("recipe-create-wizard-page");
    this.pasteStep = new RecipeCreatePasteStep(page);
    this.reviewStep = new RecipeCreateReviewStep(page);
  }

  async waitForLoad() {
    await this.container.waitFor({ state: "visible" });
  }

  async isPasteStepVisible() {
    return await this.pasteStep.container.isVisible();
  }

  async isReviewStepVisible() {
    return await this.reviewStep.container.isVisible();
  }
}
