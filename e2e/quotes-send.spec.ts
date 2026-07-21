import { expect, test } from "@playwright/test";

/**
 * Parcours critique envoi de devis par email (story 10). Nécessite une
 * session authentifiée et le seed de démonstration.
 */
test.describe("Envoi de devis", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Email").fill(process.env.SEED_ADMIN_EMAIL ?? "");
    await page
      .getByLabel("Mot de passe")
      .fill(process.env.SEED_ADMIN_PASSWORD ?? "");
    await page.getByRole("button", { name: "Se connecter" }).click();
    // Premier hit après démarrage du serveur dev : compilation à la volée.
    await expect(page).toHaveURL("/", { timeout: 15_000 });
  });

  test("dialog pré-rempli (email client, sujet avec numéro) → envoyer → timeline « Envoyé par e-mail »", async ({
    page,
  }) => {
    await page.goto("/devis");
    // Un des 2 devis déjà émis du seed : le lien de navigation est sur le nom
    // du client (seed déterministe : "Atelier Lumière SARL" → DEV-2026-0001).
    // Recherche explicite : après de nombreux runs e2e cumulés (chaque run de
    // quotes.spec.ts/sign-quote.spec.ts crée de nouveaux devis "Nova Digital"),
    // la ligne seedée peut sortir de la première page de la liste non filtrée.
    await page.getByPlaceholder("Rechercher un devis…").fill("Atelier");
    await page.getByRole("link", { name: "Atelier Lumière SARL" }).first().click();
    // Première visite de /devis/[id] depuis le démarrage du serveur dev (ou
    // après un edit qui invalide le cache de compilation à la volée) :
    // compilation qui peut dépasser le timeout par défaut de 5 s.
    await expect(page).toHaveURL(/\/devis\/[0-9a-f-]{36}$/, { timeout: 15_000 });

    await page.getByRole("button", { name: /Renvoyer|Envoyer/ }).click();

    const dialog = page.getByRole("dialog", { name: "Envoyer par email" });
    await expect(dialog).toBeVisible();

    const subjectInput = page.locator("#send-dialog-subject");
    await expect(subjectInput).toHaveValue(/DEV-2026-0001/);

    // Le client a déjà un email (seed) pré-rempli comme destinataire ; on en
    // ajoute un second pour vérifier l'ajout de tokens.
    const toInput = dialog.getByLabel("Destinataires");
    await toInput.fill("destinataire-e2e@example.com");
    await toInput.press("Enter");
    await expect(dialog.getByText("destinataire-e2e@example.com")).toBeVisible();

    await page.getByRole("button", { name: "Envoyer", exact: true }).click();
    await expect(page.getByText("Email envoyé.")).toBeVisible();

    // `.first()` : chaque exécution de ce test ajoute un nouvel événement à
    // la timeline du même devis seedé (pas de reset entre les runs e2e).
    await expect(page.getByText("Envoyé par e-mail").first()).toBeVisible();
  });
});
