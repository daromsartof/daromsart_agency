import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema";
import { clients, organizations } from "../../db/schema";
import { getClientDetail, getClientStats } from "./queries";

const url = process.env.TEST_DATABASE_URL;
const client = postgres(url ?? "", { max: 1 });
const db = drizzle(client, { schema });

let orgAId = "";
let orgBId = "";
let clientAId = "";

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  const [orgA] = await db
    .insert(organizations)
    .values({ legalName: "Org A Detail Test" })
    .returning();
  const [orgB] = await db
    .insert(organizations)
    .values({ legalName: "Org B Detail Test" })
    .returning();
  orgAId = orgA.id;
  orgBId = orgB.id;

  const [c] = await db
    .insert(clients)
    .values({
      organizationId: orgAId,
      type: "company",
      displayName: "Fiche Client Test",
    })
    .returning();
  clientAId = c.id;
});

afterAll(async () => {
  await db.delete(clients).where(eq(clients.organizationId, orgAId));
  await db.delete(organizations).where(eq(organizations.id, orgAId));
  await db.delete(organizations).where(eq(organizations.id, orgBId));
  await client.end({ timeout: 5 });
});

describe("getClientDetail", () => {
  it("retourne le client avec ses contacts pour la bonne organisation", async () => {
    const found = await getClientDetail(db, orgAId, clientAId);
    expect(found?.displayName).toBe("Fiche Client Test");
    expect(found?.contacts).toEqual([]);
  });

  it("retourne null si le client appartient à une autre organisation", async () => {
    const found = await getClientDetail(db, orgBId, clientAId);
    expect(found).toBeNull();
  });

  it("retourne null pour un id inconnu", async () => {
    const found = await getClientDetail(
      db,
      orgAId,
      "00000000-0000-0000-0000-000000000000",
    );
    expect(found).toBeNull();
  });
});

describe("getClientStats", () => {
  it("retourne des zéros pour un client sans facture (calcul réel, story 12)", async () => {
    const stats = await getClientStats(db, orgAId, clientAId);
    expect(stats).toEqual({
      caFactureCents: 0,
      encoursCents: 0,
      retardCents: 0,
    });
  });
});
