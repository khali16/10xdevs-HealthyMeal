import { defineCoverageReporterConfig } from "@bgotink/playwright-coverage";
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "node:path";

// Locally we load credentials from `.env.test` (gitignored).
// In CI we expect E2E_USERNAME/E2E_PASSWORD to be provided via workflow env/secrets.
if (!process.env.CI) {
  dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    [
      "@bgotink/playwright-coverage",
      defineCoverageReporterConfig({
        sourceRoot: process.cwd(),
        resultDir: path.resolve(process.cwd(), "coverage/e2e"),
        exclude: [
          "**/node_modules/**",
          "**/dist/**",
          "**/.astro/**",
          "**/e2e/**",
          "**/coverage/**",
        ],
        reports: [
          ["html"],
          ["lcovonly", { file: "lcov.info" }],
          ["json-summary", { file: "coverage-summary.json" }],
          ["text-summary", { file: null }],
        ],
      }),
    ],
  ],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    // Setup project - runs authentication once before all tests
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    // Main test project - uses authenticated state
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: ".auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    // In CI we want to validate the production build, not the dev server.
    command: process.env.CI
      ? "npm run preview -- --port 3000"
      : "npm run dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

