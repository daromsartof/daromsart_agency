import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { PDFDocument } from "pdf-lib";
import { createFsStorage } from "@daromsart/storage";
import * as schema from "../../db/schema";
import { organizations, signableDocuments } from "../../db/schema";
import {
  MAX_UPLOAD_BYTES,
  signSignableDocument,
  uploadSignableDocument,
  type SignatureAnchor,
} from "./mutations";

const url = process.env.TEST_DATABASE_URL;
const client = postgres(url ?? "", { max: 1 });
const db = drizzle(client, { schema });

let orgId = "";
let storageDir = "";

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const TINY_PNG_DATA_URL = `data:image/png;base64,${TINY_PNG_BASE64}`;

async function makePdfBuffer(pageCount = 1): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    pdf.addPage([595, 842]); // A4
  }
  return Buffer.from(await pdf.save());
}

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  storageDir = await mkdtemp(join(tmpdir(), "daromsart-signable-"));
  const [org] = await db
    .insert(organizations)
    .values({ legalName: "Org Signable Test", email: "contact@org-signable-test.fr" })
    .returning();
  orgId = org.id;
});

afterAll(async () => {
  await db.delete(signableDocuments).where(eq(signableDocuments.organizationId, orgId));
  await db.delete(organizations).where(eq(organizations.id, orgId));
  await rm(storageDir, { recursive: true, force: true });
  await client.end({ timeout: 5 });
});

const storage = () => createFsStorage({ driver: "fs", basePath: storageDir });

describe("uploadSignableDocument", () => {
  it("upload un PDF valide : pageCount détecté, original stocké", async () => {
    const buffer = await makePdfBuffer(3);
    const result = await uploadSignableDocument(db, storage(), orgId, {
      filename: "contrat.pdf",
      buffer,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [row] = await db
      .select()
      .from(signableDocuments)
      .where(eq(signableDocuments.id, result.id));
    expect(row.pageCount).toBe(3);
    expect(row.title).toBe("contrat.pdf");
    expect(row.signedAt).toBeNull();

    const stored = await storage().get(row.originalKey);
    expect(stored).not.toBeNull();
  });

  it("refuse un fichier qui ne commence pas par %PDF-", async () => {
    const result = await uploadSignableDocument(db, storage(), orgId, {
      filename: "faux.pdf",
      buffer: Buffer.from("pas un pdf du tout"),
    });
    expect(result.ok).toBe(false);
  });

  it("refuse un fichier vide", async () => {
    const result = await uploadSignableDocument(db, storage(), orgId, {
      filename: "vide.pdf",
      buffer: Buffer.alloc(0),
    });
    expect(result.ok).toBe(false);
  });

  it("refuse un fichier trop volumineux", async () => {
    const oversized = Buffer.concat([
      Buffer.from("%PDF-1.4\n"),
      Buffer.alloc(MAX_UPLOAD_BYTES),
    ]);
    const result = await uploadSignableDocument(db, storage(), orgId, {
      filename: "trop-gros.pdf",
      buffer: oversized,
    });
    expect(result.ok).toBe(false);
  });

  it("refuse un PDF corrompu (magic bytes valides mais contenu invalide)", async () => {
    const result = await uploadSignableDocument(db, storage(), orgId, {
      filename: "corrompu.pdf",
      buffer: Buffer.from("%PDF-1.4\nceci n'est pas un vrai PDF"),
    });
    expect(result.ok).toBe(false);
  });
});

async function uploadedDoc(pageCount = 2) {
  const buffer = await makePdfBuffer(pageCount);
  const result = await uploadSignableDocument(db, storage(), orgId, {
    filename: "a-signer.pdf",
    buffer,
  });
  if (!result.ok) throw new Error("upload failed");
  return result.id;
}

const ALL_ANCHORS: SignatureAnchor[] = [
  "bas-gauche",
  "bas-centre",
  "bas-droite",
  "haut-gauche",
  "centre",
  "haut-droite",
];

describe("signSignableDocument", () => {
  it("signe : PDF fusionné stocké, signedKey/signerName/signedAt posés", async () => {
    const id = await uploadedDoc();
    const result = await signSignableDocument(db, storage(), orgId, id, {
      signerName: "Jean Dupont",
      pngDataUrl: TINY_PNG_DATA_URL,
      page: 1,
      anchor: "bas-droite",
    });
    expect(result.ok).toBe(true);

    const [row] = await db
      .select()
      .from(signableDocuments)
      .where(eq(signableDocuments.id, id));
    expect(row.signerName).toBe("Jean Dupont");
    expect(row.signedAt).not.toBeNull();
    expect(row.signedKey).toBeTruthy();

    const signedBuffer = await storage().get(row.signedKey!);
    expect(signedBuffer).not.toBeNull();
    expect(signedBuffer!.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  });

  it.each(ALL_ANCHORS)("accepte l'ancre %s sans erreur", async (anchor) => {
    const id = await uploadedDoc();
    const result = await signSignableDocument(db, storage(), orgId, id, {
      signerName: "Jean Dupont",
      pngDataUrl: TINY_PNG_DATA_URL,
      page: 1,
      anchor,
    });
    expect(result.ok).toBe(true);
  });

  it("refuse une seconde signature (déjà signé)", async () => {
    const id = await uploadedDoc();
    const first = await signSignableDocument(db, storage(), orgId, id, {
      signerName: "Jean Dupont",
      pngDataUrl: TINY_PNG_DATA_URL,
      page: 1,
      anchor: "bas-droite",
    });
    expect(first.ok).toBe(true);

    const second = await signSignableDocument(db, storage(), orgId, id, {
      signerName: "Quelqu'un d'autre",
      pngDataUrl: TINY_PNG_DATA_URL,
      page: 1,
      anchor: "bas-droite",
    });
    expect(second.ok).toBe(false);
  });

  it("refuse un numéro de page invalide", async () => {
    const id = await uploadedDoc(2);
    const result = await signSignableDocument(db, storage(), orgId, id, {
      signerName: "Jean Dupont",
      pngDataUrl: TINY_PNG_DATA_URL,
      page: 3,
      anchor: "bas-droite",
    });
    expect(result.ok).toBe(false);
  });

  it("refuse pour un autre organizationId (org-scopé)", async () => {
    const [otherOrg] = await db
      .insert(organizations)
      .values({ legalName: "Autre Org", email: "autre@example.fr" })
      .returning();
    const id = await uploadedDoc();
    const result = await signSignableDocument(db, storage(), otherOrg.id, id, {
      signerName: "Jean Dupont",
      pngDataUrl: TINY_PNG_DATA_URL,
      page: 1,
      anchor: "bas-droite",
    });
    expect(result.ok).toBe(false);
    await db.delete(organizations).where(eq(organizations.id, otherOrg.id));
  });

  it("refuse une signature au format PNG invalide", async () => {
    const id = await uploadedDoc();
    const result = await signSignableDocument(db, storage(), orgId, id, {
      signerName: "Jean Dupont",
      pngDataUrl: "data:text/plain;base64,bm90LWEtcG5n",
      page: 1,
      anchor: "bas-droite",
    });
    expect(result.ok).toBe(false);
  });

  it("accepte un placement libre x/y/w/h", async () => {
    const id = await uploadedDoc();
    const result = await signSignableDocument(db, storage(), orgId, id, {
      signerName: "Jean Dupont",
      pngDataUrl: TINY_PNG_DATA_URL,
      page: 1,
      placement: { x: 80, y: 120, width: 200, height: 80 },
    });
    expect(result.ok).toBe(true);
  });
});
