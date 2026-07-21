import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema";
import { clients, organizations, quotes } from "../../db/schema";
import { createDraft, issueQuote } from "../quotes/mutations";

/**
 * Test dédié à la concurrence réelle (invariant #3, plans/architecture.md :
 * jamais de trou ni de doublon de numérotation). Pool avec plusieurs
 * connexions (contrairement aux autres tests d'intégration, `max: 1`) : on
 * veut que les 20 émissions s'exécutent réellement en parallèle côté
 * Postgres, pour que le verrou `SELECT ... FOR UPDATE` de `issueNumber` soit
 * effectivement mis à l'épreuve plutôt que sérialisé artificiellement par un
 * pool à connexion unique.
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
    .values({ legalName: "Org Numbering Concurrency Test" })
    .returning();
  orgId = org.id;

  const [c] = await db
    .insert(clients)
    .values({ organizationId: orgId, type: "company", displayName: "Client Numbering" })
    .returning();
  clientId = c.id;
});

afterAll(async () => {
  await db.delete(quotes).where(eq(quotes.organizationId, orgId));
  await db.delete(clients).where(eq(clients.organizationId, orgId));
  await db.delete(organizations).where(eq(organizations.id, orgId));
  await client.end({ timeout: 5 });
});

describe("issueQuote — numérotation concurrente", () => {
  it("20 émissions concurrentes produisent 20 numéros consécutifs, sans trou ni doublon", async () => {
    const draftIds: string[] = [];
    for (let i = 0; i < 20; i++) {
      const created = await createDraft(db, orgId, {
        clientId,
        lines: [{ description: `Ligne ${i}`, quantity: 1, unitPriceCents: 1000, vatRate: 20 }],
      });
      expect(created.ok).toBe(true);
      if (created.ok) draftIds.push(created.id);
    }

    const results = await Promise.all(draftIds.map((id) => issueQuote(db, orgId, id)));
    expect(results.every((r) => r.ok)).toBe(true);

    const numbers = results.map((r) => (r.ok ? r.number : "")).sort();
    const year = new Date().getFullYear();
    const expected = Array.from({ length: 20 }, (_, i) =>
      `DEV-${year}-${String(i + 1).padStart(4, "0")}`,
    ).sort();

    expect(numbers).toEqual(expected);
    expect(new Set(numbers).size).toBe(20);
  });
});
