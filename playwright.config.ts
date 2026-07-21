import path from "node:path";
import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// `.env` vit dans apps/invoiceflow-ai (pas de .env racine) : SEED_ADMIN_EMAIL/
// PASSWORD utilisés par les specs doivent être chargés explicitement, ce
// fichier tournant depuis la racine du monorepo.
config({ path: path.join(__dirname, "apps/invoiceflow-ai/.env") });

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
