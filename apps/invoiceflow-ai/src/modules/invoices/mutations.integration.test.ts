import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { DocumentDraftInput } from "@daromsart/core";
import * as schema from "../../db/schema";
import {
  clients,
  invoiceLines,
  invoices,
  numberSequences,
  organizations,
} from "../../db/schema";
import { getInvoiceById } from "./queries";
import { createDraft, deleteDraft, duplicate, issueInvoice, updateDraft } from "./mutations";

const url = process.env.TEST_DATABASE_URL;
const client = postgres(url ?? "", { max: 1 });
const db = drizzle(client, { schema });

let orgAId = "";
let orgBId = "";
let clientAId = "";
let clientBId = "";

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  const [orgA] = await db
    .insert(organizations)
    .values({ legalName: "Org A Invoices Test" })
    .returning();
  const [orgB] = await db
    .insert(organizations)
    .values({ legalName: "Org B Invoices Test" })
    .returning();
  orgAId = orgA.id;
  orgBId = orgB.id;

  const [clientA] = await db
    .insert(clients)
    .values({ organizationId: orgAId, type: "company", displayName: "Client A" })
    .returning();
  clientAId = clientA.id;

  const [clientB] = await db
    .insert(clients)
    .values({ organizationId: orgBId, type: "company", displayName: "Client B" })
    .returning();
  clientBId = clientB.id;
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

function draftInput(overrides: Partial<DocumentDraftInput> = {}): DocumentDraftInput {
  return {
    clientId: clientAId,
    lines: [
      { description: "Prestation A", quantity: 2, unitPriceCents: 10000, vatRate: 20 },
      { description: "Prestation B", quantity: 1, unitPriceCents: 5000, vatRate: 10 },
    ],
    ...overrides,
  };
}

describe("createDraft (invoices)", () => {
  it("crée une facture brouillon avec totaux recalculés côté serveur", async () => {
    const result = await createDraft(db, orgAId, draftInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const found = await getInvoiceById(db, orgAId, result.id);
    expect(found?.status).toBe("draft");
    expect(found?.subtotalCents).toBe(25000);
    expect(found?.vatByRate).toEqual({ "20": 4000, "10": 500 });
    expect(found?.totalCents).toBe(25000 + 4000 + 500);
    expect(found?.lines).toHaveLength(2);
  });

  it("rejette un client d'une autre organisation", async () => {
    const result = await createDraft(db, orgAId, draftInput({ clientId: clientBId }));
    expect(result.ok).toBe(false);
  });

  it("rejette un brouillon sans lignes", async () => {
    const result = await createDraft(db, orgAId, draftInput({ lines: [] }));
    expect(result.ok).toBe(false);
  });
});

describe("updateDraft (invoices)", () => {
  it("met à jour les lignes et recalcule les totaux", async () => {
    const created = await createDraft(db, orgAId, draftInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await updateDraft(
      db,
      orgAId,
      created.id,
      draftInput({
        lines: [
          { description: "Prestation unique", quantity: 1, unitPriceCents: 20000, vatRate: 20 },
        ],
      }),
    );
    expect(result.ok).toBe(true);

    const found = await getInvoiceById(db, orgAId, created.id);
    expect(found?.lines).toHaveLength(1);
    expect(found?.subtotalCents).toBe(20000);
  });

  it("refuse la modification d'une facture non-brouillon", async () => {
    const created = await createDraft(db, orgAId, draftInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await db.update(invoices).set({ status: "issued" }).where(eq(invoices.id, created.id));

    const result = await updateDraft(db, orgAId, created.id, draftInput());
    expect(result.ok).toBe(false);
  });

  it("refuse la modification d'une facture d'une autre organisation", async () => {
    const created = await createDraft(db, orgAId, draftInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await updateDraft(db, orgBId, created.id, draftInput());
    expect(result.ok).toBe(false);
  });
});

describe("deleteDraft (invoices)", () => {
  it("supprime une facture brouillon et ses lignes", async () => {
    const created = await createDraft(db, orgAId, draftInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await deleteDraft(db, orgAId, created.id);
    expect(result.ok).toBe(true);

    const found = await getInvoiceById(db, orgAId, created.id);
    expect(found).toBeNull();

    const remainingLines = await db
      .select()
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, created.id));
    expect(remainingLines).toHaveLength(0);
  });

  it("refuse de supprimer une facture d'une autre organisation", async () => {
    const created = await createDraft(db, orgAId, draftInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await deleteDraft(db, orgBId, created.id);
    expect(result.ok).toBe(false);
  });
});

describe("issueInvoice", () => {
  it("émet une facture brouillon : numéro, share_token, statut issued, snapshots figés", async () => {
    const created = await createDraft(db, orgAId, draftInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await issueInvoice(db, orgAId, created.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.number).toMatch(/^FAC-\d{4}-\d{4}$/);

    const found = await getInvoiceById(db, orgAId, created.id);
    expect(found?.status).toBe("issued");
    expect(found?.number).toBe(result.number);
    expect(found?.shareToken).toBeTruthy();
    expect(found?.organizationSnapshot).not.toBeNull();
    expect(found?.clientSnapshot?.displayName).toBe("Client A");
  });

  it("refuse d'émettre une facture déjà émise", async () => {
    const created = await createDraft(db, orgAId, draftInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await issueInvoice(db, orgAId, created.id);

    const result = await issueInvoice(db, orgAId, created.id);
    expect(result.ok).toBe(false);
  });

  it("refuse d'émettre une facture sans lignes", async () => {
    const created = await createDraft(db, orgAId, draftInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await db.delete(invoiceLines).where(eq(invoiceLines.invoiceId, created.id));

    const result = await issueInvoice(db, orgAId, created.id);
    expect(result.ok).toBe(false);
  });

  it("refuse d'émettre pour un client archivé et ne consomme pas de numéro", async () => {
    const [archived] = await db
      .insert(clients)
      .values({
        organizationId: orgAId,
        type: "company",
        displayName: "Client archivé (numbering facture)",
        archivedAt: new Date(),
      })
      .returning();

    const created = await createDraft(db, orgAId, draftInput({ clientId: archived.id }));
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const [before] = await db
      .select({ lastNumber: numberSequences.lastNumber })
      .from(numberSequences)
      .where(
        and(
          eq(numberSequences.organizationId, orgAId),
          eq(numberSequences.documentType, "invoice"),
        ),
      );

    const result = await issueInvoice(db, orgAId, created.id);
    expect(result.ok).toBe(false);

    const [after] = await db
      .select({ lastNumber: numberSequences.lastNumber })
      .from(numberSequences)
      .where(
        and(
          eq(numberSequences.organizationId, orgAId),
          eq(numberSequences.documentType, "invoice"),
        ),
      );
    expect(after?.lastNumber ?? 0).toBe(before?.lastNumber ?? 0);
  });

  it("refuse la modification et la suppression après émission", async () => {
    const created = await createDraft(db, orgAId, draftInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await issueInvoice(db, orgAId, created.id);

    const updateResult = await updateDraft(db, orgAId, created.id, draftInput());
    expect(updateResult.ok).toBe(false);

    const deleteResult = await deleteDraft(db, orgAId, created.id);
    expect(deleteResult.ok).toBe(false);
  });

  it("H7 — le snapshot figé au PDF ne change jamais si le client est modifié après émission", async () => {
    const created = await createDraft(db, orgAId, draftInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const issued = await issueInvoice(db, orgAId, created.id);
    expect(issued.ok).toBe(true);

    const beforeRename = await getInvoiceById(db, orgAId, created.id);
    expect(beforeRename?.clientSnapshot?.displayName).toBe("Client A");

    // Le client est renommé APRÈS l'émission.
    await db
      .update(clients)
      .set({ displayName: "Client A — Renommé" })
      .where(eq(clients.id, clientAId));

    const afterRename = await getInvoiceById(db, orgAId, created.id);
    // Le snapshot figé reste inchangé (immuabilité, H7) — jamais la donnée live.
    expect(afterRename?.clientSnapshot?.displayName).toBe("Client A");
    // La donnée live, elle, a bien changé (le nom courant du client diffère du snapshot).
    expect(afterRename?.clientName).toBe("Client A — Renommé");
  });

  it("séquences indépendantes devis/facture (préfixes DEV/FAC distincts)", async () => {
    const created = await createDraft(db, orgAId, draftInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const result = await issueInvoice(db, orgAId, created.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.number.startsWith("FAC-")).toBe(true);
  });
});

describe("duplicate (invoices)", () => {
  it("duplique une facture (statut réinitialisé à brouillon)", async () => {
    const created = await createDraft(db, orgAId, draftInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await db.update(invoices).set({ status: "issued" }).where(eq(invoices.id, created.id));

    const result = await duplicate(db, orgAId, created.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const copy = await getInvoiceById(db, orgAId, result.id);
    expect(copy?.status).toBe("draft");
    expect(copy?.number).toBeNull();
    expect(copy?.lines).toHaveLength(2);
    expect(copy?.subtotalCents).toBe(25000);
    expect(copy?.id).not.toBe(created.id);
  });
});
