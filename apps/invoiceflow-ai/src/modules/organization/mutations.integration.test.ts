import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createFsStorage } from "@daromsart/storage";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as schema from "../../db/schema";
import { organizations } from "../../db/schema";
import {
  applyAddress,
  applyBank,
  applyDeleteLogo,
  applyIdentity,
  applyLegalFooter,
  applyUploadLogo,
} from "./mutations";

/**
 * Tests d'intégration des mutations organisation (validation + persistance),
 * contre la base de test. `requireAdmin()` / `revalidatePath()` (Next.js) ne
 * sont pas exercés ici — ils nécessitent un contexte de requête ; voir le
 * smoke runtime pour la vérification de bout en bout de la garde admin.
 */
const url = process.env.TEST_DATABASE_URL;
const client = postgres(url ?? "", { max: 1 });
const db = drizzle(client, { schema });

let orgId = "";
let storageDir = "";

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  storageDir = await mkdtemp(join(tmpdir(), "daromsart-org-storage-"));
  const [org] = await db
    .insert(organizations)
    .values({ legalName: "Test Org Mutations" })
    .returning();
  orgId = org.id;
});

afterAll(async () => {
  await db.delete(organizations).where(eq(organizations.id, orgId));
  await client.end({ timeout: 5 });
  await rm(storageDir, { recursive: true, force: true });
});

describe("applyIdentity", () => {
  it("persiste des champs valides", async () => {
    const result = await applyIdentity(db, orgId, {
      legalName: "Daromsart SAS",
      tradeName: "Daromsart",
      siret: "12345678900011",
      vatNumber: "FR12345678900",
      legalForm: "SAS",
      capital: "10000",
      email: "contact@daromsart.test",
      phone: "0102030405",
    });
    expect(result.ok).toBe(true);

    const [row] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId));
    expect(row.legalName).toBe("Daromsart SAS");
    expect(row.email).toBe("contact@daromsart.test");
  });

  it("rejette un nom légal vide (erreurs zod mappées)", async () => {
    const result = await applyIdentity(db, orgId, {
      legalName: "",
      email: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.legalName).toBeDefined();
    }
  });

  it("rejette un email invalide", async () => {
    const result = await applyIdentity(db, orgId, {
      legalName: "Daromsart SAS",
      email: "pas-un-email",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.email).toBeDefined();
    }
  });
});

describe("applyAddress", () => {
  it("persiste une adresse valide", async () => {
    const result = await applyAddress(db, orgId, {
      addressStreet: "1 rue de Paris",
      addressZip: "75001",
      addressCity: "Paris",
      addressCountry: "France",
    });
    expect(result.ok).toBe(true);

    const [row] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId));
    expect(row.addressCity).toBe("Paris");
  });

  it("rejette un pays vide", async () => {
    const result = await applyAddress(db, orgId, { addressCountry: "" });
    expect(result.ok).toBe(false);
  });
});

describe("applyBank", () => {
  it("persiste et normalise un IBAN/BIC valides", async () => {
    const result = await applyBank(db, orgId, {
      iban: "fr76 3000 6000 0112 3456 7890 189",
      bic: "bnpafrpp",
    });
    expect(result.ok).toBe(true);

    const [row] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId));
    expect(row.iban).toBe("FR7630006000011234567890189");
    expect(row.bic).toBe("BNPAFRPP");
  });

  it("rejette un IBAN au checksum invalide", async () => {
    const result = await applyBank(db, orgId, {
      iban: "FR76 3000 6000 0112 3456 7890 188",
      bic: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.iban).toBeDefined();
    }
  });

  it("accepte un IBAN vide (champ optionnel)", async () => {
    const result = await applyBank(db, orgId, { iban: "", bic: "" });
    expect(result.ok).toBe(true);
  });
});

describe("applyLegalFooter", () => {
  it("persiste les mentions légales", async () => {
    const result = await applyLegalFooter(db, orgId, {
      legalFooter: "Mentions personnalisées.",
    });
    expect(result.ok).toBe(true);

    const [row] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId));
    expect(row.legalFooter).toBe("Mentions personnalisées.");
  });
});

describe("applyUploadLogo / applyDeleteLogo", () => {
  it("upload → logo_key en DB, fichier lisible ; delete nettoie", async () => {
    const storage = createFsStorage({ driver: "fs", basePath: storageDir });

    const uploadResult = await applyUploadLogo(
      db,
      storage,
      { id: orgId, logoKey: null },
      { buffer: Buffer.from("fake-png"), contentType: "image/png", size: 8 },
    );
    expect(uploadResult.ok).toBe(true);

    const [afterUpload] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId));
    expect(afterUpload.logoKey).toMatch(/^logos\/.*\.png$/);

    const deleteResult = await applyDeleteLogo(db, storage, {
      id: orgId,
      logoKey: afterUpload.logoKey,
    });
    expect(deleteResult.ok).toBe(true);

    const [afterDelete] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId));
    expect(afterDelete.logoKey).toBeNull();
  });

  it("rejette un fichier trop volumineux", async () => {
    const storage = createFsStorage({ driver: "fs", basePath: storageDir });
    const result = await applyUploadLogo(
      db,
      storage,
      { id: orgId, logoKey: null },
      {
        buffer: Buffer.alloc(3 * 1024 * 1024),
        contentType: "image/png",
        size: 3 * 1024 * 1024,
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.file).toBeDefined();
    }
  });

  it("rejette un type MIME non autorisé", async () => {
    const storage = createFsStorage({ driver: "fs", basePath: storageDir });
    const result = await applyUploadLogo(
      db,
      storage,
      { id: orgId, logoKey: null },
      { buffer: Buffer.from("pdf"), contentType: "application/pdf", size: 3 },
    );
    expect(result.ok).toBe(false);
  });
});
