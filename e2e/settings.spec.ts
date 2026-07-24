import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

/**
 * Paramètres — facturation, emails, mon compte (story 22). Chaque sous-test
 * relit les valeurs initiales depuis les champs avant de les modifier, puis
 * les restaure à l'identique en fin de test : ces réglages sont partagés par
 * toute la suite e2e (ex. FAC-{YYYY}-{seq:4} attendu par emails.spec.ts).
 */
test.describe("Paramètres — facturation, emails, mon compte", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Email").fill(process.env.SEED_ADMIN_EMAIL ?? "");
    await page
      .getByLabel("Mot de passe")
      .fill(process.env.SEED_ADMIN_PASSWORD ?? "");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL("/", { timeout: 15_000 });
  });

  test("Facturation — numérotation, TVA, délais (round-trip)", async ({ page }) => {
    await page.goto("/parametres/facturation");
    await expect(page.getByText("Numérotation", { exact: true })).toBeVisible();

    const quoteInput = page.locator("#format-quote");
    const originalQuoteFormat = await quoteInput.inputValue();

    // Format invalide → message d'erreur client, pas d'aperçu.
    await quoteInput.fill("N'IMPORTE QUOI");
    await expect(page.getByText("Format invalide")).toBeVisible();

    // Format valide → aperçu du prochain numéro (scope au champ Devis : les 3
    // champs de numérotation affichent tous un aperçu "Prochain numéro :").
    await quoteInput.fill("DEV-{YYYY}-{seq:4}");
    await expect(quoteInput.locator("..").getByText("Prochain numéro :")).toBeVisible();
    await page.getByRole("button", { name: "Enregistrer" }).first().click();
    await expect(page.getByText("Formats de numérotation mis à jour.")).toBeVisible({ timeout: 10_000 });

    // TVA : franchise en base force le taux par défaut à 0 % et désactive le select.
    const defaultRateTrigger = page.locator("#default-rate");
    await expect(defaultRateTrigger).toHaveText(/20 %/);
    await page.getByRole("switch").last().click(); // dernier switch de la card TVA = franchise
    await expect(defaultRateTrigger).toBeDisabled();
    await expect(defaultRateTrigger).toHaveText(/0 %/);
    await page.getByRole("button", { name: "Enregistrer" }).nth(1).click();
    await expect(page.getByText("Paramètres de TVA mis à jour.")).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await expect(page.locator("#default-rate")).toBeDisabled();

    // Restauration : franchise off. Le reload a persisté defaultRate=0 en base
    // (franchise force 0 % à l'enregistrement) donc le select repart de 0 % —
    // il faut resélectionner 20 % explicitement.
    await page.getByRole("switch").last().click();
    await expect(defaultRateTrigger).not.toBeDisabled();
    await defaultRateTrigger.click();
    await page.getByRole("option", { name: "20 %" }).click();
    await expect(defaultRateTrigger).toHaveText(/20 %/);
    await page.getByRole("button", { name: "Enregistrer" }).nth(1).click();
    await expect(page.getByText("Paramètres de TVA mis à jour.")).toBeVisible({ timeout: 10_000 });

    // Délais par défaut.
    const paymentInput = page.locator("#paymentTermsDays");
    const validityInput = page.locator("#quoteValidityDays");
    const originalPayment = await paymentInput.inputValue();
    const originalValidity = await validityInput.inputValue();
    await paymentInput.fill("45");
    await validityInput.fill("60");
    await page.getByRole("button", { name: "Enregistrer" }).nth(2).click();
    await expect(page.getByText("Délais par défaut mis à jour.")).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await expect(page.locator("#paymentTermsDays")).toHaveValue("45");
    await expect(page.locator("#quoteValidityDays")).toHaveValue("60");

    // Restauration finale : formats et délais.
    await page.locator("#format-quote").fill(originalQuoteFormat);
    await page.getByRole("button", { name: "Enregistrer" }).first().click();
    await expect(page.getByText("Formats de numérotation mis à jour.")).toBeVisible({ timeout: 10_000 });

    await page.locator("#paymentTermsDays").fill(originalPayment);
    await page.locator("#quoteValidityDays").fill(originalValidity);
    await page.getByRole("button", { name: "Enregistrer" }).nth(2).click();
    await expect(page.getByText("Délais par défaut mis à jour.")).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await expect(page.locator("#format-quote")).toHaveValue(originalQuoteFormat);
    await expect(page.locator("#default-rate")).toHaveText(/20 %/);
    await expect(page.locator("#default-rate")).not.toBeDisabled();
    await expect(page.locator("#paymentTermsDays")).toHaveValue(originalPayment);
    await expect(page.locator("#quoteValidityDays")).toHaveValue(originalValidity);
  });

  test("Emails — reply-to, textes de templates, aperçu, réinitialisation", async ({ page }) => {
    await page.goto("/parametres/emails");
    await expect(page.getByText("Réponse", { exact: true })).toBeVisible();

    const replyToInput = page.locator("#reply-to");
    const originalReplyTo = await replyToInput.inputValue();
    const subjectInput = page.locator("#invoice-subject");
    const originalSubject = await subjectInput.inputValue();

    await replyToInput.fill("contact@exemple.fr");
    await subjectInput.fill("Objet e2e temporaire");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Textes d'emails mis à jour.")).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await expect(page.locator("#reply-to")).toHaveValue("contact@exemple.fr");
    await expect(page.locator("#invoice-subject")).toHaveValue("Objet e2e temporaire");

    // Aperçu : les variables sont substituées.
    const invoiceCard = page.locator("text=Envoi de facture").locator("..").locator("..");
    await invoiceCard.getByRole("button", { name: "Voir l'aperçu" }).click();
    await expect(page.getByText(/Nova Digital/)).toBeVisible();

    // Réinitialisation au défaut restaure le sujet sans passer par le formulaire.
    await invoiceCard.getByRole("button", { name: "Réinitialiser au défaut" }).click();
    await expect(page.getByText("Texte réinitialisé au défaut.")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("#invoice-subject")).not.toHaveValue("Objet e2e temporaire");

    // Restauration : reply-to et sujet d'origine.
    await page.locator("#reply-to").fill(originalReplyTo);
    await page.locator("#invoice-subject").fill(originalSubject);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Textes d'emails mis à jour.")).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await expect(page.locator("#reply-to")).toHaveValue(originalReplyTo);
    await expect(page.locator("#invoice-subject")).toHaveValue(originalSubject);
  });

  test("Mon compte — nom, apparence, formulaire mot de passe (sans soumission)", async ({ page }) => {
    await page.goto("/parametres/compte");
    await expect(page.getByText("Profil", { exact: true })).toBeVisible();

    const nameInput = page.locator("#account-name");
    const originalName = await nameInput.inputValue();
    await nameInput.fill(`${originalName} (e2e)`);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Nom mis à jour.")).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await expect(page.locator("#account-name")).toHaveValue(`${originalName} (e2e)`);
    await page.locator("#account-name").fill(originalName);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Nom mis à jour.")).toBeVisible({ timeout: 10_000 });

    // Apparence : sélectionner "Sombre" applique la classe et persiste (next-themes/localStorage).
    await page.getByRole("radio", { name: "Sombre" }).click();
    await expect(page.getByRole("radio", { name: "Sombre" })).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByRole("radio", { name: "Système" }).click();

    // Mot de passe : validation client uniquement, aucune soumission réelle
    // (changer le mot de passe admin casserait toute la suite e2e).
    await page.locator("#current-password").fill("mauvais-mot-de-passe");
    await page.locator("#new-password").fill("short");
    await page.locator("#confirm-password").fill("short");
    await page.getByRole("button", { name: "Changer le mot de passe" }).click();
    await expect(
      page.getByText("Le nouveau mot de passe doit contenir au moins 8 caractères."),
    ).toBeVisible();
  });

  test("Nav rôle : un membre ne voit/n'accède qu'à Mon compte", async ({ page, browser }) => {
    const inviteEmail = `e2e-settings-${Date.now()}@example.com`;
    await page.goto("/parametres/equipe");
    await page.getByRole("button", { name: "Inviter un membre" }).click();
    await page.getByLabel("Email").fill(inviteEmail);
    await page.getByRole("button", { name: "Envoyer l'invitation" }).click();
    await expect(page.getByText(`Invitation envoyée à ${inviteEmail}.`)).toBeVisible({
      timeout: 10_000,
    });

    const emailsDir = path.join(__dirname, "..", "apps", "invoiceflow-ai", ".storage", "emails");
    const safe = inviteEmail.replace(/[^a-z0-9@.]/gi, "_");
    const files = (await readdir(emailsDir)).filter((f) => f.includes(safe)).sort();
    const html = await readFile(path.join(emailsDir, files[files.length - 1]), "utf8");
    const inviteUrl = html.match(/http:\/\/localhost:3000\/invitation\/[a-f0-9]+/)?.[0];
    expect(inviteUrl).toBeTruthy();

    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    await anonPage.goto(inviteUrl!);
    await anonPage.getByLabel("Nom").fill("Membre Settings E2E");
    await anonPage.getByLabel("Mot de passe", { exact: true }).fill("MembrePassw0rd!");
    await anonPage.getByLabel("Confirmer le mot de passe").fill("MembrePassw0rd!");
    await anonPage.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(anonPage).toHaveURL("http://localhost:3000/", { timeout: 15_000 });

    await anonPage.goto("/parametres/compte");
    await expect(anonPage).toHaveURL(/\/parametres\/compte/);
    await expect(anonPage.getByText("Profil", { exact: true })).toBeVisible();
    await expect(anonPage.getByRole("link", { name: "Facturation" })).toHaveCount(0);
    await expect(anonPage.getByRole("link", { name: "Emails" })).toHaveCount(0);

    for (const route of ["/parametres/facturation", "/parametres/emails", "/parametres/equipe"]) {
      await anonPage.goto(route);
      await expect(anonPage).toHaveURL("http://localhost:3000/", { timeout: 15_000 });
    }

    await anonContext.close();
  });
});
