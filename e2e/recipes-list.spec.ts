import { expect, test } from "@bgotink/playwright-coverage";
import { RecipesListPage } from "./pages/RecipesListPage";

test.describe("Recipes List", () => {
  // Wszystkie testy w tym describe używają authenticated state
  // (automatycznie dzięki konfiguracji w playwright.config.ts)

  test("should display recipes list and allow filtering", async ({ page }) => {
    const recipesPage = new RecipesListPage(page);

    // 1. Otwieramy listę przepisów
    await recipesPage.goto();
    await recipesPage.waitForLoad();

    // 2. Upewniamy się czy jakieś recipe cards są widoczne
    await recipesPage.grid.waitForCards();
    const cardsCount = await recipesPage.grid.getRecipeCardsCount();
    expect(cardsCount).toBeGreaterThan(0);

    // 3. Wpisujemy jakieś filtry
    await recipesPage.filtersBar.searchByQuery("kurczak");
    await recipesPage.filtersBar.setMaxCalories(500);
    await recipesPage.filtersBar.setMaxTime(50);

    // 4. Upewniamy się czy lista się zaktualizowała
    // Czekamy na załadowanie nowych wyników
    await page.waitForTimeout(600); // Czekamy na debounce + fetch
    await recipesPage.grid.waitForCards();

    // Sprawdzamy czy filtry zostały zastosowane
    const searchValue = await recipesPage.filtersBar.getSearchValue();
    expect(searchValue).toBe("kurczak");

    // 5. Na onClick card powinniśmy być przeniesieni
    const firstCard = await recipesPage.grid.getFirstRecipeCard();
    await firstCard.clickTitle();

    // Sprawdzamy czy URL zawiera /recipes/:id
    await expect(page).toHaveURL(/\/recipes\/[a-f0-9-]+/);
  });

  test("should display empty state when no recipes match filters", async ({
    page,
  }) => {
    const recipesPage = new RecipesListPage(page);

    await recipesPage.goto();
    await recipesPage.waitForLoad();

    // 2. Upewniamy się czy jakieś recipe cards są widoczne
    await recipesPage.grid.waitForCards();
    const cardsCount = await recipesPage.grid.getRecipeCardsCount();
    expect(cardsCount).toBeGreaterThan(0);

    // 3. Wpisujemy jakieś filtry
    await recipesPage.filtersBar.searchByQuery("zyzzgzhzhnonexistentrecipe123");

    // Sprawdzamy czy wyświetla się pusty stan
    await expect(recipesPage.emptyState).toBeVisible();
    await expect(page.locator('[data-testid^="recipe-card-"]')).toHaveCount(0);
  });


  test("should filter only favorite recipes", async ({ page }) => {
    const recipesPage = new RecipesListPage(page);

    await recipesPage.goto();
    await recipesPage.waitForLoad();

    // Włączamy filtr "Tylko ulubione"
    await recipesPage.filtersBar.favoriteSwitch.waitFor({ state: "visible" });
    await recipesPage.filtersBar.favoriteSwitch.scrollIntoViewIfNeeded();
    await recipesPage.filtersBar.toggleFavorite();
    await expect(recipesPage.filtersBar.favoriteSwitch).toHaveAttribute(
      "aria-checked",
      "true"
    );

    // Sprawdzamy czy URL zawiera favorite=true
    await expect(page).toHaveURL(/favorite=true/);
  });
});
