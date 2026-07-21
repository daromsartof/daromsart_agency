import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { DocumentDraftInput } from "@daromsart/core";
import * as schema from "../../db/schema";
import {
  clients,
  invoiceLines,
  invoices,
  organizations,
  quoteLines,
  quotes,
} from "../../db/schema";
import { createDraft } from "./mutations";
import { convertToInvoice } from "./mutations";
import { getQuoteById } from "./queries";
import { getInvoiceById } from "../invoices/queries";
import { issueInvoice, deleteDraft as deleteInvoiceDraft } from "../invoices/mutations";

const url = process.env.TEST_DATABASE_URL;
const client = postgres(url ?? "", { max: 1 });
const db = drizzle(client, { schema });

let orgId = "";
let clientId = "";
let clientWithTermsId = "";

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  const [org] = await db
    .insert(organizations)
    .values({ legalName: "Org Convert Test", paymentTermsDays: 30 })
    .returning();
  orgId = org.id;

  const [c] = await db
    .insert(clients)
    .values({ organizationId: orgId, type: "company", displayName: "Client Convert Test" })
    .returning();
  clientId = c.id;

  const [c2] = await db
    .insert(clients)
    .values({
      organizationId: orgId,
      type: "company",
      displayName: "Client Convert Terms Test",
      paymentTermsDays: 10,
    })
    .returning();
  clientWithTermsId = c2.id;
});

afterAll(async () => {
  await db.delete(invoiceLines);
  await db.delete(invoices).where(eq(invoices.organizationId, orgId));
  await db.delete(quoteLines);
  await db.delete(quotes).where(eq(quotes.organizationId, orgId));
  await db.delete(clients).where(eq(clients.organizationId, orgId));
  await db.delete(organizations).where(eq(organizations.id, orgId));
  await client.end({ timeout: 5 });
});

function draftInput(overrides: Partial<DocumentDraftInput> = {}): DocumentDraftInput {
  return {
    clientId,
    notes: "Note de test",
    globalDiscount: { type: "percent", value: 10 },
    lines: [
      { description: "Prestation A", quantity: 2, unitPriceCents: 10000, vatRate: 20 },
      { description: "Prestation B", quantity: 1, unitPriceCents: 5000, vatRate: 10 },
    ],
    ...overrides,
  };
}

async function signedQuote(overrides: Partial<DocumentDraftInput> = {}) {
  const created = await createDraft(db, orgId, draftInput(overrides));
  if (!created.ok) throw new Error("createDraft failed");
  await db.update(quotes).set({ status: "signed" }).where(eq(quotes.id, created.id));
  return created.id;
}

describe("convertToInvoice", () => {
  it("copie intégrale (lignes, remise, notes, totaux au centime) et lie les deux documents", async () => {
    const quoteId = await signedQuote();
    const quoteBefore = await getQuoteById(db, orgId, quoteId);

    const result = await convertToInvoice(db, orgId, quoteId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const invoice = await getInvoiceById(db, orgId, result.invoiceId);
    expect(invoice?.status).toBe("draft");
    expect(invoice?.quoteId).toBe(quoteId);
    expect(invoice?.notes).toBe("Note de test");
    expect(invoice?.globalDiscount).toEqual({ type: "percent", value: 10 });
    expect(invoice?.lines).toHaveLength(2);
    expect(invoice?.subtotalCents).toBe(quoteBefore?.subtotalCents);
    expect(invoice?.discountCents).toBe(quoteBefore?.discountCents);
    expect(invoice?.totalCents).toBe(quoteBefore?.totalCents);
    expect(invoice?.vatByRate).toEqual(quoteBefore?.vatByRate);

    const quoteAfter = await getQuoteById(db, orgId, quoteId);
    expect(quoteAfter?.invoiceId).toBe(result.invoiceId);
    expect(quoteAfter?.status).toBe("signed"); // inchangé à la conversion (H14, story 17)
  });

  it("échéance = émission + délai du CLIENT si défini, sinon délai de l'organisation", async () => {
    const created = await createDraft(db, orgId, draftInput({ clientId: clientWithTermsId }));
    if (!created.ok) throw new Error("createDraft failed");
    await db.update(quotes).set({ status: "signed" }).where(eq(quotes.id, created.id));

    const result = await convertToInvoice(db, orgId, created.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const invoice = await getInvoiceById(db, orgId, result.invoiceId);
    const expectedDue = new Date(invoice!.issueDate!);
    expectedDue.setDate(expectedDue.getDate() + 10); // délai client, pas 30 (org)
    expect(invoice?.dueDate?.toDateString()).toBe(expectedDue.toDateString());
  });

  it("refuse la conversion d'un devis brouillon", async () => {
    const created = await createDraft(db, orgId, draftInput());
    if (!created.ok) throw new Error("createDraft failed");

    const result = await convertToInvoice(db, orgId, created.id);
    expect(result.ok).toBe(false);
  });

  it("refuse la conversion d'un devis sent/viewed sans confirmation (force)", async () => {
    const created = await createDraft(db, orgId, draftInput());
    if (!created.ok) throw new Error("createDraft failed");
    await db.update(quotes).set({ status: "sent" }).where(eq(quotes.id, created.id));

    const result = await convertToInvoice(db, orgId, created.id);
    expect(result.ok).toBe(false);
  });

  it("autorise la conversion d'un devis sent/viewed avec force: true", async () => {
    const created = await createDraft(db, orgId, draftInput());
    if (!created.ok) throw new Error("createDraft failed");
    await db.update(quotes).set({ status: "viewed" }).where(eq(quotes.id, created.id));

    const result = await convertToInvoice(db, orgId, created.id, { force: true });
    expect(result.ok).toBe(true);
  });

  it("refuse une double conversion (invoice_id déjà posé)", async () => {
    const quoteId = await signedQuote();
    const first = await convertToInvoice(db, orgId, quoteId);
    expect(first.ok).toBe(true);

    const second = await convertToInvoice(db, orgId, quoteId);
    expect(second.ok).toBe(false);
  });

  it("issueInvoice sur une facture issue d'une conversion fait passer le devis à invoiced", async () => {
    const quoteId = await signedQuote();
    const result = await convertToInvoice(db, orgId, quoteId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const issued = await issueInvoice(db, orgId, result.invoiceId);
    expect(issued.ok).toBe(true);

    const quoteAfter = await getQuoteById(db, orgId, quoteId);
    expect(quoteAfter?.status).toBe("invoiced");
  });

  it("supprimer le brouillon issu d'une conversion dé-lie le devis (nouvelle conversion possible)", async () => {
    const quoteId = await signedQuote();
    const result = await convertToInvoice(db, orgId, quoteId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const deleteResult = await deleteInvoiceDraft(db, orgId, result.invoiceId);
    expect(deleteResult.ok).toBe(true);

    const quoteAfter = await getQuoteById(db, orgId, quoteId);
    expect(quoteAfter?.invoiceId).toBeNull();

    const secondConversion = await convertToInvoice(db, orgId, quoteId);
    expect(secondConversion.ok).toBe(true);
  });
});
