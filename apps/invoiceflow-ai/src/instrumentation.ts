/**
 * Hook Next.js exécuté une fois au démarrage du serveur (avant de servir la
 * première requête). Sert UNIQUEMENT le bootstrap self-hosted de production
 * (migrations + compte admin initial, voir `db/startup.ts`) — jamais en dev,
 * où le workflow manuel existant (`pnpm db:migrate` / `pnpm db:seed`) reste
 * inchangé, ni côté edge runtime (middleware), qui ne peut pas parler à
 * Postgres.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production") {
    const { runStartupTasks } = await import("./db/startup");
    await runStartupTasks();
  }
}
