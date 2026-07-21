import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema";
import { clients, invoiceLines, invoices, organizations } from "../../db/schema";
import { createDraft, issueInvoice } from "./mutations";
import { getInvoiceById } from "./queries";
import { recordPayment } from "./payments";

/**
 * Test dédié à la concurrence réelle (parade « paiements concurrents
 * dépassant le total », plans/story-15.md) : pool multi-connexions
 * (contrairement aux autres tests d'intégration, `max: 1`) pour que le
 * verrou `SELECT ... FOR UPDATE` sur la ligne facture (`recordPayment`) soit
 * effectivement mis à l'épreuve, pas artificiellement sérialisé par un pool
 * à connexion unique — même pattern que `numbering.integration.test.ts`
 * (story 08).
 */
const url = process.env.TEST_DATABASE_URL;
const client = postgres(url ?? "", { max: 20 });
const db = drizzle(client, { schema });

let orgId = "";
let clientId = "";

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  const [org] = await db
    .insert(organizations)
    .values({ legalName: "Org Payments Concurrency Test" })
    .returning();
  orgId = org.id;

  const [c] = await db
    .insert(clients)
    .values({ organizationId: orgId, type: "company", displayName: "Client Payments Concurrency" })
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

describe("recordPayment — concurrence réelle", () => {
  it("2 paiements simultanés soldant chacun 100% du total : un seul passe", async () => {
    const created = await createDraft(db, orgId, {
      clientId,
      lines: [{ description: "Prestation", quantity: 1, unitPriceCents: 100000, vatRate: 20 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const issued = await issueInvoice(db, orgId, created.id);
    expect(issued.ok).toBe(true);
    const invoice = await getInvoiceById(db, orgId, created.id);
    expect(invoice).not.toBeNull();
    if (!invoice) return;

    const [resultA, resultB] = await Promise.all([
      recordPayment(db, orgId, invoice.id, { amountCents: invoice.totalCents, method: "transfer" }),
      recordPayment(db, orgId, invoice.id, { amountCents: invoice.totalCents, method: "card" }),
    ]);

    const outcomes = [resultA, resultB];
    expect(outcomes.filter((r) => r.ok)).toHaveLength(1);
    expect(outcomes.filter((r) => !r.ok)).toHaveLength(1);

    const after = await getInvoiceById(db, orgId, invoice.id);
    expect(after?.status).toBe("paid");
    expect(after?.amountPaidCents).toBe(invoice.totalCents);
  });
});
