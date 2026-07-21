import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { DEFAULT_TEMPLATE_OPTIONS, type TemplateInput } from "@daromsart/core";
import * as schema from "../../db/schema";
import { clients, documentTemplates, organizations, quoteLines, quotes } from "../../db/schema";
import { createDraft } from "../quotes/mutations";
import { getDefaultTemplate, getTemplateById, listTemplates } from "./queries";
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  setDefaultTemplate,
  updateTemplate,
} from "./mutations";

const url = process.env.TEST_DATABASE_URL;
const client = postgres(url ?? "", { max: 5 });
const db = drizzle(client, { schema });

let orgId = "";
let clientId = "";

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  const [org] = await db
    .insert(organizations)
    .values({ legalName: "Org Templates Test" })
    .returning();
  orgId = org.id;

  const [c] = await db
    .insert(clients)
    .values({ organizationId: orgId, type: "company", displayName: "Client Templates" })
    .returning();
  clientId = c.id;
});

afterAll(async () => {
  await db.delete(quoteLines);
  await db.delete(quotes).where(eq(quotes.organizationId, orgId));
  await db.delete(clients).where(eq(clients.organizationId, orgId));
  await db.delete(documentTemplates).where(eq(documentTemplates.organizationId, orgId));
  await db.delete(organizations).where(eq(organizations.id, orgId));
  await client.end({ timeout: 5 });
});

function templateInput(overrides: Partial<TemplateInput> = {}): TemplateInput {
  return {
    name: "Modèle Test",
    type: "both",
    options: DEFAULT_TEMPLATE_OPTIONS,
    ...overrides,
  };
}

describe("createTemplate / updateTemplate", () => {
  it("crée un modèle avec les options fournies", async () => {
    const result = await createTemplate(
      db,
      orgId,
      templateInput({ name: "Classique", options: { ...DEFAULT_TEMPLATE_OPTIONS, accentColor: "#111111" } }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const found = await getTemplateById(db, orgId, result.id);
    expect(found?.name).toBe("Classique");
    expect(found?.options.accentColor).toBe("#111111");
  });

  it("rejette un nom vide", async () => {
    const result = await createTemplate(db, orgId, templateInput({ name: "  " }));
    expect(result.ok).toBe(false);
  });

  it("met à jour un modèle existant", async () => {
    const created = await createTemplate(db, orgId, templateInput({ name: "À modifier" }));
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await updateTemplate(
      db,
      orgId,
      created.id,
      templateInput({ name: "Modifié", options: { ...DEFAULT_TEMPLATE_OPTIONS, font: "serif" } }),
    );
    expect(result.ok).toBe(true);

    const found = await getTemplateById(db, orgId, created.id);
    expect(found?.name).toBe("Modifié");
    expect(found?.options.font).toBe("serif");
  });
});

describe("duplicateTemplate", () => {
  it("copie le nom (suffixé), le type et les options", async () => {
    const created = await createTemplate(
      db,
      orgId,
      templateInput({
        name: "Source",
        type: "quote",
        options: { ...DEFAULT_TEMPLATE_OPTIONS, accentColor: "#28C76F", font: "serif" },
      }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await duplicateTemplate(db, orgId, created.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const copy = await getTemplateById(db, orgId, result.id);
    expect(copy?.name).toBe("Source (copie)");
    expect(copy?.type).toBe("quote");
    expect(copy?.isDefault).toBe(false);
    expect(copy?.options.accentColor).toBe("#28C76F");
    expect(copy?.options.font).toBe("serif");
    expect(copy?.id).not.toBe(created.id);
  });
});

describe("setDefaultTemplate", () => {
  it("un seul défaut effectif après des appels concurrents, y compris entre types qui se chevauchent", async () => {
    const quoteTemplate = await createTemplate(
      db,
      orgId,
      templateInput({ name: "Devis A", type: "quote" }),
    );
    const invoiceTemplate = await createTemplate(
      db,
      orgId,
      templateInput({ name: "Facture A", type: "invoice" }),
    );
    const bothTemplate = await createTemplate(
      db,
      orgId,
      templateInput({ name: "Both A", type: "both" }),
    );
    expect(quoteTemplate.ok && invoiceTemplate.ok && bothTemplate.ok).toBe(true);
    if (!quoteTemplate.ok || !invoiceTemplate.ok || !bothTemplate.ok) return;

    await setDefaultTemplate(db, orgId, quoteTemplate.id);
    await setDefaultTemplate(db, orgId, invoiceTemplate.id);

    // `both` devient défaut → doit dé-défaut À LA FOIS quoteTemplate ET invoiceTemplate.
    const results = await Promise.all([
      setDefaultTemplate(db, orgId, bothTemplate.id),
      setDefaultTemplate(db, orgId, bothTemplate.id),
    ]);
    expect(results.every((r) => r.ok)).toBe(true);

    const all = await listTemplates(db, orgId);
    const defaults = all.filter((t) => t.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(bothTemplate.id);

    const defaultForQuote = await getDefaultTemplate(db, orgId, "quote");
    const defaultForInvoice = await getDefaultTemplate(db, orgId, "invoice");
    expect(defaultForQuote?.id).toBe(bothTemplate.id);
    expect(defaultForInvoice?.id).toBe(bothTemplate.id);
  });

  it("redéfinir un défaut spécifique dé-défaut le `both` précédent", async () => {
    const both = await createTemplate(db, orgId, templateInput({ name: "Both B", type: "both" }));
    const quoteOnly = await createTemplate(
      db,
      orgId,
      templateInput({ name: "Devis B", type: "quote" }),
    );
    expect(both.ok && quoteOnly.ok).toBe(true);
    if (!both.ok || !quoteOnly.ok) return;

    await setDefaultTemplate(db, orgId, both.id);
    await setDefaultTemplate(db, orgId, quoteOnly.id);

    const bothRow = await getTemplateById(db, orgId, both.id);
    const quoteRow = await getTemplateById(db, orgId, quoteOnly.id);
    expect(bothRow?.isDefault).toBe(false);
    expect(quoteRow?.isDefault).toBe(true);
  });
});

describe("deleteTemplate", () => {
  it("supprime un modèle non référencé", async () => {
    const created = await createTemplate(db, orgId, templateInput({ name: "À supprimer" }));
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await deleteTemplate(db, orgId, created.id);
    expect(result.ok).toBe(true);

    const found = await getTemplateById(db, orgId, created.id);
    expect(found).toBeNull();
  });

  it("refuse de supprimer un modèle référencé par un devis", async () => {
    const created = await createTemplate(db, orgId, templateInput({ name: "Utilisé" }));
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const draft = await createDraft(db, orgId, {
      clientId,
      templateId: created.id,
      lines: [{ description: "Ligne", quantity: 1, unitPriceCents: 1000, vatRate: 20 }],
    });
    expect(draft.ok).toBe(true);

    const result = await deleteTemplate(db, orgId, created.id);
    expect(result.ok).toBe(false);

    const found = await getTemplateById(db, orgId, created.id);
    expect(found).not.toBeNull();
  });
});
