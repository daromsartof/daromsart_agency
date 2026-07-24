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
    // Premier hit après démarrage du serveur dev : compilation à la volée.
    await expect(page).toHaveURL("/", { timeout: 15_000 });
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

    // Régression : Radix interdit `<SelectItem value="">` (throw au rendu du
    // popover) — le sentinel dédié (document-form.tsx) doit permettre
    // d'ouvrir et choisir ces menus sans crasher le formulaire.
    await page.getByRole("combobox", { name: "Remise globale" }).click();
    await page.getByRole("option", { name: "Pourcentage" }).click();
    await expect(page.getByRole("combobox", { name: "Remise globale" })).toHaveText(
      "Pourcentage",
    );

    // Slider de modèles : sélection explicite d'une vignette.
    await page.getByRole("button", { name: /Classique/ }).first().click();

    await page.getByRole("button", { name: "Créer le devis" }).click();

    await expect(page).toHaveURL(/\/devis\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    await expect(page.locator('iframe[title="Aperçu PDF du devis"]')).toBeVisible();
    await expect(page.getByRole("link", { name: "Modifier" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Envoyer" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Télécharger" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Archiver" })).toBeVisible();

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
