import { existsSync } from "node:fs";
import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "./index";
import { bootstrapAdmin } from "./bootstrap-admin";

/**
 * Le process peut démarrer avec deux `cwd` selon le contexte : racine du
 * monorepo (`/app` dans le Dockerfile — `node apps/invoiceflow-ai/server.js`
 * n'y change pas le cwd) ou dossier de l'app elle-même (`next start` lancé
 * directement depuis `apps/invoiceflow-ai`). On essaie les deux plutôt que
 * de figer une hypothèse fragile.
 */
function resolveMigrationsFolder(): string {
  const fromRepoRoot = path.join(process.cwd(), "apps/invoiceflow-ai/drizzle");
  if (existsSync(fromRepoRoot)) return fromRepoRoot;
  const fromAppDir = path.join(process.cwd(), "drizzle");
  if (existsSync(fromAppDir)) return fromAppDir;
  throw new Error(
    `Dossier de migrations introuvable (essayé ${fromRepoRoot} et ${fromAppDir}).`,
  );
}

/**
 * Tâches de démarrage d'une installation self-hosted (appelé une seule fois
 * par `instrumentation.ts` au boot du serveur, jamais en dev où `next dev`
 * ne charge pas ce hook de la même façon — dev continue d'utiliser
 * `pnpm db:migrate` + `pnpm db:seed` manuellement).
 *
 * Migrations via l'API programmatique `drizzle-orm` (pas le CLI `drizzle-kit`,
 * absent de l'image standalone de production) : lit le même dossier
 * `drizzle/` et la même table de suivi que `drizzle-kit migrate`, les deux
 * sont interchangeables sans risque de double-application.
 *
 * Chemin résolu depuis la racine du monorepo (WORKDIR /app dans le
 * Dockerfile) : le dossier `drizzle/` de cette app y est copié à l'identique
 * (voir Dockerfile, étape runner).
 */
export async function runStartupTasks() {
  const migrationsFolder = resolveMigrationsFolder();

  console.info("[startup] Application des migrations…");
  await migrate(db, { migrationsFolder });
  console.info("[startup] Migrations à jour.");

  if (process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD) {
    console.info("[startup] Bootstrap organisation/administrateur…");
    await bootstrapAdmin(db);
    console.info("[startup] Bootstrap terminé.");
  } else {
    console.info(
      "[startup] SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD absents — bootstrap admin ignoré.",
    );
  }
}
