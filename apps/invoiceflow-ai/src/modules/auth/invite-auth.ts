import "server-only";
import { createAuth } from "@daromsart/auth";
import { db } from "../../db";
import * as schema from "../../db/schema";
import { env } from "../../lib/env";

/**
 * Instance Better Auth dédiée `allowSignUp: true` (story 21) — seule
 * utilisée pour créer un compte à l'acceptation d'une invitation (ou par le
 * seed, script séparé). L'instance principale (`auth.ts`) reste
 * `allowSignUp: false` : l'inscription publique ne s'ouvre jamais.
 */
export const inviteAuth = createAuth({
  db,
  schema,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.APP_URL],
  allowSignUp: true,
  sendResetPassword: async () => {},
});
