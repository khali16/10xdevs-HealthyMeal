import type { Locator, Page } from "@playwright/test";
import { RecipeIngredientsEditor } from "./RecipeIngredientsEditor";
import { RecipeMetaEditor } from "./RecipeMetaEditor";
import { RecipeStepsEditor } from "./RecipeStepsEditor";

export class RecipeCreateReviewStep {
  readonly container: Locator;
  readonly titleInput: Locator;
  readonly ingredientsEditor: RecipeIngredientsEditor;
  readonly stepsEditor: RecipeStepsEditor;
  readonly metaEditor: RecipeMetaEditor;
  readonly backButton: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.container = page.getByTestId("recipe-review-step");
    this.titleInput = page.getByTestId("recipe-title-input");
    this.ingredientsEditor = new RecipeIngredientsEditor(page);
    this.stepsEditor = new RecipeStepsEditor(page);
    this.metaEditor = new RecipeMetaEditor(page);
    this.backButton = page.getByTestId("recipe-back-button");
    this.saveButton = page.getByTestId("recipe-save-button");
  }

  async fillTitle(value: string) {
    await this.titleInput.fill(value);
  }

  async clickBack() {
    await this.backButton.click();
  }

  async clickSave() {
    await this.saveButton.click();
  }

  async isSaveDisabled() {
    return await this.saveButton.isDisabled();
  }
}
