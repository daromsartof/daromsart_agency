import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createFsStorage } from "@daromsart/storage";
import { DEFAULT_TEMPLATE_OPTIONS } from "@daromsart/core";
import * as schema from "../../db/schema";
import { clients, documentTemplates, invoices, organizations, quotes } from "../../db/schema";
import { createDraft as createQuoteDraft, issueQuote } from "../quotes/mutations";
import { buildQuotePdfInput } from "./pdf";
import { createDraft as createInvoiceDraft, issueInvoice } from "../invoices/mutations";
import { buildInvoicePdfInput } from "../invoices/pdf";
import { createTemplate, setDefaultTemplate } from "../templates/mutations";

/**
 * Story 13 (QR codes) : couvre le point `[I]` du plan — PDF facture avec IBAN
 * + interrupteur ON contient les 2 QR (paiement + lien) ; interrupteur OFF ou
 * IBAN vide → aucun ; devis → uniquement le QR lien (jamais de QR paiement).
 */

const url = process.env.TEST_DATABASE_URL;
const client = postgres(url ?? "", { max: 1 });
const db = drizzle(client, { schema });

let orgId = "";
let orgNoIbanId = "";
let clientId = "";
let clientNoIbanId = "";
let storageDir = "";

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  storageDir = await mkdtemp(join(tmpdir(), "daromsart-qr-storage-"));

  const [org] = await db
    .insert(organizations)
    .values({
      legalName: "Daromsart QR Test SAS",
      iban: "FR7630006000011234567890189",
      bic: "AGRIFRPP",
    })
    .returning();
  orgId = org.id;

  const [orgNoIban] = await db
    .insert(organizations)
    .values({ legalName: "Daromsart QR Sans IBAN SAS" })
    .returning();
  orgNoIbanId = orgNoIban.id;

  const [c] = await db
    .insert(clients)
    .values({ organizationId: orgId, type: "company", displayName: "Client QR Test" })
    .returning();
  clientId = c.id;

  const [cNoIban] = await db
    .insert(clients)
    .values({ organizationId: orgNoIbanId, type: "company", displayName: "Client QR Sans IBAN" })
    .returning();
  clientNoIbanId = cNoIban.id;
});

afterAll(async () => {
  await db.delete(invoices).where(eq(invoices.organizationId, orgId));
  await db.delete(invoices).where(eq(invoices.organizationId, orgNoIbanId));
  await db.delete(quotes).where(eq(quotes.organizationId, orgId));
  await db.delete(documentTemplates).where(eq(documentTemplates.organizationId, orgId));
  await db.delete(clients).where(eq(clients.organizationId, orgId));
  await db.delete(clients).where(eq(clients.organizationId, orgNoIbanId));
  await db.delete(organizations).where(eq(organizations.id, orgId));
  await db.delete(organizations).where(eq(organizations.id, orgNoIbanId));
  await rm(storageDir, { recursive: true, force: true });
  await client.end({ timeout: 5 });
});

const storage = () => createFsStorage({ driver: "fs", basePath: storageDir });

async function templateWithQr(
  organizationId: string,
  type: "invoice" | "quote" | "both",
  showPaymentQr: boolean,
  showPublicLinkQr: boolean,
): Promise<string> {
  const result = await createTemplate(db, organizationId, {
    name: `Modèle QR ${showPaymentQr}/${showPublicLinkQr}`,
    type,
    options: { ...DEFAULT_TEMPLATE_OPTIONS, showPaymentQr, showPublicLinkQr },
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("template creation failed");
  await setDefaultTemplate(db, organizationId, result.id);
  return result.id;
}

describe("QR codes — factures", () => {
  it("IBAN présent + les deux interrupteurs ON → 2 QR (paiement + lien)", async () => {
    await templateWithQr(orgId, "invoice", true, true);

    const created = await createInvoiceDraft(db, orgId, {
      clientId,
      lines: [{ description: "Prestation", quantity: 1, unitPriceCents: 100000, vatRate: 20 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const issued = await issueInvoice(db, orgId, created.id);
    expect(issued.ok).toBe(true);

    const input = await buildInvoicePdfInput(db, storage(), orgId, created.id);
    expect(input?.qrCodes).toHaveLength(2);
    expect(input?.qrCodes?.[0].label).toContain("virement");
    expect(input?.qrCodes?.[1].label).toContain("facture");
  });

  it("interrupteurs OFF → aucun QR même avec IBAN", async () => {
    await templateWithQr(orgId, "invoice", false, false);

    const created = await createInvoiceDraft(db, orgId, {
      clientId,
      lines: [{ description: "Prestation", quantity: 1, unitPriceCents: 50000, vatRate: 20 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await issueInvoice(db, orgId, created.id);

    const input = await buildInvoicePdfInput(db, storage(), orgId, created.id);
    expect(input?.qrCodes).toHaveLength(0);
  });

  it("IBAN vide → jamais de QR de paiement, même interrupteur ON", async () => {
    await templateWithQr(orgNoIbanId, "invoice", true, true);

    const created = await createInvoiceDraft(db, orgNoIbanId, {
      clientId: clientNoIbanId,
      lines: [{ description: "Prestation", quantity: 1, unitPriceCents: 50000, vatRate: 20 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await issueInvoice(db, orgNoIbanId, created.id);

    const input = await buildInvoicePdfInput(db, storage(), orgNoIbanId, created.id);
    // Pas d'IBAN → uniquement le QR lien (le QR paiement est impossible sans IBAN).
    expect(input?.qrCodes).toHaveLength(1);
    expect(input?.qrCodes?.[0].label).toContain("facture");
  });
});

describe("QR codes — devis", () => {
  it("un devis n'a jamais de QR de paiement, même avec l'interrupteur ON", async () => {
    await templateWithQr(orgId, "quote", true, true);

    const created = await createQuoteDraft(db, orgId, {
      clientId,
      lines: [{ description: "Prestation", quantity: 1, unitPriceCents: 50000, vatRate: 20 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await issueQuote(db, orgId, created.id);

    const input = await buildQuotePdfInput(db, storage(), orgId, created.id);
    expect(input?.qrCodes).toHaveLength(1);
    expect(input?.qrCodes?.[0].label).toContain("signer");
  });
});
