import { expect, test, type Page } from "@playwright/test";

/**
 * Parcours critique signature publique de devis (story 11). Nécessite une
 * session authentifiée et le seed de démonstration.
 */
async function login(page: Page) {
  await page.goto("/connexion");
  await page.getByLabel("Email").fill(process.env.SEED_ADMIN_EMAIL ?? "");
  await page.getByLabel("Mot de passe").fill(process.env.SEED_ADMIN_PASSWORD ?? "");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL("/", { timeout: 15_000 });
}

/** Crée un devis frais (brouillon) et l'émet, pour repartir d'un état propre
 * à chaque run (signer/refuser sont des transitions terminales). */
async function createAndIssueQuote(page: Page): Promise<string> {
  await page.goto("/devis/nouveau");
  await page.getByRole("combobox").first().click();
  await page.getByPlaceholder("Rechercher un client…").fill("Nova");
  await page.getByText("Nova Digital").click();
  await page.locator("input[placeholder='Description']").first().fill("Prestation e2e signature");
  await page.getByRole("button", { name: "Créer le devis" }).click();
  await expect(page).toHaveURL(/\/devis\/[0-9a-f-]{36}$/, { timeout: 15_000 });

  const quoteId = page.url().split("/devis/")[1];
  await page.getByRole("button", { name: "Émettre sans envoyer" }).click();
  await expect(page.getByText(/Devis émis/)).toBeVisible();
  return quoteId;
}

async function copyPublicUrl(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Autres actions" }).click();
  await page.getByRole("menuitem", { name: "Copier le lien public" }).click();
  await expect(page.getByText("Lien public copié.")).toBeVisible();
  return page.evaluate(() => navigator.clipboard.readText());
}

async function drawSignature(page: Page) {
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas introuvable");
  await page.mouse.move(box.x + 40, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 150, box.y + 40, { steps: 5 });
  await page.mouse.move(box.x + 300, box.y + 130, { steps: 5 });
  await page.mouse.up();
}

test.describe("Signature publique de devis", () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  });

  test("envoyer → consulter en anonyme → signer (canvas) → badge Signé + card signature en interne", async ({
    page,
    browser,
  }) => {
    await login(page);
    const quoteId = await createAndIssueQuote(page);
    const publicUrl = await copyPublicUrl(page);
    expect(publicUrl).toContain("/p/devis/");

    // Navigateur anonyme distinct (pas de cookie de session).
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    await anonPage.goto(publicUrl);
    await expect(anonPage.getByRole("button", { name: "Signer le devis" })).toBeVisible();

    await anonPage.getByRole("button", { name: "Signer le devis" }).click();
    await anonPage.getByLabel("Nom et prénom").fill("Jean Dupont (e2e)");
    await drawSignature(anonPage);
    // Cocher via le <label> (le texte est un enfant du même label que
    // l'input, cliquer dessus bascule la case comme en HTML natif).
    await anonPage.getByText("Je certifie avoir pris connaissance").click();
    await anonPage.getByRole("button", { name: "Confirmer la signature" }).click();
    await expect(anonPage.getByText("Devis signé.")).toBeVisible({ timeout: 10_000 });
    await anonContext.close();

    await page.goto(`/devis/${quoteId}`);
    await expect(page.getByText("Signé", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Jean Dupont (e2e)")).toBeVisible();
  });

  test("refus avec motif → badge Refusé + motif en timeline", async ({ page, browser }) => {
    await login(page);
    const quoteId = await createAndIssueQuote(page);
    const publicUrl = await copyPublicUrl(page);

    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    await anonPage.goto(publicUrl);

    await anonPage.getByRole("button", { name: "Refuser" }).click();
    await anonPage.getByPlaceholder("Motif du refus (optionnel)").fill("Budget e2e insuffisant");
    await anonPage.getByRole("button", { name: "Confirmer le refus" }).click();
    await expect(anonPage.getByText("Devis refusé.")).toBeVisible({ timeout: 10_000 });
    await anonContext.close();

    await page.goto(`/devis/${quoteId}`);
    await expect(page.getByText("Refusé", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Motif : Budget e2e insuffisant/)).toBeVisible();
  });
});
