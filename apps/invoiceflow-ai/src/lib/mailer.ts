import "server-only";
import { createMailer } from "@daromsart/email";
import { env } from "./env";

/**
 * Mode dev tant que `RESEND_API_KEY` est vide (H12) : aucun appel réseau,
 * aperçu HTML écrit dans `.storage/emails/`.
 */
export const mailer = createMailer({
  apiKey: env.RESEND_API_KEY || undefined,
  from: env.EMAIL_FROM,
});
