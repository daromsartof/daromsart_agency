import { expect, test } from "@playwright/test";

const navEntries = [
  { name: "Dashboard", path: "/" },
  { name: "Clients", path: "/clients" },
  { name: "Devis", path: "/devis" },
  { name: "Factures", path: "/factures" },
  { name: "Modèles", path: "/modeles" },
  { name: "Paramètres", path: "/parametres" },
];

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
