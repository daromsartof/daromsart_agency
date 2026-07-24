import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createFsStorage } from "@daromsart/storage";
import type { Mailer } from "@daromsart/email";
import * as schema from "../../db/schema";
import { clients, emailLogs, invoices, organizations, quotes, signatures } from "../../db/schema";
import { createDraft, issueQuote } from "../quotes/mutations";
import { getQuoteById } from "../quotes/queries";
import { createDraft as createInvoiceDraft, issueInvoice } from "../invoices/mutations";
import { getInvoiceById } from "../invoices/queries";
import { getQuoteByToken } from "./queries";
import { markViewed, refuseQuote, signInvoice, signQuote } from "./mutations";

const url = process.env.TEST_DATABASE_URL;
const client = postgres(url ?? "", { max: 1 });
const db = drizzle(client, { schema });

let orgId = "";
let clientId = "";
let storageDir = "";

const okMailer: Mailer = {
  async sendDocumentEmail() {
    return { ok: true, id: "resend_fake", mode: "resend" };
  },
  async sendResetPasswordEmail() {
    return { ok: true, id: "resend_fake", mode: "resend" };
  },
  async sendSignatureConfirmation() {
    return { ok: true, id: "resend_fake", mode: "resend" };
  },
  async sendReminderEmail() {
    return { ok: true, id: "resend_fake", mode: "resend" };
  },
  async sendInviteEmail() {
    return { ok: true, id: "resend_fake", mode: "resend" };
  },
};

// Un pixel PNG transparent valide (signature de test).
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const TINY_PNG_DATA_URL = `data:image/png;base64,${TINY_PNG_BASE64}`;

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  storageDir = await mkdtemp(join(tmpdir(), "daromsart-public-"));
  const [org] = await db
    .insert(organizations)
    .values({ legalName: "Org Public Test", email: "contact@org-public-test.fr" })
    .returning();
  orgId = org.id;

  const [c] = await db
    .insert(clients)
    .values({
      organizationId: orgId,
      type: "company",
      displayName: "Client Public Test",
      email: "client@example.com",
    })
    .returning();
  clientId = c.id;
});

afterAll(async () => {
  await db.delete(signatures);
  await db.delete(emailLogs).where(eq(emailLogs.organizationId, orgId));
  await db.delete(invoices).where(eq(invoices.organizationId, orgId));
  await db.delete(quotes).where(eq(quotes.organizationId, orgId));
  await db.delete(clients).where(eq(clients.organizationId, orgId));
  await db.delete(organizations).where(eq(organizations.id, orgId));
  await rm(storageDir, { recursive: true, force: true });
  await client.end({ timeout: 5 });
});

const storage = () => createFsStorage({ driver: "fs", basePath: storageDir });

async function issuedQuote(overrides: { validUntil?: Date } = {}) {
  const created = await createDraft(db, orgId, {
    clientId,
    validUntil: overrides.validUntil,
    lines: [{ description: "Prestation", quantity: 1, unitPriceCents: 10000, vatRate: 20 }],
  });
  if (!created.ok) throw new Error("createDraft failed");
  const issued = await issueQuote(db, orgId, created.id);
  if (!issued.ok) throw new Error("issueQuote failed");
  const quote = await getQuoteById(db, orgId, created.id);
  if (!quote?.shareToken) throw new Error("no share token");
  return quote;
}

async function issuedInvoice() {
  const created = await createInvoiceDraft(db, orgId, {
    clientId,
    lines: [{ description: "Prestation", quantity: 1, unitPriceCents: 10000, vatRate: 20 }],
  });
  if (!created.ok) throw new Error("createDraft (invoice) failed");
  const issued = await issueInvoice(db, orgId, created.id);
  if (!issued.ok) throw new Error("issueInvoice failed");
  const invoice = await getInvoiceById(db, orgId, created.id);
  if (!invoice?.shareToken) throw new Error("no share token");
  return invoice;
}

describe("getQuoteByToken", () => {
  it("renvoie null pour un token inconnu", async () => {
    const result = await getQuoteByToken(db, "token-inexistant");
    expect(result).toBeNull();
  });
});

describe("markViewed", () => {
  it("fait passer sent → viewed la première fois, idempotent ensuite", async () => {
    const quote = await issuedQuote();
    await markViewed(db, quote.id);
    const after1 = await getQuoteById(db, orgId, quote.id);
    expect(after1?.status).toBe("viewed");
    expect(after1?.viewedAt).not.toBeNull();

    const viewedAtFirst = after1?.viewedAt;
    await markViewed(db, quote.id);
    const after2 = await getQuoteById(db, orgId, quote.id);
    expect(after2?.status).toBe("viewed");
    expect(after2?.viewedAt?.getTime()).toBe(viewedAtFirst?.getTime());
  });
});

describe("signQuote", () => {
  it("signe : Signature créée, statut signed, PNG + PDF stockés, hash cohérent, events + 2 emails", async () => {
    const quote = await issuedQuote();

    const result = await signQuote(db, storage(), okMailer, quote.shareToken!, {
      name: "Jean Dupont",
      email: "jean.dupont@example.com",
      pngDataUrl: TINY_PNG_DATA_URL,
    });
    expect(result.ok).toBe(true);

    const after = await getQuoteById(db, orgId, quote.id);
    expect(after?.status).toBe("signed");
    expect(after?.pdfSignedKey).toBeTruthy();
    expect(after?.pdfHash).toBeTruthy();

    const [sig] = await db.select().from(signatures).where(eq(signatures.quoteId, quote.id));
    expect(sig.signerName).toBe("Jean Dupont");
    expect(sig.imageKey).toBeTruthy();

    const archived = await storage().get(after!.pdfSignedKey!);
    expect(archived).not.toBeNull();
    const recomputedHash = createHash("sha256").update(archived!).digest("hex");
    expect(recomputedHash).toBe(after?.pdfHash);

    const logs = await db.select().from(emailLogs).where(eq(emailLogs.documentId, quote.id));
    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(logs.every((l) => l.status === "sent")).toBe(true);
  });

  it("refuse une seconde signature (déjà signé)", async () => {
    const quote = await issuedQuote();
    const first = await signQuote(db, storage(), okMailer, quote.shareToken!, {
      name: "Jean Dupont",
      pngDataUrl: TINY_PNG_DATA_URL,
    });
    expect(first.ok).toBe(true);

    const second = await signQuote(db, storage(), okMailer, quote.shareToken!, {
      name: "Quelqu'un d'autre",
      pngDataUrl: TINY_PNG_DATA_URL,
    });
    expect(second.ok).toBe(false);
  });

  it("refuse la signature d'un devis expiré", async () => {
    const past = new Date();
    past.setFullYear(past.getFullYear() - 1);
    const quote = await issuedQuote({ validUntil: past });

    const result = await signQuote(db, storage(), okMailer, quote.shareToken!, {
      name: "Jean Dupont",
      pngDataUrl: TINY_PNG_DATA_URL,
    });
    expect(result.ok).toBe(false);
  });

  it("renvoie une erreur pour un token inconnu", async () => {
    const result = await signQuote(db, storage(), okMailer, "token-inexistant", {
      name: "Jean Dupont",
      pngDataUrl: TINY_PNG_DATA_URL,
    });
    expect(result.ok).toBe(false);
  });
});

describe("refuseQuote", () => {
  it("refuse avec motif : statut refused + motif en base", async () => {
    const quote = await issuedQuote();
    const result = await refuseQuote(db, quote.shareToken!, "Budget insuffisant");
    expect(result.ok).toBe(true);

    const after = await getQuoteById(db, orgId, quote.id);
    expect(after?.status).toBe("refused");
    expect(after?.refusalReason).toBe("Budget insuffisant");
    expect(after?.refusedAt).not.toBeNull();
  });

  it("refuse un devis déjà signé", async () => {
    const quote = await issuedQuote();
    await signQuote(db, storage(), okMailer, quote.shareToken!, {
      name: "Jean Dupont",
      pngDataUrl: TINY_PNG_DATA_URL,
    });

    const result = await refuseQuote(db, quote.shareToken!, "Trop tard");
    expect(result.ok).toBe(false);
  });
});

describe("signInvoice", () => {
  it("signe : Signature créée (invoiceId), signedAt/pdfSignedKey/pdfHash posés, statut inchangé, PDF archivé, events + 2 emails", async () => {
    const invoice = await issuedInvoice();

    const result = await signInvoice(db, storage(), okMailer, invoice.shareToken!, {
      name: "Jean Dupont",
      email: "jean.dupont@example.com",
      pngDataUrl: TINY_PNG_DATA_URL,
    });
    expect(result.ok).toBe(true);

    const after = await getInvoiceById(db, orgId, invoice.id);
    // Signer une facture n'est jamais une transition de statut (orthogonal
    // au paiement) — le statut d'émission reste inchangé.
    expect(after?.status).toBe(invoice.status);
    expect(after?.signedAt).not.toBeNull();
    expect(after?.pdfSignedKey).toBeTruthy();
    expect(after?.pdfHash).toBeTruthy();

    const [sig] = await db.select().from(signatures).where(eq(signatures.invoiceId, invoice.id));
    expect(sig.signerName).toBe("Jean Dupont");
    expect(sig.imageKey).toBeTruthy();
    expect(sig.quoteId).toBeNull();

    const archived = await storage().get(after!.pdfSignedKey!);
    expect(archived).not.toBeNull();
    const recomputedHash = createHash("sha256").update(archived!).digest("hex");
    expect(recomputedHash).toBe(after?.pdfHash);

    const logs = await db.select().from(emailLogs).where(eq(emailLogs.documentId, invoice.id));
    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(logs.every((l) => l.status === "sent")).toBe(true);
  });

  it("refuse une seconde signature (déjà signée)", async () => {
    const invoice = await issuedInvoice();
    const first = await signInvoice(db, storage(), okMailer, invoice.shareToken!, {
      name: "Jean Dupont",
      pngDataUrl: TINY_PNG_DATA_URL,
    });
    expect(first.ok).toBe(true);

    const second = await signInvoice(db, storage(), okMailer, invoice.shareToken!, {
      name: "Quelqu'un d'autre",
      pngDataUrl: TINY_PNG_DATA_URL,
    });
    expect(second.ok).toBe(false);
  });

  it("refuse la signature d'une facture annulée", async () => {
    const invoice = await issuedInvoice();
    await db.update(invoices).set({ status: "cancelled" }).where(eq(invoices.id, invoice.id));

    const result = await signInvoice(db, storage(), okMailer, invoice.shareToken!, {
      name: "Jean Dupont",
      pngDataUrl: TINY_PNG_DATA_URL,
    });
    expect(result.ok).toBe(false);
  });

  it("refuse une signature au format PNG invalide", async () => {
    const invoice = await issuedInvoice();
    const result = await signInvoice(db, storage(), okMailer, invoice.shareToken!, {
      name: "Jean Dupont",
      pngDataUrl: "data:text/plain;base64,bm90LWEtcG5n",
    });
    expect(result.ok).toBe(false);
  });

  it("renvoie une erreur pour un token inconnu", async () => {
    const result = await signInvoice(db, storage(), okMailer, "token-inexistant", {
      name: "Jean Dupont",
      pngDataUrl: TINY_PNG_DATA_URL,
    });
    expect(result.ok).toBe(false);
  });
});
