import { expect, test, type Page } from "@playwright/test";

/**
 * Parcours critique conversion devis → facture (story 17). Nécessite une
 * session authentifiée et le seed de démonstration. Réutilise le pattern de
 * signature de `sign-quote.spec.ts` (story 11) pour obtenir un devis
 * réellement signé avant de le convertir.
 */
async function login(page: Page) {
  await page.goto("/connexion");
  await page.getByLabel("Email").fill(process.env.SEED_ADMIN_EMAIL ?? "");
  await page.getByLabel("Mot de passe").fill(process.env.SEED_ADMIN_PASSWORD ?? "");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL("/", { timeout: 15_000 });
}

async function createAndIssueQuote(page: Page): Promise<string> {
  await page.goto("/devis/nouveau");
  await page.getByRole("combobox").first().click();
  await page.getByPlaceholder("Rechercher un client…").fill("Nova");
  await page.getByText("Nova Digital").click();
  await page
    .locator("input[placeholder='Description']")
    .first()
    .fill("Prestation e2e conversion");
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

async function signQuoteAnonymously(browser: import("@playwright/test").Browser, publicUrl: string) {
  const anonContext = await browser.newContext();
  const anonPage = await anonContext.newPage();
  await anonPage.goto(publicUrl);
  await anonPage.getByRole("button", { name: "Signer le devis" }).click();
  await anonPage.getByLabel("Nom et prénom").fill("Jean Dupont (e2e conversion)");
  await drawSignature(anonPage);
  await anonPage.getByText("Je certifie avoir pris connaissance").click();
  await anonPage.getByRole("button", { name: "Confirmer la signature" }).click();
  await expect(anonPage.getByText("Devis signé.")).toBeVisible({ timeout: 10_000 });
  await anonContext.close();
}

test.describe("Conversion devis → facture", () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  });

  test("devis signé → Convertir → éditeur pré-rempli → Émettre → devis badge Facturé + lien facture", async ({
    page,
    browser,
  }) => {
    await login(page);
    const quoteId = await createAndIssueQuote(page);
    const publicUrl = await copyPublicUrl(page);
    await signQuoteAnonymously(browser, publicUrl);

    await page.goto(`/devis/${quoteId}`);
    await expect(page.getByText("Signé", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "Convertir en facture" }).click();
    await expect(page.getByText("Devis converti en facture.")).toBeVisible();
    await expect(page).toHaveURL(/\/factures\/[0-9a-f-]{36}\/modifier$/, { timeout: 15_000 });

    // Éditeur pré-rempli : la ligne du devis d'origine est bien reprise.
    await expect(page.locator("input[placeholder='Description']").first()).toHaveValue(
      "Prestation e2e conversion",
    );
    await expect(page.getByText(/Créée depuis le devis DEV-/)).toBeVisible();

    const invoiceId = page.url().match(/\/factures\/([^/]+)\/modifier/)?.[1];
    await page.goto(`/factures/${invoiceId}`);
    await page.getByRole("button", { name: "Émettre sans envoyer" }).click();
    await expect(page.getByText(/^FAC-\d{4}-\d{4}$/)).toBeVisible({ timeout: 15_000 });

    await page.goto(`/devis/${quoteId}`);
    await expect(page.getByText("Facturé", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/^FAC-\d{4}-\d{4}$/).first()).toBeVisible();
  });
});
