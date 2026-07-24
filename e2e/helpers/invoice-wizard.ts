import { expect, type Page } from "@playwright/test";

/**
 * Parcourt le wizard de création de facture (Client → Lignes → Modèle → Vérification)
 * et soumet le brouillon. Prérequis : être déjà sur `/factures/nouvelle`.
 */
export async function completeInvoiceCreateWizard(
  page: Page,
  opts: {
    clientSearch: string;
    clientLabel: string;
    description: string;
    unitPrice?: string;
    /** Hook après sélection du client (ex. modifier l'échéance) avant « Suivant ». */
    afterClientSelect?: (page: Page) => Promise<void>;
  },
) {
  await page.getByRole("combobox").first().click();
  await page.getByPlaceholder("Rechercher un client…").fill(opts.clientSearch);
  await page.getByText(opts.clientLabel).click();
  if (opts.afterClientSelect) {
    await opts.afterClientSelect(page);
  }
  await page.getByRole("button", { name: "Suivant", exact: true }).click();

  await expect(page.getByText("Lignes de facture")).toBeVisible();
  await page.locator("input[placeholder='Description']").first().fill(opts.description);
  if (opts.unitPrice !== undefined) {
    await page.locator("input[placeholder='Prix unitaire']").first().fill(opts.unitPrice);
  }
  await page.getByRole("button", { name: /Suivant/ }).click();

  await expect(page.getByText("Choisir le modèle")).toBeVisible();
  await page.getByRole("button", { name: /Suivant/ }).click();

  await expect(page.getByText("Vérification & création")).toBeVisible();
  await page.getByRole("button", { name: "Créer la facture" }).click();
}
