import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { completeInvoiceCreateWizard } from "./helpers/invoice-wizard";

/**
 * Onglet Emails + bannière bounce (story 20). Le webhook Resend lui-même est
 * déjà testé à fond en intégration avec de vraies signatures svix
 * (`webhook.integration.test.ts`) ; ici on vérifie le RENDU de la card
 * "Emails" du détail facture à partir de fixtures insérées directement en
 * base (mêmes états qu'un vrai webhook aurait produits) — un vrai appel
 * Resend n'est pas simulable dans ce test.
 */
test.describe("Emails — historique et bannière bounce", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Email").fill(process.env.SEED_ADMIN_EMAIL ?? "");
    await page
      .getByLabel("Mot de passe")
      .fill(process.env.SEED_ADMIN_PASSWORD ?? "");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL("/", { timeout: 15_000 });
  });

  test("la card Emails affiche les statuts (fixtures) et la bannière bounce apparaît", async ({
    page,
  }) => {
    await page.goto("/factures/nouvelle");
    await completeInvoiceCreateWizard(page, {
      clientSearch: "Nova",
      clientLabel: "Nova Digital",
      description: "Prestation e2e emails",
      unitPrice: "1000",
    });
    const invoiceId = page.url().match(/\/factures\/([^/]+)$/)?.[1];
    expect(invoiceId).toBeTruthy();

    const sql = postgres(process.env.DATABASE_URL ?? "");
    try {
      const [org] = await sql`
        select organization_id from invoices where id = ${invoiceId}
      `;
      await sql`
        insert into email_logs (organization_id, document_type, document_id, kind, "to", subject, status, resend_id, sent_at, delivered_at)
        values (${org.organization_id}, 'invoice', ${invoiceId}, 'document', ${sql.json(["client-e2e@example.com"])}, 'Votre facture', 'delivered', ${"e2e_fixture_1"}, now() - interval '1 hour', now() - interval '55 minutes')
      `;
      await sql`
        insert into email_logs (organization_id, document_type, document_id, kind, "to", subject, status, resend_id, sent_at, bounced_at)
        values (${org.organization_id}, 'invoice', ${invoiceId}, 'document', ${sql.json(["client-e2e@example.com"])}, 'Votre facture (relance)', 'bounced', ${"e2e_fixture_2"}, now() - interval '10 minutes', now() - interval '9 minutes')
      `;

      await page.goto(`/factures/${invoiceId}`);

      await expect(page.getByText("L'adresse client-e2e@example.com semble invalide")).toBeVisible();
      await expect(page.getByText("Délivré", { exact: true })).toBeVisible();
      await expect(page.getByText("Échec (bounce)")).toBeVisible();
    } finally {
      await sql`delete from email_logs where document_id = ${invoiceId}`;
      await sql.end({ timeout: 5 });
    }
  });
});
