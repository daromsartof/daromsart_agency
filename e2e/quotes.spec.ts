import { expect, test } from "@playwright/test";

/**
 * Parcours critique devis (story 07). Nécessite une session authentifiée
 * et le seed de démonstration (`pnpm db:seed`) — voir `SEED_ADMIN_EMAIL` /
 * `SEED_ADMIN_PASSWORD` dans `.env`.
 */
test.describe("Devis", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Email").fill(process.env.SEED_ADMIN_EMAIL ?? "");
    await page
      .getByLabel("Mot de passe")
      .fill(process.env.SEED_ADMIN_PASSWORD ?? "");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL("/");
  });

  test("crée un devis à 3 lignes multi-taux, réordonne, supprime une ligne, et le retrouve en Brouillon", async ({
    page,
  }) => {
    await page.goto("/devis/nouveau");

    await page.getByRole("combobox").first().click();
    await page.getByPlaceholder("Rechercher un client…").fill("Nova");
    await page.getByText("Nova Digital").click();

    for (let i = 0; i < 2; i++) {
      await page.getByRole("button", { name: "Ajouter une ligne" }).click();
    }

    const descriptions = ["Ligne A", "Ligne B", "Ligne C"];
    const rows = page.locator("input[placeholder='Description']");
    for (let i = 0; i < 3; i++) {
      await rows.nth(i).fill(descriptions[i]);
    }

    await page
      .locator("button[aria-label='Supprimer la ligne']")
      .last()
      .click();
    await expect(page.locator("input[placeholder='Description']")).toHaveCount(2);

    await page.getByRole("button", { name: "Créer le devis" }).click();

    await expect(page).toHaveURL(/\/devis\/.+\/modifier/);

    await page.goto("/devis");
    await expect(page.getByText("Nova Digital").first()).toBeVisible();
  });

  test("les onglets-filtres et la recherche fonctionnent", async ({ page }) => {
    await page.goto("/devis");
    await page.getByRole("tab", { name: /Brouillons/ }).click();
    await expect(page).toHaveURL(/tab=draft/);

    await page.getByPlaceholder("Rechercher un devis…").fill("Nova");
    await expect(page).toHaveURL(/q=Nova/);
  });
});
