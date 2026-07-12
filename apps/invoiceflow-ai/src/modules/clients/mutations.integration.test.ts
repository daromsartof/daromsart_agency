import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema";
import { clientContacts, clients, organizations } from "../../db/schema";
import { getClientById, listClients } from "./queries";
import {
  archiveClient,
  createClient,
  unarchiveClient,
  updateClient,
} from "./mutations";

const url = process.env.TEST_DATABASE_URL;
const client = postgres(url ?? "", { max: 1 });
const db = drizzle(client, { schema });

let orgAId = "";
let orgBId = "";

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  const [orgA] = await db
    .insert(organizations)
    .values({ legalName: "Org A Clients Test" })
    .returning();
  const [orgB] = await db
    .insert(organizations)
    .values({ legalName: "Org B Clients Test" })
    .returning();
  orgAId = orgA.id;
  orgBId = orgB.id;
});

afterAll(async () => {
  await db.delete(clients).where(eq(clients.organizationId, orgAId));
  await db.delete(clients).where(eq(clients.organizationId, orgBId));
  await db.delete(organizations).where(eq(organizations.id, orgAId));
  await db.delete(organizations).where(eq(organizations.id, orgBId));
  await client.end({ timeout: 5 });
});

describe("createClient", () => {
  it("crée un client avec 2 contacts", async () => {
    const result = await createClient(db, orgAId, {
      type: "company",
      displayName: "Nova Digital",
      addressCountry: "France",
      contacts: [
        { name: "Sophie Martin", email: "sophie@nova.io" },
        { name: "Marc Ferrand", email: "marc@nova.io" },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const found = await getClientById(db, orgAId, result.id);
    expect(found?.displayName).toBe("Nova Digital");
    expect(found?.contacts).toHaveLength(2);
  });

  it("rejette un nom vide (erreurs zod mappées)", async () => {
    const result = await createClient(db, orgAId, {
      type: "individual",
      displayName: "",
      addressCountry: "France",
      contacts: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.displayName).toBeDefined();
    }
  });
});

describe("updateClient", () => {
  it("met à jour et applique un diff de contacts (ajout + suppression)", async () => {
    const created = await createClient(db, orgAId, {
      type: "company",
      displayName: "Studio Pixel",
      addressCountry: "France",
      contacts: [{ name: "Contact A", email: "a@studiopixel.fr" }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const before = await getClientById(db, orgAId, created.id);
    const keptContact = before!.contacts[0];

    const updateResult = await updateClient(db, orgAId, created.id, {
      type: "company",
      displayName: "Studio Pixel SAS",
      addressCountry: "France",
      contacts: [
        { id: keptContact.id, name: "Contact A (maj)", email: "a@studiopixel.fr" },
        { name: "Contact B", email: "b@studiopixel.fr" },
      ],
    });
    expect(updateResult.ok).toBe(true);

    const after = await getClientById(db, orgAId, created.id);
    expect(after?.displayName).toBe("Studio Pixel SAS");
    expect(after?.contacts).toHaveLength(2);
    expect(after?.contacts.map((c) => c.name).sort()).toEqual([
      "Contact A (maj)",
      "Contact B",
    ]);
  });

  it("refuse une mise à jour ciblant un client d'une autre organisation", async () => {
    const created = await createClient(db, orgAId, {
      type: "individual",
      displayName: "Client Org A",
      addressCountry: "France",
      contacts: [],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await updateClient(db, orgBId, created.id, {
      type: "individual",
      displayName: "Tentative depuis org B",
      addressCountry: "France",
      contacts: [],
    });
    expect(result.ok).toBe(false);

    const unchanged = await getClientById(db, orgAId, created.id);
    expect(unchanged?.displayName).toBe("Client Org A");
  });
});

describe("archiveClient / unarchiveClient", () => {
  it("archive puis désarchive un client", async () => {
    const created = await createClient(db, orgAId, {
      type: "individual",
      displayName: "Client à archiver",
      addressCountry: "France",
      contacts: [],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const archiveResult = await archiveClient(db, orgAId, created.id);
    expect(archiveResult.ok).toBe(true);
    let found = await getClientById(db, orgAId, created.id);
    expect(found?.archivedAt).not.toBeNull();

    const unarchiveResult = await unarchiveClient(db, orgAId, created.id);
    expect(unarchiveResult.ok).toBe(true);
    found = await getClientById(db, orgAId, created.id);
    expect(found?.archivedAt).toBeNull();
  });

  it("refuse d'archiver un client d'une autre organisation", async () => {
    const created = await createClient(db, orgAId, {
      type: "individual",
      displayName: "Client protégé",
      addressCountry: "France",
      contacts: [],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await archiveClient(db, orgBId, created.id);
    expect(result.ok).toBe(false);
  });
});

describe("listClients", () => {
  it("filtre par organisation, recherche et archivage", async () => {
    await createClient(db, orgAId, {
      type: "company",
      displayName: "Dupont Frères",
      addressCountry: "France",
      contacts: [],
    });
    const archived = await createClient(db, orgAId, {
      type: "company",
      displayName: "Dupont Archivé",
      addressCountry: "France",
      contacts: [],
    });
    expect(archived.ok).toBe(true);
    if (archived.ok) await archiveClient(db, orgAId, archived.id);

    const activeOnly = await listClients(db, {
      organizationId: orgAId,
      q: "dupont",
      page: 1,
      pageSize: 10,
    });
    expect(activeOnly.items.map((c) => c.displayName)).toEqual([
      "Dupont Frères",
    ]);

    const withArchived = await listClients(db, {
      organizationId: orgAId,
      q: "dupont",
      includeArchived: true,
      page: 1,
      pageSize: 10,
    });
    expect(withArchived.items).toHaveLength(2);
  });

  it("pagine les résultats", async () => {
    for (let i = 0; i < 5; i++) {
      await createClient(db, orgBId, {
        type: "individual",
        displayName: `Client Pagination ${i}`,
        addressCountry: "France",
        contacts: [],
      });
    }
    const page1 = await listClients(db, {
      organizationId: orgBId,
      page: 1,
      pageSize: 2,
    });
    expect(page1.items).toHaveLength(2);
    expect(page1.pageCount).toBeGreaterThanOrEqual(3);

    const page2 = await listClients(db, {
      organizationId: orgBId,
      page: 2,
      pageSize: 2,
    });
    expect(page2.items).toHaveLength(2);
    expect(page2.items[0].id).not.toBe(page1.items[0].id);
  });
});
