import { expect, test } from "@playwright/test";

/**
 * Parcours critique envoi de facture par email + page publique (story 14).
 * Nécessite une session authentifiée et le seed de démonstration.
 */
test.describe("Envoi de facture", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/connexion");
    await page.getByLabel("Email").fill(process.env.SEED_ADMIN_EMAIL ?? "");
    await page
      .getByLabel("Mot de passe")
      .fill(process.env.SEED_ADMIN_PASSWORD ?? "");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL("/", { timeout: 15_000 });
  });

  test("créer une facture → l'envoyer → timeline « Envoyé par e-mail » → page publique anonyme", async ({
    page,
    browser,
  }) => {
    await page.goto("/factures/nouvelle");
    await page.getByRole("combobox").first().click();
    await page.getByPlaceholder("Rechercher un client…").fill("Nova");
    await page.getByText("Nova Digital").click();
    await page
      .locator("input[placeholder='Description']")
      .first()
      .fill("Prestation envoi e2e");
    await page.locator("input[placeholder='Prix unitaire']").first().fill("500");
    await page.getByRole("button", { name: "Créer la facture" }).click();
    await expect(page).toHaveURL(/\/factures\/.+\/modifier/, { timeout: 15_000 });

    const invoiceId = page.url().match(/\/factures\/([^/]+)\/modifier/)?.[1];
    await page.goto(`/factures/${invoiceId}`);
    await expect(page).toHaveURL(/\/factures\/[0-9a-f-]{36}$/, { timeout: 15_000 });

    await page.getByRole("button", { name: /Renvoyer|Envoyer/ }).click();
    const dialog = page.getByRole("dialog", { name: "Envoyer par email" });
    await expect(dialog).toBeVisible();
    await expect(page.getByText("sera émis (numéro attribué) avant l'envoi")).toBeVisible();

    const toInput = dialog.getByLabel("Destinataires");
    await toInput.fill("destinataire-facture-e2e@example.com");
    await toInput.press("Enter");

    await page.getByRole("button", { name: "Envoyer", exact: true }).click();
    await expect(page.getByText("Email envoyé.")).toBeVisible();
    await expect(page.getByText("Envoyé par e-mail").first()).toBeVisible();
    await expect(page.getByText(/^FAC-\d{4}-\d{4}$/)).toBeVisible();

    // Lien public copié via le menu "Autres actions", consulté depuis un
    // contexte navigateur distinct (pas de cookie de session — anonyme réel).
    await page.getByRole("button", { name: "Autres actions" }).click();
    await page.getByRole("menuitem", { name: "Copier le lien public" }).click();
    await expect(page.getByText("Lien public copié.")).toBeVisible();
    const publicUrl = await page.evaluate(() => navigator.clipboard.readText());
    expect(publicUrl).toContain("/p/factures/");

    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    await anonPage.goto(publicUrl);
    await expect(anonPage.getByRole("heading", { name: /Facture FAC-/ })).toBeVisible({
      timeout: 15_000,
    });
    await expect(anonPage.getByText("Reste dû")).toBeVisible();
    await expect(anonPage.getByText("Régler par virement")).toBeVisible();
    await expect(anonPage.locator("iframe[title='Facture']")).toHaveAttribute("src", /.+/);
    await anonContext.close();

    // Interne : le statut passe à "Vu" après consultation publique (sent→viewed, H15).
    await page.goto(`/factures/${invoiceId}`);
    await expect(page.getByText("Vu", { exact: true }).first()).toBeVisible();
  });
});
