import { expect, test } from "@playwright/test";

/**
 * Parcours critique modèles de documents (story 09). Nécessite une session
 * authentifiée et le seed de démonstration (`pnpm db:seed`, 2 modèles :
 * "Classique" par défaut + "Moderne").
 */
test.describe("Modèles", () => {
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

  test("la liste affiche les modèles seedés avec le badge Défaut", async ({ page }) => {
    await page.goto("/modeles");
    await expect(page.getByText("Classique")).toBeVisible();
    await expect(page.getByText("Moderne")).toBeVisible();
    await expect(page.getByText("Défaut")).toBeVisible();
  });

  test("créer un modèle, changer la couleur d'accent met à jour l'aperçu, définir par défaut", async ({
    page,
  }) => {
    await page.goto("/modeles/nouveau");

    await page.getByLabel("Nom du modèle").fill("Modèle e2e");

    const iframe = page.locator("iframe[title='Aperçu du modèle']");
    await expect(iframe).toHaveAttribute("src", /.+/);
    const initialSrc = await iframe.getAttribute("src");

    await page.locator("input[type='color']").fill("#00ff00");

    // Le débounce de l'aperçu est de 500 ms (plans/story-09.md).
    await expect
      .poll(async () => iframe.getAttribute("src"), { timeout: 3000 })
      .not.toBe(initialSrc);

    await page.getByRole("button", { name: "Créer le modèle" }).click();
    // UUID explicite : `/\/modeles\/.+/` matcherait aussi `/modeles/nouveau`.
    await expect(page).toHaveURL(/\/modeles\/[0-9a-f-]{36}$/);
    const templateId = page.url().split("/modeles/")[1];

    await page.goto("/modeles");
    const card = page.getByTestId(`template-card-${templateId}`);
    await card.getByRole("button", { name: "Actions" }).click();
    await page.getByRole("menuitem", { name: "Définir par défaut" }).click();
    await expect(page.getByText("défini par défaut")).toBeVisible();

    await page.goto("/devis/nouveau");
    await expect(page.getByRole("combobox", { name: "Modèle" })).toContainText(
      "Modèle e2e",
    );
  });
});
