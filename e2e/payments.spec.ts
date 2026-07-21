import { expect, test } from "@playwright/test";

/**
 * Parcours critique paiements (story 15). Nécessite une session
 * authentifiée et le seed de démonstration. Une facture FRAÎCHE est créée à
 * chaque run (plutôt que de réutiliser une facture seedée) : le test
 * enregistre des paiements réels qui muteraient l'état d'une facture
 * partagée entre exécutions, la rendant non idempotente d'un run à l'autre.
 */
test.describe("Paiements", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Email").fill(process.env.SEED_ADMIN_EMAIL ?? "");
    await page
      .getByLabel("Mot de passe")
      .fill(process.env.SEED_ADMIN_PASSWORD ?? "");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL("/", { timeout: 15_000 });
  });

  test("enregistrer un paiement partiel puis soldant → Progress bar, badge Payée, toast", async ({
    page,
  }) => {
    await page.goto("/factures/nouvelle");
    await page.getByRole("combobox").first().click();
    await page.getByPlaceholder("Rechercher un client…").fill("Nova");
    await page.getByText("Nova Digital").click();
    await page
      .locator("input[placeholder='Description']")
      .first()
      .fill("Prestation e2e paiement");
    await page.locator("input[placeholder='Prix unitaire']").first().fill("1000");
    await page.getByRole("button", { name: "Créer la facture" }).click();
    await expect(page).toHaveURL(/\/factures\/.+\/modifier/, { timeout: 15_000 });

    const invoiceId = page.url().match(/\/factures\/([^/]+)\/modifier/)?.[1];
    expect(invoiceId).toBeTruthy();
    await page.goto(`/factures/${invoiceId}`);
    await page.getByRole("button", { name: "Émettre sans envoyer" }).click();
    await expect(page.getByText(/^FAC-\d{4}-\d{4}$/)).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText("reste dû sur")).toBeVisible();

    // Paiement partiel (le total TTC vaut 1000 € HT + 20 % TVA = 1200 €).
    await page.getByRole("button", { name: "Enregistrer un paiement" }).click();
    const dialog = page.getByRole("dialog", { name: "Enregistrer un paiement" });
    await expect(dialog).toBeVisible();
    await dialog.locator("#payment-amount").fill("500");
    await dialog.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Paiement enregistré.")).toBeVisible();
    await expect(page.getByText("Partiellement payée", { exact: true }).first()).toBeVisible();

    // Solde le reste dû (le champ montant est pré-rempli avec le reste dû exact).
    await page.getByRole("button", { name: "Enregistrer un paiement" }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Facture soldée.")).toBeVisible();
    await expect(page.getByText("Payée", { exact: true }).first()).toBeVisible();

    // Plus de bouton "Enregistrer un paiement" une fois soldée.
    await expect(page.getByRole("button", { name: "Enregistrer un paiement" })).toHaveCount(0);
  });
});
