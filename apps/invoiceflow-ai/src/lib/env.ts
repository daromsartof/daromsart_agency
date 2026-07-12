import { parseEnv } from "./env-schema";

export type { Env } from "./env-schema";
export { envSchema, parseEnv } from "./env-schema";

/**
 * Environnement validé (fail-fast au premier import côté serveur).
 * NE PAS importer depuis un composant client : contient des secrets.
 */
export const env = parseEnv(process.env);
