import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema";
import { clients, organizations } from "../../db/schema";
import { createAgentTools } from "./tools";
import type { ClientsToolOutput, DashboardStatsOutput } from "./tool-types";

const url = process.env.TEST_DATABASE_URL;
const client = postgres(url ?? "", { max: 1 });
const db = drizzle(client, { schema });

let orgA = "";
let orgB = "";

/** Appelle l'`execute` d'un outil sans se battre avec le typage `ToolSet`. */
async function run<T>(organizationId: string, name: string, input: unknown): Promise<T> {
  const tools = createAgentTools(db, organizationId) as Record<
    string,
    { execute: (i: unknown, o: unknown) => Promise<unknown> }
  >;
  return (await tools[name].execute(input, {
    toolCallId: randomUUID(),
    messages: [],
  })) as T;
}

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  const [a] = await db.insert(organizations).values({ legalName: "Org Tools A" }).returning();
  const [b] = await db.insert(organizations).values({ legalName: "Org Tools B" }).returning();
  orgA = a.id;
  orgB = b.id;
  await db.insert(clients).values([
    { organizationId: orgA, type: "company", displayName: "Nova Digital", email: "nova@a.dev" },
    { organizationId: orgA, type: "individual", displayName: "Amandine Roy", email: null },
    { organizationId: orgB, type: "company", displayName: "Autre Client B", email: "x@b.dev" },
  ]);
});

afterAll(async () => {
  await db.delete(clients).where(inArray(clients.organizationId, [orgA, orgB]));
  await db.delete(organizations).where(inArray(organizations.id, [orgA, orgB]));
  await client.end({ timeout: 5 });
});

describe("createAgentTools — listClients", () => {
  it("renvoie uniquement les clients de l'org (isolation) au bon format", async () => {
    const out = await run<ClientsToolOutput>(orgA, "listClients", {});
    expect(out.total).toBe(2);
    const names = out.clients.map((c) => c.name).sort();
    expect(names).toEqual(["Amandine Roy", "Nova Digital"]);
    expect(out.clients.every((c) => "id" in c && "email" in c)).toBe(true);
    expect(out.clients.map((c) => c.name)).not.toContain("Autre Client B");
  });

  it("filtre par recherche", async () => {
    const out = await run<ClientsToolOutput>(orgA, "listClients", { search: "Nova" });
    expect(out.total).toBe(1);
    expect(out.clients[0].name).toBe("Nova Digital");
  });

  it("depuis l'org B ne voit pas les clients de A", async () => {
    const out = await run<ClientsToolOutput>(orgB, "listClients", {});
    expect(out.clients.map((c) => c.name)).toEqual(["Autre Client B"]);
  });
});

describe("createAgentTools — getDashboardStats", () => {
  it("renvoie des montants formatés en euros (org sans facture)", async () => {
    const out = await run<DashboardStatsOutput>(orgA, "getDashboardStats", {});
    expect(out.encaisseMois).toMatch(/€/);
    expect(out.enRetard).toMatch(/€/);
    expect(typeof out.enRetardCount).toBe("number");
  });
});

describe("createAgentTools — listInvoices robustesse cross-provider", () => {
  it("un statut invalide n'échoue pas (coercion en 'all')", async () => {
    const out = await run<{ total: number }>(orgA, "listInvoices", {
      status: "n-importe-quoi",
    });
    expect(out.total).toBe(0);
  });
});
