import path from "node:path";
import { expect, test } from "@playwright/test";

/**
 * Parcours critique de l'outil générique de signature de PDF (story 25) :
 * upload d'un PDF quelconque, choix page/position, signature manuscrite,
 * téléchargement du PDF fusionné. Nécessite une session authentifiée.
 */
test.describe("Outil générique de signature de PDF", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Email").fill(process.env.SEED_ADMIN_EMAIL ?? "");
    await page.getByLabel("Mot de passe").fill(process.env.SEED_ADMIN_PASSWORD ?? "");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL("/", { timeout: 15_000 });
  });

  test("importer un PDF → choisir page/position → signer (canvas) → statut Signé", async ({
    page,
  }) => {
    await page.goto("/signatures");
    await page.locator('input[type="file"]').setInputFiles(
      path.join(__dirname, "fixtures/sample.pdf"),
    );
    await expect(page).toHaveURL(/\/signatures\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    await expect(page.getByText("En attente")).toBeVisible();

    // Page 2, position "Haut droite" — vérifie que le sélecteur de page (2
    // pages dans la fixture) et la table d'ancrage sont bien branchés.
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Page 2" }).click();
    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: "Haut droite" }).click();

    await page.getByLabel("Nom et prénom").fill("Jean Dupont (e2e)");
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas introuvable");
    await page.mouse.move(box.x + 40, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 150, box.y + 40, { steps: 5 });
    await page.mouse.move(box.x + 300, box.y + 130, { steps: 5 });
    await page.mouse.up();

    await page.getByRole("button", { name: "Signer le document" }).click();
    await expect(page.getByText("Document signé.")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Signé", { exact: true })).toBeVisible();
    await expect(page.getByText("Jean Dupont (e2e)")).toBeVisible();

    const pdfResponse = await page.request.get(
      page.url().replace("/signatures/", "/api/signable-documents/") + "/pdf?variant=signed",
    );
    expect(pdfResponse.ok()).toBe(true);
    expect(pdfResponse.headers()["content-type"]).toBe("application/pdf");
  });

  test("refuse un fichier qui n'est pas un PDF", async ({ page }) => {
    await page.goto("/signatures");
    // Un PNG minimal (1x1) : passe le contrôle client "application/pdf"
    // seulement si on force le type — ici on vise directement le contrôle
    // serveur en uploadant un fichier .pdf au contenu non-PDF.
    const buffer = Buffer.from("ceci n'est pas un pdf");
    await page.locator('input[type="file"]').setInputFiles({
      name: "faux.pdf",
      mimeType: "application/pdf",
      buffer,
    });
    await expect(page.getByText(/n'est pas un PDF valide|PDF invalide/)).toBeVisible({
      timeout: 10_000,
    });
  });
});
