import { expect, test, type Page } from "@playwright/test";
import { completeInvoiceCreateWizard } from "./helpers/invoice-wizard";

/**
 * Parcours critique signature publique de facture (story 24, miroir de
 * sign-quote.spec.ts). Nécessite une session authentifiée et le seed de
 * démonstration.
 */
async function login(page: Page) {
  await page.goto("/connexion");
  await page.getByLabel("Email").fill(process.env.SEED_ADMIN_EMAIL ?? "");
  await page.getByLabel("Mot de passe").fill(process.env.SEED_ADMIN_PASSWORD ?? "");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL("/", { timeout: 15_000 });
}

/** Crée une facture fraîche (brouillon) et l'émet, pour repartir d'un état
 * propre à chaque run (signer est une action terminale par facture). */
async function createAndIssueInvoice(page: Page): Promise<string> {
  await page.goto("/factures/nouvelle");
  await completeInvoiceCreateWizard(page, {
    clientSearch: "Nova",
    clientLabel: "Nova Digital",
    description: "Prestation e2e signature facture",
    unitPrice: "1000",
  });
  const invoiceId = page.url().split("/factures/")[1];

  await page.getByRole("button", { name: "Émettre sans envoyer" }).click();
  await expect(page.getByText(/^FAC-\d{4}-\d{4}$/)).toBeVisible({ timeout: 15_000 });
  return invoiceId;
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

test.describe("Signature publique de facture", () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  });

  test("émettre → consulter en anonyme → signer (canvas) → badge Signée + card signature en interne", async ({
    page,
    browser,
  }) => {
    await login(page);
    const invoiceId = await createAndIssueInvoice(page);
    const publicUrl = await copyPublicUrl(page);
    expect(publicUrl).toContain("/p/factures/");

    // Navigateur anonyme distinct (pas de cookie de session).
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    await anonPage.goto(publicUrl);
    await expect(anonPage.getByRole("button", { name: "Signer la facture" })).toBeVisible();

    await anonPage.getByRole("button", { name: "Signer la facture" }).click();
    await anonPage.getByLabel("Nom et prénom").fill("Jean Dupont (e2e)");
    await drawSignature(anonPage);
    await anonPage.getByText("Je certifie avoir pris connaissance").click();
    await anonPage.getByRole("button", { name: "Confirmer la signature" }).click();
    await expect(anonPage.getByText("Facture signée.")).toBeVisible({ timeout: 10_000 });
    // La facture reste payable même une fois signée — pas de bouton de
    // signature résiduel, mais le badge "Signée" apparaît.
    await expect(anonPage.getByText("Signée", { exact: true })).toBeVisible();
    await anonContext.close();

    await page.goto(`/factures/${invoiceId}`);
    await expect(page.getByText("Signature", { exact: true })).toBeVisible();
    await expect(page.getByText("Jean Dupont (e2e)")).toBeVisible();
  });
});
