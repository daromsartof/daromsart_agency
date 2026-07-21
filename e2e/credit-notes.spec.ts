import { expect, test } from "@playwright/test";

/**
 * Parcours critique avoirs (story 18). Une facture FRAÎCHE est créée à
 * chaque run (même raison que `payments.spec.ts` : l'avoir mute l'état de la
 * facture parente, non idempotent d'un run à l'autre sur une facture seedée).
 */
test.describe("Avoirs", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Email").fill(process.env.SEED_ADMIN_EMAIL ?? "");
    await page
      .getByLabel("Mot de passe")
      .fill(process.env.SEED_ADMIN_PASSWORD ?? "");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL("/", { timeout: 15_000 });
  });

  test("facture émise → Créer un avoir → éditeur pré-rempli négatif → émettre → parent affiche la card Avoirs et Annulée", async ({
    page,
  }) => {
    await page.goto("/factures/nouvelle");
    await page.getByRole("combobox").first().click();
    await page.getByPlaceholder("Rechercher un client…").fill("Nova");
    await page.getByText("Nova Digital").click();
    await page
      .locator("input[placeholder='Description']")
      .first()
      .fill("Prestation e2e avoir");
    await page.locator("input[placeholder='Prix unitaire']").first().fill("1000");
    await page.getByRole("button", { name: "Créer la facture" }).click();
    await expect(page).toHaveURL(/\/factures\/.+\/modifier/, { timeout: 15_000 });

    const invoiceId = page.url().match(/\/factures\/([^/]+)\/modifier/)?.[1];
    expect(invoiceId).toBeTruthy();
    await page.goto(`/factures/${invoiceId}`);
    await page.getByRole("button", { name: "Émettre sans envoyer" }).click();
    await expect(page.getByText(/^FAC-\d{4}-\d{4}$/)).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Autres actions" }).click();
    await page.getByRole("menuitem", { name: "Créer un avoir" }).click();
    await expect(page).toHaveURL(/\/factures\/.+\/modifier/, { timeout: 15_000 });

    // Bannière d'avertissement de l'éditeur d'avoir (E-11).
    await expect(page.getByText(/quantités doivent rester négatives/)).toBeVisible();
    // Quantité copiée du parent, négative.
    await expect(page.locator("input[placeholder='Qté']").first()).toHaveValue("-1");

    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Avoir mis à jour.")).toBeVisible();
    await expect(page).toHaveURL(/\/factures\/(?!.*modifier).+$/, { timeout: 15_000 });

    await page.getByRole("button", { name: "Émettre" }).click();
    await expect(page.getByText(/^AV-\d{4}-\d{4}$/)).toBeVisible({ timeout: 15_000 });

    await page.goto(`/factures/${invoiceId}`);
    await expect(page.getByText(/Annulée par l'avoir AV-/)).toBeVisible();
    await expect(page.getByText("Avoirs", { exact: true })).toBeVisible();
    await expect(page.getByText("Total avoiré")).toBeVisible();
  });
});
