# E2E Tests Documentation

## Overview

This directory contains end-to-end tests using Playwright with Page Object Model pattern.

## Authentication Setup

### Prerequisites

Before running the tests, you need to set up authentication credentials in `.env.test`:

```env 
E2E_USERNAME=your-test-user@example.com
E2E_PASSWORD=your-test-password
```

### How Authentication Works

1. **Setup Project**: The `auth.setup.ts` file runs once before all tests and logs in using credentials from `.env.test`. The authenticated state is saved to `.auth/user.json`.

2. **Test Projects**: All tests in the `chromium` project automatically use the saved authentication state, so they start already logged in.

3. **Skip Authentication**: If you need to test unauthenticated flows (like login), use:
   ```typescript
   test.use({ storageState: { cookies: [], origins: [] } });
   ```

## Running Tests

```bash
# Start dev server with test environment (uses .env.test)
npm run dev:e2e

# Run all tests
npm run test:e2e

# Run tests in UI mode
npm run test:e2e:ui

# Run specific test file
npm run test:e2e e2e/recipes-list.spec.ts

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Run only authentication setup
npm run test:e2e:setup

# Debug tests
npm run test:e2e:debug
```

## Page Object Model (POM)

All page objects are located in `e2e/pages/`. Each page/component has its own class:

### Available Page Objects

- **LoginPage** - Authentication page (`/auth/login`)
- **RecipesListPage** - Main recipes list page with filtering and pagination
- **RecipesFiltersBar** - Filters component
- **RecipesGrid** - Grid of recipe cards
- **RecipeCard** - Individual recipe card
- **RecipesPagination** - Pagination controls

### Using Page Objects

```typescript
import { test, expect } from "@playwright/test";
import { RecipesListPage } from "./pages/RecipesListPage";

test("example test", async ({ page }) => {
  const recipesPage = new RecipesListPage(page);
  
  await recipesPage.goto();
  await recipesPage.filtersBar.searchByQuery("chicken");
  
  const cardsCount = await recipesPage.grid.getRecipeCardsCount();
  expect(cardsCount).toBeGreaterThan(0);
});
```

## Test Structure

```
e2e/
├── pages/              # Page Object Models
│   ├── LoginPage.ts
│   ├── RecipesListPage.ts
│   ├── RecipesFiltersBar.ts
│   ├── RecipesGrid.ts
│   ├── RecipeCard.ts
│   ├── RecipesPagination.ts
│   └── index.ts
├── fixtures/           # Custom fixtures and helpers
│   └── auth.ts
├── auth.setup.ts       # Authentication setup (runs before all tests)
├── auth.spec.ts        # Authentication tests
├── recipes-list.spec.ts # Recipes list tests
├── home.spec.ts        # Home page tests
└── README.md
```

## Best Practices

1. **Use Page Objects**: Always interact with pages through Page Object classes, not direct selectors.

2. **Use data-testid**: All interactive elements have `data-testid` attributes for reliable selection.

3. **Wait for Navigation**: Use `waitForURL()` or `waitForLoadState()` after actions that trigger navigation.

4. **Avoid Hard Waits**: Use `waitFor*` methods instead of `setTimeout()` or `page.waitForTimeout()`.

5. **Parallel Execution**: Tests run in parallel by default. Ensure tests are independent.

6. **Cleanup**: Tests automatically clean up their context. No manual cleanup needed.

## Troubleshooting

### Tests fail with "E2E_USERNAME and E2E_PASSWORD must be set"

Make sure you have `.env.test` file with valid credentials:
```env
E2E_USERNAME=your-email@example.com
E2E_PASSWORD=your-password
```

### Authentication setup fails

1. Check if the dev server is running (`npm run dev`)
2. Verify credentials in `.env.test` are correct
3. Try running setup manually: `npx playwright test --project=setup`

### Tests timeout

1. Increase timeout in specific test: `test.setTimeout(60000)`
2. Check if dev server is running properly
3. Run with `--headed` to see what's happening in browser

## CI/CD

In CI environment, make sure to:

1. Set `E2E_USERNAME` and `E2E_PASSWORD` as environment variables or secrets
2. Tests will automatically use CI-optimized settings (retries, workers, etc.)
3. HTML report is generated but not auto-opened in CI

## Visual Regression Testing

To enable visual regression tests:

1. Generate baseline snapshots:
   ```bash
   npm run test:e2e -- --update-snapshots
   ```

2. Uncommit the `.skip()` from visual regression tests

3. Snapshots are stored in `e2e/**/__snapshots__/`
