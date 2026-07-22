import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

const EMAILS_DIR = path.join(__dirname, "..", "apps", "invoiceflow-ai", ".storage", "emails");

async function readLatestEmailHtmlFor(emailAddress: string): Promise<string> {
  const safe = emailAddress.replace(/[^a-z0-9@.]/gi, "_");
  const files = (await readdir(EMAILS_DIR)).filter((f) => f.includes(safe));
  files.sort();
  const latest = files[files.length - 1];
  return readFile(path.join(EMAILS_DIR, latest), "utf8");
}

/**
 * Équipe : invitation → email dev (fichier) → acceptation → connexion
 * automatique (story 21). Email de test unique par run pour ne jamais
 * confondre avec un fichier laissé par un run précédent.
 */
test.describe("Équipe — invitations", () => {
  test("admin invite → email dev → ouvrir le lien → créer le compte → dashboard connecté ; le membre ne voit pas Paramètres", async ({
    page,
    browser,
  }) => {
    await page.goto("/connexion");
    await page.getByLabel("Email").fill(process.env.SEED_ADMIN_EMAIL ?? "");
    await page
      .getByLabel("Mot de passe")
      .fill(process.env.SEED_ADMIN_PASSWORD ?? "");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL("/", { timeout: 15_000 });

    const inviteEmail = `e2e-team-${Date.now()}@example.com`;

    await page.goto("/parametres/equipe");
    await page.getByRole("button", { name: "Inviter un membre" }).click();
    await page.getByLabel("Email").fill(inviteEmail);
    await page.getByRole("button", { name: "Envoyer l'invitation" }).click();
    await expect(page.getByText(`Invitation envoyée à ${inviteEmail}.`)).toBeVisible({
      timeout: 10_000,
    });

    const html = await readLatestEmailHtmlFor(inviteEmail);
    const match = html.match(/http:\/\/localhost:3000\/invitation\/[a-f0-9]+/);
    expect(match).not.toBeNull();
    const inviteUrl = match![0];

    // Contexte anonyme distinct : ne partage jamais le cookie de session admin.
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    await anonPage.goto(inviteUrl);
    await expect(anonPage.getByText(/Rejoindre/)).toBeVisible();

    await anonPage.getByLabel("Nom").fill("Membre E2E");
    await anonPage.getByLabel("Mot de passe", { exact: true }).fill("MembrePassw0rd!");
    await anonPage.getByLabel("Confirmer le mot de passe").fill("MembrePassw0rd!");
    await anonPage.getByRole("button", { name: "Créer mon compte" }).click();

    await expect(anonPage).toHaveURL("http://localhost:3000/", { timeout: 15_000 });
    await expect(anonPage.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // Le membre n'a pas accès à Paramètres (garde admin-only du layout).
    await anonPage.goto("/parametres/equipe");
    await expect(anonPage).toHaveURL("http://localhost:3000/", { timeout: 15_000 });

    await anonContext.close();

    // L'admin retrouve bien le nouveau membre dans la liste (email unique par run).
    await page.goto("/parametres/equipe");
    const memberRow = page.getByRole("row").filter({ hasText: inviteEmail });
    await expect(memberRow).toBeVisible();
    await expect(memberRow.getByText("Membre E2E")).toBeVisible();
  });
});
