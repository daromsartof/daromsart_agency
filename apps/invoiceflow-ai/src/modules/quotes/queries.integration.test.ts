import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { DocumentDraftInput } from "@daromsart/core";
import * as schema from "../../db/schema";
import { clients, organizations, quoteLines, quotes } from "../../db/schema";
import { createDraft } from "./mutations";
import { getQuoteStatusCounts, listQuotes, listQuotesForClient } from "./queries";

const url = process.env.TEST_DATABASE_URL;
const client = postgres(url ?? "", { max: 1 });
const db = drizzle(client, { schema });

let orgAId = "";
let orgBId = "";
let clientAId = "";
let clientOtherId = "";

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  const [orgA] = await db
    .insert(organizations)
    .values({ legalName: "Org A Quotes List Test" })
    .returning();
  const [orgB] = await db
    .insert(organizations)
    .values({ legalName: "Org B Quotes List Test" })
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
    lines: [{ description: "X", quantity: 1, unitPriceCents: 1000, vatRate: 20 }],
  };

  await createDraft(db, orgAId, baseInput);
  await createDraft(db, orgAId, baseInput);
  await createDraft(db, orgAId, { ...baseInput, clientId: clientOtherId });

  const [sentQuote] = await createDraft(db, orgAId, baseInput).then((r) =>
    r.ok ? [r.id] : [],
  );
  if (sentQuote) {
    await db.update(quotes).set({ status: "sent" }).where(eq(quotes.id, sentQuote));
  }

  // Bruit dans une autre organisation : ne doit jamais apparaître.
  const [clientB] = await db
    .insert(clients)
    .values({ organizationId: orgBId, type: "company", displayName: "Client B" })
    .returning();
  await createDraft(db, orgBId, { ...baseInput, clientId: clientB.id });
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

describe("listQuotes", () => {
  it("filtre par organisation et statut", async () => {
    const draftOnly = await listQuotes(db, {
      organizationId: orgAId,
      status: "draft",
      page: 1,
      pageSize: 10,
    });
    expect(draftOnly.items.every((q) => q.status === "draft")).toBe(true);
    expect(draftOnly.items.length).toBe(3);

    const sentOnly = await listQuotes(db, {
      organizationId: orgAId,
      status: "sent",
      page: 1,
      pageSize: 10,
    });
    expect(sentOnly.items).toHaveLength(1);
  });

  it("filtre par recherche sur le nom du client", async () => {
    const result = await listQuotes(db, {
      organizationId: orgAId,
      q: "nova",
      page: 1,
      pageSize: 10,
    });
    expect(result.items.every((q) => q.clientName === "Nova Digital")).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
  });

  it("n'expose jamais les devis d'une autre organisation", async () => {
    const result = await listQuotes(db, {
      organizationId: orgAId,
      status: "all",
      page: 1,
      pageSize: 100,
    });
    expect(result.items.every((q) => q.clientName !== "Client B")).toBe(true);
  });

  it("pagine les résultats", async () => {
    const page1 = await listQuotes(db, {
      organizationId: orgAId,
      status: "all",
      page: 1,
      pageSize: 2,
    });
    expect(page1.items).toHaveLength(2);
    expect(page1.pageCount).toBeGreaterThanOrEqual(2);
  });
});

describe("getQuoteStatusCounts", () => {
  it("compte les devis par statut pour l'organisation", async () => {
    const counts = await getQuoteStatusCounts(db, orgAId);
    expect(counts.draft).toBe(3);
    expect(counts.sent).toBe(1);
  });
});

describe("listQuotesForClient", () => {
  it("retourne uniquement les devis du client demandé", async () => {
    const result = await listQuotesForClient(db, orgAId, clientOtherId);
    expect(result).toHaveLength(1);
    expect(result[0].clientId).toBe(clientOtherId);
  });
});
