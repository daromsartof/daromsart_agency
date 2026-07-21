import { expect, test } from "@playwright/test";

/**
 * Parcours dashboard (story 19). Lecture seule sur des données seedées : pas
 * de mutation ici (contrairement à `payments.spec.ts`/`credit-notes.spec.ts`),
 * donc pas besoin de créer un document frais à chaque run.
 */
test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Email").fill(process.env.SEED_ADMIN_EMAIL ?? "");
    await page
      .getByLabel("Mot de passe")
      .fill(process.env.SEED_ADMIN_PASSWORD ?? "");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL("/", { timeout: 15_000 });
  });

  test("4 StatCards renseignées, chart rendu, les listes naviguent vers leurs documents", async ({
    page,
  }) => {
    await expect(page.getByText("Encaissé (année)")).toBeVisible();
    await expect(page.getByText("En attente", { exact: true })).toBeVisible();
    await expect(page.getByText("En retard", { exact: true })).toBeVisible();
    await expect(page.getByText("Devis en cours")).toBeVisible();

    await expect(page.getByText("Chiffre d'affaires (12 derniers mois)")).toBeVisible();
    // Recharts a le temps de mesurer son conteneur (ResponsiveContainer) et
    // de peindre le SVG — attendre la surface plutôt qu'un groupe `<g>` interne.
    await expect(page.locator(".recharts-surface").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".recharts-bar-rectangle").first()).toBeVisible({ timeout: 15_000 });

    const overdueCard = page.getByText("Factures en retard").locator("..").locator("..");
    const firstOverdueLink = overdueCard.locator("a").first();
    if (await firstOverdueLink.count()) {
      await firstOverdueLink.click();
      await expect(page).toHaveURL(/\/factures\/.+/, { timeout: 15_000 });
      await page.goBack();
      await expect(page).toHaveURL("/", { timeout: 15_000 });
    }

    const quotesCard = page.getByText("Derniers devis").locator("..").locator("..");
    const firstQuoteLink = quotesCard.locator("a").first();
    if (await firstQuoteLink.count()) {
      await firstQuoteLink.click();
      await expect(page).toHaveURL(/\/devis\/.+/, { timeout: 15_000 });
    }
  });
});
