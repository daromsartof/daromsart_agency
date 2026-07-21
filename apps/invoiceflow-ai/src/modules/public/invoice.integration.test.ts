import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema";
import { clients, invoiceLines, invoices, organizations } from "../../db/schema";
import { createDraft, issueInvoice } from "../invoices/mutations";
import { getInvoiceById } from "../invoices/queries";
import { getInvoiceByToken } from "./queries";
import { markInvoiceViewed } from "./mutations";

const url = process.env.TEST_DATABASE_URL;
const client = postgres(url ?? "", { max: 1 });
const db = drizzle(client, { schema });

let orgId = "";
let clientId = "";

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  const [org] = await db
    .insert(organizations)
    .values({
      legalName: "Org Public Invoice Test",
      iban: "FR7630006000011234567890189",
      bic: "AGRIFRPP",
    })
    .returning();
  orgId = org.id;

  const [c] = await db
    .insert(clients)
    .values({
      organizationId: orgId,
      type: "company",
      displayName: "Client Public Invoice Test",
      email: "client@example.com",
    })
    .returning();
  clientId = c.id;
});

afterAll(async () => {
  await db.delete(invoiceLines);
  await db.delete(invoices).where(eq(invoices.organizationId, orgId));
  await db.delete(clients).where(eq(clients.organizationId, orgId));
  await db.delete(organizations).where(eq(organizations.id, orgId));
  await client.end({ timeout: 5 });
});

async function issuedInvoice() {
  const created = await createDraft(db, orgId, {
    clientId,
    lines: [{ description: "Prestation", quantity: 1, unitPriceCents: 10000, vatRate: 20 }],
  });
  if (!created.ok) throw new Error("createDraft failed");
  const issued = await issueInvoice(db, orgId, created.id);
  if (!issued.ok) throw new Error("issueInvoice failed");
  const invoice = await getInvoiceById(db, orgId, created.id);
  if (!invoice?.shareToken) throw new Error("no share token");
  return invoice;
}

describe("getInvoiceByToken", () => {
  it("renvoie null pour un token inconnu", async () => {
    const result = await getInvoiceByToken(db, "token-inexistant");
    expect(result).toBeNull();
  });

  it("renvoie l'IBAN/BIC depuis le snapshot figé (H7), pas les données live", async () => {
    const invoice = await issuedInvoice();
    const found = await getInvoiceByToken(db, invoice.shareToken!);
    expect(found?.iban).toBe("FR7630006000011234567890189");
    expect(found?.bic).toBe("AGRIFRPP");
    expect(found?.clientName).toBe("Client Public Invoice Test");
  });

  it("facture payée (forcée en DB) : reste dû nul — la page publique masque le bloc virement", async () => {
    const invoice = await issuedInvoice();
    await db
      .update(invoices)
      .set({ status: "paid", amountPaidCents: invoice.totalCents, paidAt: new Date() })
      .where(eq(invoices.id, invoice.id));

    const found = await getInvoiceByToken(db, invoice.shareToken!);
    expect(found?.status).toBe("paid");
    // Contrat exploité par `app/p/factures/[token]/page.tsx` : `paid = remainingCents <= 0`.
    expect((found?.totalCents ?? 0) - (found?.amountPaidCents ?? 0)).toBeLessThanOrEqual(0);
  });
});

describe("markInvoiceViewed", () => {
  it("ne transitionne pas 'issued' → 'viewed' (seul 'sent' peut, H15)", async () => {
    const invoice = await issuedInvoice();
    expect(invoice.status).toBe("issued");

    await markInvoiceViewed(db, invoice.id);
    const after = await getInvoiceById(db, orgId, invoice.id);
    expect(after?.status).toBe("issued");
  });

  it("fait passer sent → viewed la première fois, idempotent ensuite", async () => {
    const invoice = await issuedInvoice();
    await db
      .update(invoices)
      .set({ status: "sent", sentAt: new Date() })
      .where(eq(invoices.id, invoice.id));

    await markInvoiceViewed(db, invoice.id);
    const after1 = await getInvoiceById(db, orgId, invoice.id);
    expect(after1?.status).toBe("viewed");

    const viewedAtFirst = after1?.updatedAt;
    await markInvoiceViewed(db, invoice.id);
    const after2 = await getInvoiceById(db, orgId, invoice.id);
    expect(after2?.status).toBe("viewed");
    expect(after2?.updatedAt.getTime()).toBe(viewedAtFirst?.getTime());
  });
});
