import { expect, test } from "@playwright/test";

/**
 * Parcours critique QR codes (story 13). Nécessite une session authentifiée
 * et le seed de démonstration. Vérifie que les interrupteurs du modèle
 * (`QR de paiement`, `QR du lien public`) changent bien le rendu de
 * l'aperçu — la validation caractère-par-caractère du payload EPC et le
 * rendu PNG sont couverts par les tests unitaires `@daromsart/qr`.
 */
test.describe("QR codes (modèles)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Email").fill(process.env.SEED_ADMIN_EMAIL ?? "");
    await page
      .getByLabel("Mot de passe")
      .fill(process.env.SEED_ADMIN_PASSWORD ?? "");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL("/", { timeout: 15_000 });
  });

  test("activer les interrupteurs QR met à jour l'aperçu du modèle", async ({ page }) => {
    await page.goto("/modeles/nouveau");
    await page.getByLabel("Nom du modèle").fill("Modèle e2e QR");

    const iframe = page.locator("iframe[title='Aperçu du modèle']");
    await expect(iframe).toHaveAttribute("src", /.+/);
    const beforeSrc = await iframe.getAttribute("src");

    await page.getByRole("switch", { name: "QR de paiement (IBAN)" }).click();
    await expect
      .poll(async () => iframe.getAttribute("src"), { timeout: 3000 })
      .not.toBe(beforeSrc);
    const afterPaymentSrc = await iframe.getAttribute("src");

    await page.getByRole("switch", { name: "QR du lien public" }).click();
    await expect
      .poll(async () => iframe.getAttribute("src"), { timeout: 3000 })
      .not.toBe(afterPaymentSrc);
  });
});
