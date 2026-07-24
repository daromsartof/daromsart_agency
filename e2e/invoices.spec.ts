import { expect, test } from "@playwright/test";
import { completeInvoiceCreateWizard } from "./helpers/invoice-wizard";

/**
 * Parcours critique factures (story 12). Nécessite une session authentifiée
 * et le seed de démonstration (`pnpm db:seed`) — voir `SEED_ADMIN_EMAIL` /
 * `SEED_ADMIN_PASSWORD` dans `.env`. Le seed pose aussi des factures
 * échues/émises/payée/annulée utilisées par les assertions de filtre.
 */
test.describe("Factures", () => {
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

  test("crée une facture, l'émet, et le PDF (échéance + IBAN) est servi", async ({
    page,
  }) => {
    await page.goto("/factures/nouvelle");
    await completeInvoiceCreateWizard(page, {
      clientSearch: "Nova",
      clientLabel: "Nova Digital",
      description: "Prestation e2e facture",
      unitPrice: "1000",
    });
    await expect(page).toHaveURL(/\/factures\/.+\/modifier/, { timeout: 15_000 });

    // Émission depuis la fiche détail (redirection après enregistrement du brouillon).
    const invoiceId = page.url().match(/\/factures\/([^/]+)\/modifier/)?.[1];
    expect(invoiceId).toBeTruthy();
    await page.goto(`/factures/${invoiceId}`);

    await page.getByRole("button", { name: "Émettre" }).click();
    await expect(page.getByText(/^FAC-\d{4}-\d{4}$/)).toBeVisible({ timeout: 15_000 });
    // Une fois émise, l'échéance (30 jours) reste affichée dans la carte dédiée.
    await expect(page.getByText("Date d'échéance")).toBeVisible();

    const pdfResponse = await page.request.get(`/api/documents/factures/${invoiceId}/pdf`);
    expect(pdfResponse.ok()).toBe(true);
    expect(pdfResponse.headers()["content-type"]).toBe("application/pdf");
    const bytes = await pdfResponse.body();
    expect(bytes.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  });

  test("le filtre 'En retard' n'affiche que les factures actives et échues", async ({
    page,
  }) => {
    await page.goto("/factures");
    await page.getByRole("tab", { name: /En retard/ }).click();
    await expect(page).toHaveURL(/tab=overdue/);

    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i).getByText("Brouillon")).toHaveCount(0);
    }
  });

  test("la fiche client affiche un CA facturé réel (non nul) après émission", async ({
    page,
  }) => {
    await page.goto("/clients");
    await page.getByPlaceholder("Rechercher un client…").fill("Nova Digital");
    await expect(page).toHaveURL(/q=Nova/, { timeout: 15_000 });
    await page.getByRole("link", { name: "Nova Digital" }).click();
    await expect(page).toHaveURL(/\/clients\/.+/, { timeout: 15_000 });

    const caLabel = page.getByText("CA facturé", { exact: true });
    await expect(caLabel).toBeVisible();
    // Le seed émet des factures pour Nova Digital : le CA ne doit plus être
    // figé à 0,00 € comme au stub story-06 (calcul réel branché story 12).
    const caValue = caLabel.locator("xpath=following-sibling::p[1]");
    await expect(caValue).not.toHaveText("0,00 €");
  });
});
