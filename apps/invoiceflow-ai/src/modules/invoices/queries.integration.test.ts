import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { DocumentDraftInput } from "@daromsart/core";
import * as schema from "../../db/schema";
import { clients, invoiceLines, invoices, organizations } from "../../db/schema";
import { createDraft, issueInvoice } from "./mutations";
import {
  getClientInvoiceStats,
  getInvoiceDashboardStats,
  getInvoiceStatusCounts,
  listInvoices,
  listInvoicesForClient,
} from "./queries";

const url = process.env.TEST_DATABASE_URL;
const client = postgres(url ?? "", { max: 1 });
const db = drizzle(client, { schema });

let orgAId = "";
let orgBId = "";
let clientAId = "";
let clientOtherId = "";
let overdueInvoiceId = "";
let notDueInvoiceId = "";

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  const [orgA] = await db
    .insert(organizations)
    .values({ legalName: "Org A Invoices List Test" })
    .returning();
  const [orgB] = await db
    .insert(organizations)
    .values({ legalName: "Org B Invoices List Test" })
    .returning();
  orgAId = orgA.id;
  orgBId = orgB.id;

  const [clientA] = await db
    .insert(clients)
    .values({ organizationId: orgAId, type: "company", displayName: "Nova Digital" })
    .returning();
  clientAId = clientA.id;

  const [clientOther] = await db
    .insert(clients)
    .values({ organizationId: orgAId, type: "company", displayName: "Atelier Lumière" })
    .returning();
  clientOtherId = clientOther.id;

  const baseInput: DocumentDraftInput = {
    clientId: clientAId,
    lines: [{ description: "X", quantity: 1, unitPriceCents: 10000, vatRate: 20 }],
  };

  await createDraft(db, orgAId, baseInput);
  await createDraft(db, orgAId, baseInput);
  await createDraft(db, orgAId, { ...baseInput, clientId: clientOtherId });

  // Facture émise, échéance future : ne doit pas apparaître en "en retard".
  const notDue = await createDraft(db, orgAId, {
    ...baseInput,
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  if (notDue.ok) {
    notDueInvoiceId = notDue.id;
    await issueInvoice(db, orgAId, notDue.id);
  }

  // Facture émise, échéance passée : "en retard" (calculé, jamais stocké).
  const overdue = await createDraft(db, orgAId, {
    ...baseInput,
    validUntil: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
  });
  if (overdue.ok) {
    overdueInvoiceId = overdue.id;
    await issueInvoice(db, orgAId, overdue.id);
  }

  // Bruit dans une autre organisation : ne doit jamais apparaître.
  const [clientB] = await db
    .insert(clients)
    .values({ organizationId: orgBId, type: "company", displayName: "Client B" })
    .returning();
  await createDraft(db, orgBId, { ...baseInput, clientId: clientB.id });
});

afterAll(async () => {
  await db.delete(invoiceLines);
  await db.delete(invoices);
  await db.delete(clients).where(eq(clients.organizationId, orgAId));
  await db.delete(clients).where(eq(clients.organizationId, orgBId));
  await db.delete(organizations).where(eq(organizations.id, orgAId));
  await db.delete(organizations).where(eq(organizations.id, orgBId));
  await client.end({ timeout: 5 });
});

describe("listInvoices", () => {
  it("filtre par organisation et statut", async () => {
    const draftOnly = await listInvoices(db, {
      organizationId: orgAId,
      status: "draft",
      page: 1,
      pageSize: 10,
    });
    expect(draftOnly.items.every((i) => i.status === "draft")).toBe(true);
    expect(draftOnly.items.length).toBe(3);
  });

  it("filtre 'en retard' : uniquement les factures actives et échues", async () => {
    const overdueOnly = await listInvoices(db, {
      organizationId: orgAId,
      status: "overdue",
      page: 1,
      pageSize: 10,
    });
    expect(overdueOnly.items.map((i) => i.id)).toContain(overdueInvoiceId);
    expect(overdueOnly.items.map((i) => i.id)).not.toContain(notDueInvoiceId);
  });

  it("filtre par recherche sur le nom du client", async () => {
    const result = await listInvoices(db, {
      organizationId: orgAId,
      q: "nova",
      page: 1,
      pageSize: 10,
    });
    expect(result.items.every((i) => i.clientName === "Nova Digital")).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
  });

  it("n'expose jamais les factures d'une autre organisation", async () => {
    const result = await listInvoices(db, {
      organizationId: orgAId,
      status: "all",
      page: 1,
      pageSize: 100,
    });
    expect(result.items.every((i) => i.clientName !== "Client B")).toBe(true);
  });
});

describe("getInvoiceStatusCounts", () => {
  it("compte les factures par statut et l'en-retard séparément", async () => {
    const counts = await getInvoiceStatusCounts(db, orgAId);
    expect(counts.draft).toBe(3);
    expect(counts.issued).toBe(2);
    expect(counts.overdue).toBe(1);
  });
});

describe("listInvoicesForClient", () => {
  it("retourne uniquement les factures du client demandé", async () => {
    const result = await listInvoicesForClient(db, orgAId, clientOtherId);
    expect(result).toHaveLength(1);
    expect(result[0].clientId).toBe(clientOtherId);
  });
});

describe("getClientInvoiceStats / getInvoiceDashboardStats", () => {
  it("calcule CA facturé, encours et retard sur un jeu contrôlé", async () => {
    const stats = await getClientInvoiceStats(db, orgAId, clientAId);
    // 2 factures émises (12000 chacune = 10000 + 20% TVA) : CA = 24000, tout en encours,
    // dont 1 échue (12000) en retard.
    expect(stats.caFactureCents).toBe(24000);
    expect(stats.encoursCents).toBe(24000);
    expect(stats.retardCents).toBe(12000);
  });

  it("agrège les mêmes montants au niveau de l'organisation", async () => {
    const stats = await getInvoiceDashboardStats(db, orgAId);
    expect(stats.encoursCents).toBeGreaterThanOrEqual(24000);
    expect(stats.retardCents).toBeGreaterThanOrEqual(12000);
    expect(stats.encaisseMoisCents).toBe(0);
  });
});
