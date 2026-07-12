import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "invoiceflow-ai:integration",
    environment: "node",
    setupFiles: ["./vitest.setup.integration.ts"],
    include: ["src/**/*.integration.test.{ts,tsx}"],
    // Un seul worker : les tests partagent la base de test et la réinitialisent.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
