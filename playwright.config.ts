import { defineConfig, devices } from "@playwright/test";

/**
 * Config e2e. Le serveur de dev de l'app est lancé automatiquement.
 * Lancer : `pnpm e2e` (nécessite `pnpm exec playwright install chromium`).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm --filter @daromsart/invoiceflow-ai dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
