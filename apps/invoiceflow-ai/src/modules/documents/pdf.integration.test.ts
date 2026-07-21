import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createFsStorage } from "@daromsart/storage";
import { renderDocumentPdf } from "@daromsart/pdf";
import { DEFAULT_TEMPLATE_OPTIONS } from "@daromsart/core";
import * as schema from "../../db/schema";
import { clients, documentTemplates, organizations, quotes } from "../../db/schema";
import { createDraft, issueQuote } from "../quotes/mutations";
import { createTemplate, setDefaultTemplate } from "../templates/mutations";
import { buildQuotePdfInput } from "./pdf";

const url = process.env.TEST_DATABASE_URL;
const client = postgres(url ?? "", { max: 1 });
const db = drizzle(client, { schema });

let orgId = "";
let clientId = "";
let storageDir = "";

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  storageDir = await mkdtemp(join(tmpdir(), "daromsart-pdf-storage-"));
  const [org] = await db
    .insert(organizations)
    .values({
      legalName: "Daromsart PDF Test SAS",
      addressStreet: "1 rue du Test",
      addressZip: "75000",
      addressCity: "Paris",
      siret: "111 222 333 00011",
    })
    .returning();
  orgId = org.id;

  const [c] = await db
    .insert(clients)
    .values({
      organizationId: orgId,
      type: "company",
      displayName: "Client PDF Test",
      addressStreet: "2 rue du Client",
      addressZip: "69000",
      addressCity: "Lyon",
    })
    .returning();
  clientId = c.id;
});

afterAll(async () => {
  await db.delete(quotes).where(eq(quotes.organizationId, orgId));
  await db.delete(clients).where(eq(clients.organizationId, orgId));
  await db.delete(documentTemplates).where(eq(documentTemplates.organizationId, orgId));
  await db.delete(organizations).where(eq(organizations.id, orgId));
  await rm(storageDir, { recursive: true, force: true });
  await client.end({ timeout: 5 });
});

const storage = () => createFsStorage({ driver: "fs", basePath: storageDir });

describe("buildQuotePdfInput", () => {
  it("construit un DTO complet pour un devis brouillon et le rend en PDF", async () => {
    const created = await createDraft(db, orgId, {
      clientId,
      notes: "Merci de votre confiance.",
      lines: [
        { description: "Prestation A", quantity: 2, unitPriceCents: 10000, vatRate: 20 },
        { description: "Prestation B", quantity: 1, unitPriceCents: 5000, vatRate: 10 },
      ],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const input = await buildQuotePdfInput(db, storage(), orgId, created.id);
    expect(input).not.toBeNull();
    if (!input) return;

    expect(input.organization.legalName).toBe("Daromsart PDF Test SAS");
    expect(input.client.displayName).toBe("Client PDF Test");
    expect(input.meta.number).toBeNull();
    expect(input.lines).toHaveLength(2);
    expect(input.totals.totalCents).toBeGreaterThan(0);
    expect(input.publicUrl).toBeNull();

    const buffer = await renderDocumentPdf(input);
    expect(buffer.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  });

  it("inclut le numéro et le lien public une fois le devis émis", async () => {
    const created = await createDraft(db, orgId, {
      clientId,
      lines: [{ description: "Prestation", quantity: 1, unitPriceCents: 10000, vatRate: 20 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const issued = await issueQuote(db, orgId, created.id);
    expect(issued.ok).toBe(true);

    const input = await buildQuotePdfInput(db, storage(), orgId, created.id);
    expect(input?.meta.number).toBe(issued.ok ? issued.number : null);
    expect(input?.publicUrl).toContain("/p/devis/");
  });

  it("renvoie null pour un devis inconnu", async () => {
    const input = await buildQuotePdfInput(
      db,
      storage(),
      orgId,
      "00000000-0000-0000-0000-000000000000",
    );
    expect(input).toBeNull();
  });

  it("applique les options du modèle explicitement choisi par le devis", async () => {
    const template = await createTemplate(db, orgId, {
      name: "Modèle explicite",
      type: "quote",
      options: { ...DEFAULT_TEMPLATE_OPTIONS, accentColor: "#28C76F", font: "serif" },
    });
    expect(template.ok).toBe(true);
    if (!template.ok) return;

    const created = await createDraft(db, orgId, {
      clientId,
      templateId: template.id,
      lines: [{ description: "Prestation", quantity: 1, unitPriceCents: 10000, vatRate: 20 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const input = await buildQuotePdfInput(db, storage(), orgId, created.id);
    expect(input?.template.accentColor).toBe("#28C76F");
    expect(input?.template.font).toBe("serif");
  });

  it("retombe sur le modèle par défaut de l'organisation si le devis n'en choisit pas", async () => {
    const template = await createTemplate(db, orgId, {
      name: "Modèle par défaut org",
      type: "quote",
      options: { ...DEFAULT_TEMPLATE_OPTIONS, accentColor: "#EA5455" },
    });
    expect(template.ok).toBe(true);
    if (!template.ok) return;
    await setDefaultTemplate(db, orgId, template.id);

    const created = await createDraft(db, orgId, {
      clientId,
      lines: [{ description: "Prestation", quantity: 1, unitPriceCents: 10000, vatRate: 20 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const input = await buildQuotePdfInput(db, storage(), orgId, created.id);
    expect(input?.template.accentColor).toBe("#EA5455");
  });
});
