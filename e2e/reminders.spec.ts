import { expect, test } from "@playwright/test";

/**
 * Parcours critique relance manuelle (story 16). Nécessite une session
 * authentifiée et le seed de démonstration. Une facture fraîche est créée à
 * chaque run avec une échéance délibérément placée dans le passé (jour 11 du
 * mois courant, toujours antérieur à la date du jour dans cet environnement)
 * pour obtenir un statut "en retard" sans dépendre d'une facture seedée
 * partagée (mêmes raisons qu'en story 15 : la relance mute `last_reminder_at`,
 * la rendant non ré-exécutable à l'identique sur une facture réutilisée).
 */
test.describe("Relance manuelle", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Email").fill(process.env.SEED_ADMIN_EMAIL ?? "");
    await page
      .getByLabel("Mot de passe")
      .fill(process.env.SEED_ADMIN_PASSWORD ?? "");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL("/", { timeout: 15_000 });
  });

  test("facture échue → bouton Relancer visible → relancer → toast + timeline « Relance envoyée »", async ({
    page,
  }) => {
    await page.goto("/factures/nouvelle");
    await page.getByRole("combobox").first().click();
    await page.getByPlaceholder("Rechercher un client…").fill("Nova");
    await page.getByText("Nova Digital").click();
    await page
      .locator("input[placeholder='Description']")
      .first()
      .fill("Prestation e2e relance");
    await page.locator("input[placeholder='Prix unitaire']").first().fill("300");

    // Échéance dans le passé : la valeur par défaut est aujourd'hui + délai de
    // paiement (org, 30 j) — reculer de 2 mois dans le calendrier garantit un
    // mois entièrement passé quelle que soit la date du jour, puis choisir le
    // 1er du mois (toujours antérieur à aujourd'hui dans ce mois-là).
    const dueDateItem = page.getByText("Date d'échéance", { exact: true }).locator("..");
    await dueDateItem.getByRole("button").click();
    const previousMonth = page.getByRole("button", { name: /previous month/i });
    await previousMonth.click();
    await previousMonth.click();
    await page.getByRole("gridcell", { name: "1", exact: true }).first().click();

    await page.getByRole("button", { name: "Créer la facture" }).click();
    await expect(page).toHaveURL(/\/factures\/.+\/modifier/, { timeout: 15_000 });

    const invoiceId = page.url().match(/\/factures\/([^/]+)\/modifier/)?.[1];
    await page.goto(`/factures/${invoiceId}`);
    await page.getByRole("button", { name: "Émettre sans envoyer" }).click();
    await expect(page.getByText(/^FAC-\d{4}-\d{4}$/)).toBeVisible({ timeout: 15_000 });

    const reminderButton = page.getByRole("button", { name: "Relancer" });
    await expect(reminderButton).toBeVisible();
    await reminderButton.click();

    const dialog = page.getByRole("dialog", { name: "Envoyer par email" });
    await expect(dialog).toBeVisible();
    await expect(page.getByText(/En retard de \d+ jours? — reste dû/)).toBeVisible();

    await page.getByRole("button", { name: "Envoyer", exact: true }).click();
    await expect(page.getByText("Email envoyé.")).toBeVisible();
    await expect(page.getByText("Relance envoyée").first()).toBeVisible();
    await expect(page.getByText(/Dernière relance le/)).toBeVisible();
  });
});
