import { expect, test } from "@playwright/test";

test.describe("Générateur QR", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Email").fill(process.env.SEED_ADMIN_EMAIL ?? "");
    await page
      .getByLabel("Mot de passe")
      .fill(process.env.SEED_ADMIN_PASSWORD ?? "");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL("/", { timeout: 15_000 });
  });

  test("liste → nouveau → wizard → sauvegarde → détail PNG", async ({ page }) => {
    await page.goto("/qrcode");
    await expect(page.getByRole("heading", { name: "QR Code" })).toBeVisible();

    await page.getByRole("link", { name: /Nouveau QR/ }).first().click();
    await expect(page).toHaveURL(/\/qrcode\/nouveau/);
    await expect(page.getByText("Quel type de QR code ?")).toBeVisible();

    await page.getByRole("button", { name: /Site web/ }).click();
    await page.getByRole("button", { name: "Suivant" }).click();

    await expect(page.getByText("Renseignez le contenu")).toBeVisible();
    await page.getByLabel("URL du site").fill("https://daromsart.fr");
    await page.getByRole("button", { name: "Suivant" }).click();

    await expect(page.getByText("Personnalisez le design")).toBeVisible();
    await expect(page.getByTestId("qr-preview").locator("canvas")).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "Sauvegarder" }).first().click();
    await page.getByLabel("Nom").fill(`E2E QR ${Date.now()}`);
    await page.getByRole("button", { name: "Sauvegarder" }).last().click();

    await expect(page).toHaveURL(/\/qrcode\/.+/, { timeout: 15_000 });
    await expect(page.getByText("Aperçu")).toBeVisible();

    const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });
    await page.getByTestId("qr-download-png").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.png$/i);
  });
});
