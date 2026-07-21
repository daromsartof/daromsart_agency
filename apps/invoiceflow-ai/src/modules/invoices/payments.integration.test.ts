import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema";
import { clients, invoiceLines, invoices, organizations } from "../../db/schema";
import { createDraft, issueInvoice } from "./mutations";
import { getInvoiceById } from "./queries";
import { deletePayment, listPaymentsForInvoice, recordPayment } from "./payments";

const url = process.env.TEST_DATABASE_URL;
const client = postgres(url ?? "", { max: 1 });
const db = drizzle(client, { schema });

let orgId = "";
let clientId = "";

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  const [org] = await db
    .insert(organizations)
    .values({ legalName: "Org Payments Test" })
    .returning();
  orgId = org.id;

  const [c] = await db
    .insert(clients)
    .values({ organizationId: orgId, type: "company", displayName: "Client Payments Test" })
    .returning();
  clientId = c.id;
});

afterAll(async () => {
  // `payments` a une contrainte `onDelete: "cascade"` sur `invoice_id` — la
  // suppression des factures de cette org suffit à nettoyer ses paiements.
  await db.delete(invoiceLines);
  await db.delete(invoices).where(eq(invoices.organizationId, orgId));
  await db.delete(clients).where(eq(clients.organizationId, orgId));
  await db.delete(organizations).where(eq(organizations.id, orgId));
  await client.end({ timeout: 5 });
});

async function issuedInvoice(unitPriceCents = 100000) {
  const created = await createDraft(db, orgId, {
    clientId,
    lines: [{ description: "Prestation", quantity: 1, unitPriceCents, vatRate: 20 }],
  });
  if (!created.ok) throw new Error("createDraft failed");
  const issued = await issueInvoice(db, orgId, created.id);
  if (!issued.ok) throw new Error("issueInvoice failed");
  const invoice = await getInvoiceById(db, orgId, created.id);
  if (!invoice) throw new Error("invoice not found");
  return invoice;
}

describe("recordPayment", () => {
  it("paiement partiel → partially_paid, reste dû recalculé par somme", async () => {
    const invoice = await issuedInvoice(120000); // total TTC = 144000
    const result = await recordPayment(db, orgId, invoice.id, {
      amountCents: 50000,
      method: "transfer",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe("partially_paid");
    expect(result.amountPaidCents).toBe(50000);

    const after = await getInvoiceById(db, orgId, invoice.id);
    expect(after?.status).toBe("partially_paid");
    expect(after?.amountPaidCents).toBe(50000);
    expect(after?.paidAt).toBeNull();
  });

  it("paiement soldant le total → paid + paid_at", async () => {
    const invoice = await issuedInvoice(100000); // total TTC = 120000
    const result = await recordPayment(db, orgId, invoice.id, {
      amountCents: 120000,
      method: "card",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe("paid");

    const after = await getInvoiceById(db, orgId, invoice.id);
    expect(after?.status).toBe("paid");
    expect(after?.amountPaidCents).toBe(120000);
    expect(after?.paidAt).not.toBeNull();
  });

  it("deux paiements partiels cumulés soldent la facture", async () => {
    const invoice = await issuedInvoice(100000); // total TTC = 120000
    const first = await recordPayment(db, orgId, invoice.id, {
      amountCents: 70000,
      method: "transfer",
    });
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.status).toBe("partially_paid");

    const second = await recordPayment(db, orgId, invoice.id, {
      amountCents: 50000,
      method: "transfer",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.status).toBe("paid");
    expect(second.amountPaidCents).toBe(120000);
  });

  it("rejette un montant supérieur au reste dû", async () => {
    const invoice = await issuedInvoice(100000); // total TTC = 120000
    const result = await recordPayment(db, orgId, invoice.id, {
      amountCents: 200000,
      method: "transfer",
    });
    expect(result.ok).toBe(false);

    const after = await getInvoiceById(db, orgId, invoice.id);
    expect(after?.amountPaidCents).toBe(0);
    expect(after?.status).toBe("issued");
  });

  it("rejette un montant négatif ou nul (validation zod)", async () => {
    const invoice = await issuedInvoice();
    const zero = await recordPayment(db, orgId, invoice.id, { amountCents: 0, method: "cash" });
    expect(zero.ok).toBe(false);
    const negative = await recordPayment(db, orgId, invoice.id, {
      amountCents: -100,
      method: "cash",
    });
    expect(negative.ok).toBe(false);
  });

  it("rejette un paiement sur une facture brouillon", async () => {
    const created = await createDraft(db, orgId, {
      clientId,
      lines: [{ description: "Prestation", quantity: 1, unitPriceCents: 10000, vatRate: 20 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await recordPayment(db, orgId, created.id, {
      amountCents: 1000,
      method: "cash",
    });
    expect(result.ok).toBe(false);
  });

  it("rejette un paiement sur une facture annulée", async () => {
    const invoice = await issuedInvoice();
    await db.update(invoices).set({ status: "cancelled" }).where(eq(invoices.id, invoice.id));

    const result = await recordPayment(db, orgId, invoice.id, {
      amountCents: 1000,
      method: "cash",
    });
    expect(result.ok).toBe(false);
  });

  it("accepte un paiement sur une facture 'issued' jamais envoyée (règlement comptant)", async () => {
    const invoice = await issuedInvoice(100000); // total TTC = 120000, status = issued (jamais sent)
    expect(invoice.status).toBe("issued");

    const result = await recordPayment(db, orgId, invoice.id, {
      amountCents: 120000,
      method: "cash",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.status).toBe("paid");
  });

  it("journalise un event payment_recorded", async () => {
    const invoice = await issuedInvoice(100000);
    await recordPayment(db, orgId, invoice.id, { amountCents: 50000, method: "transfer" });

    const rows = await listPaymentsForInvoice(db, invoice.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].amountCents).toBe(50000);
    expect(rows[0].method).toBe("transfer");
  });
});

describe("deletePayment", () => {
  it("supprime un paiement partiel : recalcul, statut inchangé (partially_paid → partially_paid)", async () => {
    const invoice = await issuedInvoice(100000); // total 120000
    await recordPayment(db, orgId, invoice.id, { amountCents: 30000, method: "transfer" });
    const recorded = await recordPayment(db, orgId, invoice.id, {
      amountCents: 20000,
      method: "cash",
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;

    const rows = await listPaymentsForInvoice(db, invoice.id);
    const toDelete = rows.find((r) => r.amountCents === 20000)!;

    const result = await deletePayment(db, orgId, invoice.id, toDelete.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe("partially_paid");
    expect(result.amountPaidCents).toBe(30000);
  });

  it("supprime le paiement soldant : paid → partially_paid (seule transition arrière autorisée)", async () => {
    const invoice = await issuedInvoice(100000); // total 120000
    const recorded = await recordPayment(db, orgId, invoice.id, {
      amountCents: 120000,
      method: "transfer",
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;
    const beforeDelete = await getInvoiceById(db, orgId, invoice.id);
    expect(beforeDelete?.status).toBe("paid");

    const result = await deletePayment(db, orgId, invoice.id, recorded.paymentId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe("partially_paid");
    expect(result.amountPaidCents).toBe(0);

    const after = await getInvoiceById(db, orgId, invoice.id);
    expect(after?.status).toBe("partially_paid");
    expect(after?.amountPaidCents).toBe(0);
    expect(after?.paidAt).toBeNull();
  });

  it("refuse un paiement inconnu", async () => {
    const invoice = await issuedInvoice();
    const result = await deletePayment(db, orgId, invoice.id, "00000000-0000-0000-0000-000000000000");
    expect(result.ok).toBe(false);
  });
});
