import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "invoiceflow-ai",
    environment: "node",
    // Tests unitaires uniquement. Les tests d'intégration (DB) ont leur propre
    // config (vitest.integration.config.ts) et ne tournent pas dans `pnpm test`.
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["src/**/*.integration.test.{ts,tsx}", "node_modules/**"],
  },
});
