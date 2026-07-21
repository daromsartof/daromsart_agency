import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createFsStorage } from "@daromsart/storage";
import { renderDocumentPdf } from "@daromsart/pdf";
import * as schema from "../../db/schema";
import { clients, invoices, organizations } from "../../db/schema";
import { createDraft, issueInvoice } from "./mutations";
import { createCreditNoteDraft, issueCreditNote } from "./credit-notes";
import { buildInvoicePdfInput, resolveInvoicePdfBuffer } from "./pdf";

const url = process.env.TEST_DATABASE_URL;
const client = postgres(url ?? "", { max: 1 });
const db = drizzle(client, { schema });

let orgId = "";
let clientId = "";
let storageDir = "";

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  storageDir = await mkdtemp(join(tmpdir(), "daromsart-invoice-pdf-storage-"));
  const [org] = await db
    .insert(organizations)
    .values({
      legalName: "Daromsart Facture PDF Test SAS",
      addressStreet: "1 rue du Test",
      addressZip: "75000",
      addressCity: "Paris",
      siret: "111 222 333 00011",
      iban: "FR7630006000011234567890189",
      bic: "AGRIFRPP",
    })
    .returning();
  orgId = org.id;

  const [c] = await db
    .insert(clients)
    .values({
      organizationId: orgId,
      type: "company",
      displayName: "Client Facture PDF Test",
      addressStreet: "2 rue du Client",
      addressZip: "69000",
      addressCity: "Lyon",
    })
    .returning();
  clientId = c.id;
});

afterAll(async () => {
  await db.delete(invoices).where(eq(invoices.organizationId, orgId));
  await db.delete(clients).where(eq(clients.organizationId, orgId));
  await db.delete(organizations).where(eq(organizations.id, orgId));
  await rm(storageDir, { recursive: true, force: true });
  await client.end({ timeout: 5 });
});

const storage = () => createFsStorage({ driver: "fs", basePath: storageDir });

describe("buildInvoicePdfInput", () => {
  it("construit un DTO complet pour une facture brouillon et le rend en PDF", async () => {
    const created = await createDraft(db, orgId, {
      clientId,
      lines: [
        { description: "Prestation A", quantity: 2, unitPriceCents: 10000, vatRate: 20 },
      ],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const input = await buildInvoicePdfInput(db, storage(), orgId, created.id);
    expect(input).not.toBeNull();
    if (!input) return;

    expect(input.meta.kind).toBe("invoice");
    expect(input.organization.legalName).toBe("Daromsart Facture PDF Test SAS");
    expect(input.organization.iban).toBe("FR7630006000011234567890189");
    expect(input.client.displayName).toBe("Client Facture PDF Test");

    const buffer = await renderDocumentPdf(input);
    expect(buffer.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  });

  it("inclut le numéro FAC- et le lien public une fois la facture émise", async () => {
    const created = await createDraft(db, orgId, {
      clientId,
      lines: [{ description: "Prestation", quantity: 1, unitPriceCents: 10000, vatRate: 20 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const issued = await issueInvoice(db, orgId, created.id);
    expect(issued.ok).toBe(true);

    const input = await buildInvoicePdfInput(db, storage(), orgId, created.id);
    expect(input?.meta.number).toBe(issued.ok ? issued.number : null);
    expect(input?.meta.number).toMatch(/^FAC-/);
    expect(input?.publicUrl).toContain("/p/factures/");
  });

  it("H7 — le PDF d'une facture émise utilise le snapshot figé, jamais le client renommé après coup", async () => {
    const created = await createDraft(db, orgId, {
      clientId,
      lines: [{ description: "Prestation", quantity: 1, unitPriceCents: 10000, vatRate: 20 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const issued = await issueInvoice(db, orgId, created.id);
    expect(issued.ok).toBe(true);

    // Renommage du client APRÈS l'émission — ne doit jamais atteindre un PDF déjà émis.
    await db
      .update(clients)
      .set({ displayName: "Client renommé après émission" })
      .where(eq(clients.id, clientId));

    const input = await buildInvoicePdfInput(db, storage(), orgId, created.id);
    expect(input?.client.displayName).toBe("Client Facture PDF Test");
  });

  it("renvoie null pour une facture inconnue", async () => {
    const input = await buildInvoicePdfInput(
      db,
      storage(),
      orgId,
      "00000000-0000-0000-0000-000000000000",
    );
    expect(input).toBeNull();
  });

  it("avoir (story 18) : kind = credit_note, pas d'échéance, référence la facture d'origine", async () => {
    const created = await createDraft(db, orgId, {
      clientId,
      lines: [{ description: "Prestation", quantity: 1, unitPriceCents: 10000, vatRate: 20 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const issued = await issueInvoice(db, orgId, created.id);
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;

    const draft = await createCreditNoteDraft(db, orgId, created.id);
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    const issuedCreditNote = await issueCreditNote(db, orgId, draft.id);
    expect(issuedCreditNote.ok).toBe(true);
    if (!issuedCreditNote.ok) return;

    const input = await buildInvoicePdfInput(db, storage(), orgId, draft.id);
    expect(input).not.toBeNull();
    if (!input) return;

    expect(input.meta.kind).toBe("credit_note");
    expect(input.meta.number).toBe(issuedCreditNote.number);
    expect(input.meta.number).toMatch(/^AV-/);
    expect(input.meta.dueOrValidUntil).toBeNull();
    expect(input.meta.title).toContain(issued.number);
    expect(input.totals.totalCents).toBeLessThan(0);

    const buffer = await renderDocumentPdf(input);
    expect(buffer.subarray(0, 5).toString("utf8")).toBe("%PDF-");

    const file = await resolveInvoicePdfBuffer(db, storage(), orgId, draft.id);
    expect(file?.filename).toMatch(/^avoir-AV-/);
  });
});
