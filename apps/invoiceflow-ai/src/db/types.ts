import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "./schema";

/**
 * Type de connexion Drizzle générique, injectable dans les mutations/requêtes
 * pures des modules (testables sans dépendre du singleton `db` de l'app, qui
 * est lié à `DATABASE_URL` plutôt qu'à `TEST_DATABASE_URL` en test).
 */
export type AppDb = PostgresJsDatabase<typeof schema>;
