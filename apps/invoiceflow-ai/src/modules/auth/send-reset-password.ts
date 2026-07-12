import "server-only";

/**
 * Envoi de l'email de réinitialisation de mot de passe.
 *
 * Le package @daromsart/email (Resend + React Email) arrive dans une story
 * ultérieure ; en attendant, on journalise le lien côté serveur pour permettre
 * de tester le flux de bout en bout en développement. À remplacer par l'appel
 * au module email dès qu'il est disponible.
 */
export async function sendResetPasswordEmail(params: {
  email: string;
  url: string;
  token: string;
}): Promise<void> {
  // eslint-disable-next-line no-console
  console.info(
    `[auth] Réinitialisation de mot de passe pour ${params.email} : ${params.url}`,
  );
}
