import "server-only";
import { mailer } from "../../lib/mailer";

/**
 * Envoi de l'email de réinitialisation de mot de passe via `@daromsart/email`
 * (story 10). En l'absence de `RESEND_API_KEY`, le mailer bascule lui-même en
 * mode dev (aperçu HTML sur disque, pas d'accès réseau) — rien à distinguer
 * ici.
 */
export async function sendResetPasswordEmail(params: {
  email: string;
  url: string;
  token: string;
}): Promise<void> {
  const result = await mailer.sendResetPasswordEmail({ to: params.email, url: params.url });
  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.error(
      `[auth] Échec de l'envoi de l'email de réinitialisation à ${params.email} : ${result.error}`,
    );
  }
}
