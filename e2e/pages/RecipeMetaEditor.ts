import type { Locator, Page } from "@playwright/test";

export class RecipeMetaEditor {
  private readonly page: Page;
  readonly container: Locator;
  readonly servingsInput: Locator;
  readonly caloriesInput: Locator;
  readonly prepTimeInput: Locator;
  readonly cookTimeInput: Locator;
  readonly courseSection: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.getByTestId("recipe-meta-editor");
    this.servingsInput = page.getByTestId("recipe-servings-input");
    this.caloriesInput = page.getByTestId("recipe-calories-input");
    this.prepTimeInput = page.getByTestId("recipe-prep-time-input");
    this.cookTimeInput = page.getByTestId("recipe-cook-time-input");
    this.courseSection = page.getByTestId("recipe-course-section");
  }

  courseOption(value: string) {
    return this.page.getByTestId(`recipe-course-${value}`);
  }

  async fillServings(value: string) {
    await this.servingsInput.fill(value);
  }

  async fillCalories(value: string) {
    await this.caloriesInput.fill(value);
  }

  async fillPrepTime(value: string) {
    await this.prepTimeInput.fill(value);
  }

  async fillCookTime(value: string) {
    await this.cookTimeInput.fill(value);
  }

  async selectCourse(value: string) {
    await this.courseOption(value).check();
  }
}
