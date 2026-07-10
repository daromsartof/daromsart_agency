import { defineWorkspace } from "vitest/config";

// Chaque package/app expose sa propre config Vitest ; ce workspace les agrège
// pour permettre `pnpm test` (via turbo) et un run global ponctuel.
export default defineWorkspace([
  "packages/*/vitest.config.ts",
  "apps/*/vitest.config.ts",
]);
