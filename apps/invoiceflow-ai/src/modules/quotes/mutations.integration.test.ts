import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { DocumentDraftInput } from "@daromsart/core";
import * as schema from "../../db/schema";
import { clients, numberSequences, organizations, quoteLines, quotes } from "../../db/schema";
import { getQuoteById } from "./queries";
import {
  createDraft,
  deleteDraft,
  duplicate,
  issueQuote,
  markRefused,
  updateDraft,
} from "./mutations";

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
    .values({ legalName: "Org A Quotes Test" })
    .returning();
  const [orgB] = await db
    .insert(organizations)
    .values({ legalName: "Org B Quotes Test" })
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
  await db.delete(quoteLines);
  await db.delete(quotes);
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

describe("createDraft", () => {
  it("crée un devis brouillon avec totaux recalculés côté serveur", async () => {
    const result = await createDraft(db, orgAId, draftInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const found = await getQuoteById(db, orgAId, result.id);
    expect(found?.status).toBe("draft");
    expect(found?.subtotalCents).toBe(25000);
    expect(found?.vatByRate).toEqual({ "20": 4000, "10": 500 });
    expect(found?.totalCents).toBe(25000 + 4000 + 500);
    expect(found?.lines).toHaveLength(2);
    expect(found?.lines[0].position).toBe(0);
    expect(found?.lines[1].position).toBe(1);
  });

  it("ignore des totaux falsifiés envoyés depuis le client (recalcul autoritaire)", async () => {
    // Le schéma de saisie n'a pas de champ « totalCents » : même en l'injectant,
    // il est ignoré — seules les lignes servent au calcul serveur.
    const result = await createDraft(db, orgAId, {
      ...draftInput(),
      // @ts-expect-error -- payload falsifié volontaire pour le test
      totalCents: 1,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const found = await getQuoteById(db, orgAId, result.id);
    expect(found?.totalCents).toBe(25000 + 4000 + 500);
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

describe("updateDraft", () => {
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

    const found = await getQuoteById(db, orgAId, created.id);
    expect(found?.lines).toHaveLength(1);
    expect(found?.subtotalCents).toBe(20000);
    expect(found?.vatByRate).toEqual({ "20": 4000 });
  });

  it("refuse la modification d'un devis non-brouillon", async () => {
    const created = await createDraft(db, orgAId, draftInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // Statut forcé en base pour simuler un devis déjà envoyé (hors scope V1).
    await db.update(quotes).set({ status: "sent" }).where(eq(quotes.id, created.id));

    const result = await updateDraft(db, orgAId, created.id, draftInput());
    expect(result.ok).toBe(false);
  });

  it("refuse la modification d'un devis d'une autre organisation", async () => {
    const created = await createDraft(db, orgAId, draftInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await updateDraft(db, orgBId, created.id, draftInput());
    expect(result.ok).toBe(false);

    const unchanged = await getQuoteById(db, orgAId, created.id);
    expect(unchanged?.subtotalCents).toBe(25000);
  });
});

describe("deleteDraft", () => {
  it("supprime un devis brouillon et ses lignes", async () => {
    const created = await createDraft(db, orgAId, draftInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await deleteDraft(db, orgAId, created.id);
    expect(result.ok).toBe(true);

    const found = await getQuoteById(db, orgAId, created.id);
    expect(found).toBeNull();

    const remainingLines = await db
      .select()
      .from(quoteLines)
      .where(eq(quoteLines.quoteId, created.id));
    expect(remainingLines).toHaveLength(0);
  });

  it("refuse de supprimer un devis d'une autre organisation", async () => {
    const created = await createDraft(db, orgAId, draftInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await deleteDraft(db, orgBId, created.id);
    expect(result.ok).toBe(false);

    const found = await getQuoteById(db, orgAId, created.id);
    expect(found).not.toBeNull();
  });
});

describe("issueQuote", () => {
  it("émet un devis brouillon : numéro, share_token, sent_at, statut sent", async () => {
    const created = await createDraft(db, orgAId, draftInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await issueQuote(db, orgAId, created.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.number).toMatch(/^DEV-\d{4}-\d{4}$/);

    const found = await getQuoteById(db, orgAId, created.id);
    expect(found?.status).toBe("sent");
    expect(found?.number).toBe(result.number);
    expect(found?.shareToken).toBeTruthy();
    expect(found?.sentAt).not.toBeNull();
  });

  it("refuse d'émettre un devis déjà émis", async () => {
    const created = await createDraft(db, orgAId, draftInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await issueQuote(db, orgAId, created.id);

    const result = await issueQuote(db, orgAId, created.id);
    expect(result.ok).toBe(false);
  });

  it("refuse d'émettre un devis sans lignes", async () => {
    const created = await createDraft(db, orgAId, draftInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await db.delete(quoteLines).where(eq(quoteLines.quoteId, created.id));

    const result = await issueQuote(db, orgAId, created.id);
    expect(result.ok).toBe(false);
  });

  it("refuse d'émettre pour un client archivé et ne consomme pas de numéro", async () => {
    const [archived] = await db
      .insert(clients)
      .values({
        organizationId: orgAId,
        type: "company",
        displayName: "Client archivé (numbering)",
        archivedAt: new Date(),
      })
      .returning();

    const created = await createDraft(db, orgAId, draftInput({ clientId: archived.id }));
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const [before] = await db
      .select({ lastNumber: numberSequences.lastNumber })
      .from(numberSequences)
      .where(eq(numberSequences.organizationId, orgAId));

    const result = await issueQuote(db, orgAId, created.id);
    expect(result.ok).toBe(false);

    const [after] = await db
      .select({ lastNumber: numberSequences.lastNumber })
      .from(numberSequences)
      .where(eq(numberSequences.organizationId, orgAId));
    expect(after?.lastNumber ?? 0).toBe(before?.lastNumber ?? 0);
  });

  it("refuse la modification et la suppression après émission", async () => {
    const created = await createDraft(db, orgAId, draftInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await issueQuote(db, orgAId, created.id);

    const updateResult = await updateDraft(db, orgAId, created.id, draftInput());
    expect(updateResult.ok).toBe(false);

    const deleteResult = await deleteDraft(db, orgAId, created.id);
    expect(deleteResult.ok).toBe(false);
  });
});

describe("markRefused", () => {
  it("marque un devis émis comme refusé, avec motif optionnel", async () => {
    const created = await createDraft(db, orgAId, draftInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await issueQuote(db, orgAId, created.id);

    const result = await markRefused(db, orgAId, created.id, "Budget annulé");
    expect(result.ok).toBe(true);

    const found = await getQuoteById(db, orgAId, created.id);
    expect(found?.status).toBe("refused");
    expect(found?.refusalReason).toBe("Budget annulé");
    expect(found?.refusedAt).not.toBeNull();
  });

  it("refuse la transition draft → refused", async () => {
    const created = await createDraft(db, orgAId, draftInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await markRefused(db, orgAId, created.id);
    expect(result.ok).toBe(false);
  });
});

describe("duplicate", () => {
  it("duplique un devis (statut réinitialisé à brouillon)", async () => {
    const created = await createDraft(db, orgAId, draftInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await db.update(quotes).set({ status: "sent" }).where(eq(quotes.id, created.id));

    const result = await duplicate(db, orgAId, created.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const copy = await getQuoteById(db, orgAId, result.id);
    expect(copy?.status).toBe("draft");
    expect(copy?.number).toBeNull();
    expect(copy?.lines).toHaveLength(2);
    expect(copy?.subtotalCents).toBe(25000);
    expect(copy?.id).not.toBe(created.id);
  });
});
