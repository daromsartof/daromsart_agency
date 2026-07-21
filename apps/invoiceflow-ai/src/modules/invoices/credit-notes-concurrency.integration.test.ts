import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema";
import { clients, invoiceLines, invoices, organizations } from "../../db/schema";
import { createDraft, issueInvoice } from "./mutations";
import { getInvoiceById } from "./queries";
import { createCreditNoteDraft, issueCreditNote } from "./credit-notes";

/**
 * Test dédié à la concurrence réelle (parade « cumul d'avoirs dépassant le
 * parent / double annulation », plans/story-18.md) : pool multi-connexions
 * (contrairement aux autres tests d'intégration, `max: 1`) pour que le
 * verrou `SELECT ... FOR UPDATE` sur la ligne PARENT (`issueCreditNote`)
 * soit effectivement mis à l'épreuve — même pattern que
 * `payments-concurrency.integration.test.ts` (story 15) et
 * `convert-concurrency.integration.test.ts` (story 17).
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
    .values({ legalName: "Org Credit Notes Concurrency Test" })
    .returning();
  orgId = org.id;

  const [c] = await db
    .insert(clients)
    .values({ organizationId: orgId, type: "company", displayName: "Client Credit Notes Concurrency" })
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
    lines: [{ description: "Prestation", quantity: 1, unitPriceCents: 100000, vatRate: 20 }],
  });
  if (!created.ok) throw new Error("createDraft failed");
  const issued = await issueInvoice(db, orgId, created.id);
  if (!issued.ok) throw new Error("issueInvoice failed");
  const invoice = await getInvoiceById(db, orgId, created.id);
  if (!invoice) throw new Error("invoice not found");
  return invoice;
}

describe("issueCreditNote — concurrence réelle", () => {
  it("2 avoirs intégraux émis simultanément sur la même facture : un seul aboutit, le parent n'est annulé qu'une fois", async () => {
    const invoice = await issuedInvoice();

    const draftA = await createCreditNoteDraft(db, orgId, invoice.id);
    const draftB = await createCreditNoteDraft(db, orgId, invoice.id);
    expect(draftA.ok).toBe(true);
    expect(draftB.ok).toBe(true);
    if (!draftA.ok || !draftB.ok) return;

    const [resultA, resultB] = await Promise.all([
      issueCreditNote(db, orgId, draftA.id),
      issueCreditNote(db, orgId, draftB.id),
    ]);
    const outcomes = [resultA, resultB];
    expect(outcomes.filter((r) => r.ok)).toHaveLength(1);
    expect(outcomes.filter((r) => !r.ok)).toHaveLength(1);

    const parentAfter = await getInvoiceById(db, orgId, invoice.id);
    expect(parentAfter?.status).toBe("cancelled");

    const issuedDraftId = resultA.ok ? draftA.id : draftB.id;
    const rejectedDraftId = resultA.ok ? draftB.id : draftA.id;
    const issuedCreditNote = await getInvoiceById(db, orgId, issuedDraftId);
    const rejectedCreditNote = await getInvoiceById(db, orgId, rejectedDraftId);
    expect(issuedCreditNote?.status).toBe("issued");
    expect(rejectedCreditNote?.status).toBe("draft");

    const events = await db
      .select({ eventType: schema.documentEvents.eventType })
      .from(schema.documentEvents)
      .where(eq(schema.documentEvents.documentId, invoice.id));
    expect(events.filter((e) => e.eventType === "cancelled")).toHaveLength(1);
  });
});
