import { expect, test } from "@playwright/test";

const navEntries = [
  { name: "Dashboard", path: "/" },
  { name: "Clients", path: "/clients" },
  { name: "Devis", path: "/devis" },
  { name: "Factures", path: "/factures" },
  { name: "Modèles", path: "/modeles" },
  { name: "Paramètres", path: "/parametres" },
];

test.beforeEach(async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel("Email").fill(process.env.SEED_ADMIN_EMAIL ?? "");
  await page
    .getByLabel("Mot de passe")
    .fill(process.env.SEED_ADMIN_PASSWORD ?? "");
  await page.getByRole("button", { name: "Se connecter" }).click();
  // Premier hit après démarrage du serveur dev : compilation à la volée des
  // routes (auth + page d'accueil), plus lente qu'un timeout par défaut.
  await expect(page).toHaveURL("/", { timeout: 15_000 });
});

test("la navigation affiche les 6 entrées et chaque page répond", async ({
  page,
}) => {
  await page.goto("/");

  for (const entry of navEntries) {
    const link = page
      .getByRole("link", { name: entry.name, exact: true })
      .first();
    await expect(link).toBeVisible();
  }

  for (const entry of navEntries) {
    const response = await page.goto(entry.path);
    expect(response?.status()).toBeLessThan(400);
  }
});

test("le basculement en thème sombre persiste après rechargement", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("button", { name: "Basculer le thème clair/sombre" })
    .click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
});
