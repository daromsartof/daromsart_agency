import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema";
import { clients, invoiceLines, invoices, organizations, quoteLines, quotes } from "../../db/schema";
import { convertToInvoice, createDraft } from "./mutations";

/**
 * Test dédié à la concurrence réelle (parade « double conversion
 * concurrente », plans/story-17.md) : pool multi-connexions (contrairement
 * aux autres tests d'intégration, `max: 1`) pour que le verrou
 * `SELECT ... FOR UPDATE` sur la ligne devis (`convertToInvoice`) soit
 * effectivement mis à l'épreuve — même pattern que `numbering.integration.
 * test.ts` (story 08) et `payments-concurrency.integration.test.ts` (story 15).
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
    .values({ legalName: "Org Convert Concurrency Test" })
    .returning();
  orgId = org.id;

  const [c] = await db
    .insert(clients)
    .values({ organizationId: orgId, type: "company", displayName: "Client Convert Concurrency" })
    .returning();
  clientId = c.id;
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

describe("convertToInvoice — concurrence réelle", () => {
  it("2 conversions simultanées du même devis signé : une seule aboutit", async () => {
    const created = await createDraft(db, orgId, {
      clientId,
      lines: [{ description: "Prestation", quantity: 1, unitPriceCents: 10000, vatRate: 20 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await db.update(quotes).set({ status: "signed" }).where(eq(quotes.id, created.id));

    const [resultA, resultB] = await Promise.all([
      convertToInvoice(db, orgId, created.id),
      convertToInvoice(db, orgId, created.id),
    ]);
    const outcomes = [resultA, resultB];
    expect(outcomes.filter((r) => r.ok)).toHaveLength(1);
    expect(outcomes.filter((r) => !r.ok)).toHaveLength(1);

    const invoicesForQuote = await db
      .select()
      .from(invoices)
      .where(eq(invoices.quoteId, created.id));
    expect(invoicesForQuote).toHaveLength(1);
  });
});
