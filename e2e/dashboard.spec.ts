import { expect, test } from "@playwright/test";

/**
 * Parcours dashboard (story 19 + refonte trésorerie). Lecture seule sur des
 * données seedées : pas de mutation ici.
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

  test("KPIs trésorerie, chart CA, sections commerciales et listes navigables", async ({
    page,
  }) => {
    await expect(page.getByText("Encaissé (mois)")).toBeVisible();
    await expect(page.getByText("Encaissé (année)")).toBeVisible();
    await expect(page.getByText("En attente", { exact: true })).toBeVisible();
    await expect(page.getByText("En retard", { exact: true })).toBeVisible();

    await expect(page.getByText("CA émis vs encaissé")).toBeVisible();
    await expect(page.getByRole("tab", { name: "12 mois" })).toBeVisible();
    await expect(page.locator(".recharts-surface").first()).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText("Indicateurs commerciaux")).toBeVisible();
    await expect(page.getByText("Taux de conversion devis")).toBeVisible();
    await expect(page.getByText("Ancienneté des retards")).toBeVisible();
    await expect(page.getByText("Top clients")).toBeVisible();

    const overdueCard = page.getByText("Factures en retard").locator("..").locator("..");
    const firstOverdueLink = overdueCard
      .locator("a")
      .filter({ hasNotText: "Voir tout" })
      .first();
    if (await firstOverdueLink.count()) {
      await firstOverdueLink.click();
      await expect(page).toHaveURL(/\/factures\/.+/, { timeout: 15_000 });
      await page.goBack();
      await expect(page).toHaveURL("/", { timeout: 15_000 });
    }

    const quotesCard = page.getByText("Derniers devis").locator("..").locator("..");
    const firstQuoteLink = quotesCard
      .locator("a")
      .filter({ hasNotText: "Voir tout" })
      .first();
    if (await firstQuoteLink.count()) {
      await firstQuoteLink.click();
      await expect(page).toHaveURL(/\/devis\/.+/, { timeout: 15_000 });
    }
  });
});
