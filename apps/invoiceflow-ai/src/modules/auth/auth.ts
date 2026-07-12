import "server-only";
import { createAuth } from "@daromsart/auth";
import { db } from "../../db";
import * as schema from "../../db/schema";
import { env } from "../../lib/env";
import { sendResetPasswordEmail } from "./send-reset-password";

/**
 * Instance Better Auth de l'application. Inscription désactivée : l'accès se
 * fait uniquement sur invitation (le seed et les invitations passent par une
 * instance dédiée `allowSignUp: true`).
 */
export const auth = createAuth({
  db,
  schema,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.APP_URL],
  allowSignUp: false,
  sendResetPassword: sendResetPasswordEmail,
});
