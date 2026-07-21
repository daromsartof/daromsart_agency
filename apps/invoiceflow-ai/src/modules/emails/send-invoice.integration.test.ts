import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createFsStorage } from "@daromsart/storage";
import type { Mailer } from "@daromsart/email";
import * as schema from "../../db/schema";
import { clients, emailLogs, invoiceLines, invoices, organizations } from "../../db/schema";
import { createDraft } from "../invoices/mutations";
import { getInvoiceById } from "../invoices/queries";
import { sendInvoiceEmail } from "./send-document";

const url = process.env.TEST_DATABASE_URL;
const client = postgres(url ?? "", { max: 1 });
const db = drizzle(client, { schema });

let orgId = "";
let clientId = "";
let storageDir = "";

const okMailer: Mailer = {
  async sendDocumentEmail() {
    return { ok: true, id: "resend_fake_id", mode: "resend" };
  },
  async sendResetPasswordEmail() {
    return { ok: true, id: "resend_fake_id", mode: "resend" };
  },
  async sendSignatureConfirmation() {
    return { ok: true, id: "resend_fake_id", mode: "resend" };
  },
};

const failingMailer: Mailer = {
  async sendDocumentEmail() {
    return { ok: false, error: "Resend indisponible (mock test)." };
  },
  async sendResetPasswordEmail() {
    return { ok: false, error: "Resend indisponible (mock test)." };
  },
  async sendSignatureConfirmation() {
    return { ok: false, error: "Resend indisponible (mock test)." };
  },
};

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  storageDir = await mkdtemp(join(tmpdir(), "daromsart-invoice-email-send-"));
  const [org] = await db
    .insert(organizations)
    .values({ legalName: "Org Invoice Email Send Test" })
    .returning();
  orgId = org.id;

  const [c] = await db
    .insert(clients)
    .values({
      organizationId: orgId,
      type: "company",
      displayName: "Client Invoice Email Test",
      email: "client@example.com",
    })
    .returning();
  clientId = c.id;
});

afterAll(async () => {
  await db.delete(emailLogs).where(eq(emailLogs.organizationId, orgId));
  await db.delete(invoiceLines);
  await db.delete(invoices).where(eq(invoices.organizationId, orgId));
  await db.delete(clients).where(eq(clients.organizationId, orgId));
  await db.delete(organizations).where(eq(organizations.id, orgId));
  await rm(storageDir, { recursive: true, force: true });
  await client.end({ timeout: 5 });
});

const storage = () => createFsStorage({ driver: "fs", basePath: storageDir });

function emailInput(overrides: Partial<Parameters<typeof sendInvoiceEmail>[5]> = {}) {
  return {
    to: ["destinataire@example.com"],
    subject: "Votre facture {numero}",
    bodyText: "Bonjour {client}, montant {total}, à régler avant le {echeance}.",
    ...overrides,
  };
}

describe("sendInvoiceEmail", () => {
  it("émet une facture brouillon puis envoie : issued→sent, EmailLog sent + event", async () => {
    const created = await createDraft(db, orgId, {
      clientId,
      lines: [{ description: "Prestation", quantity: 1, unitPriceCents: 10000, vatRate: 20 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await sendInvoiceEmail(
      db,
      storage(),
      okMailer,
      orgId,
      created.id,
      emailInput(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const invoice = await getInvoiceById(db, orgId, created.id);
    expect(invoice?.status).toBe("sent");
    expect(invoice?.number).toMatch(/^FAC-/);

    const [log] = await db
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.id, result.emailLogId));
    expect(log.status).toBe("sent");
    expect(log.resendId).toBe("resend_fake_id");
    expect(log.subject).toContain(invoice?.number ?? "");
  });

  it("échec d'envoi (mock) : EmailLog failed, la facture reste émise (numéro conservé)", async () => {
    const created = await createDraft(db, orgId, {
      clientId,
      lines: [{ description: "Prestation", quantity: 1, unitPriceCents: 5000, vatRate: 20 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await sendInvoiceEmail(
      db,
      storage(),
      failingMailer,
      orgId,
      created.id,
      emailInput(),
    );
    expect(result.ok).toBe(false);

    const invoice = await getInvoiceById(db, orgId, created.id);
    expect(invoice?.status).toBe("sent");
    expect(invoice?.number).toBeTruthy();

    const logs = await db
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.documentId, created.id));
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe("failed");
    expect(logs[0].errorMessage).toContain("mock test");
  });

  it("rejette une adresse email invalide sans consommer de numéro", async () => {
    const created = await createDraft(db, orgId, {
      clientId,
      lines: [{ description: "Prestation", quantity: 1, unitPriceCents: 5000, vatRate: 20 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await sendInvoiceEmail(
      db,
      storage(),
      okMailer,
      orgId,
      created.id,
      emailInput({ to: ["pas-un-email"] }),
    );
    expect(result.ok).toBe(false);

    const invoice = await getInvoiceById(db, orgId, created.id);
    expect(invoice?.status).toBe("draft");
    expect(invoice?.number).toBeNull();
  });

  it("renvoi sur une facture déjà émise (issued, jamais envoyée) : passe à sent puis reste sent", async () => {
    const created = await createDraft(db, orgId, {
      clientId,
      lines: [{ description: "Prestation", quantity: 1, unitPriceCents: 5000, vatRate: 20 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const first = await sendInvoiceEmail(db, storage(), okMailer, orgId, created.id, emailInput());
    expect(first.ok).toBe(true);
    const afterFirst = await getInvoiceById(db, orgId, created.id);
    const numberAfterFirst = afterFirst?.number;

    const second = await sendInvoiceEmail(db, storage(), okMailer, orgId, created.id, emailInput());
    expect(second.ok).toBe(true);
    const afterSecond = await getInvoiceById(db, orgId, created.id);
    expect(afterSecond?.number).toBe(numberAfterFirst);
    expect(afterSecond?.status).toBe("sent");

    const logs = await db
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.documentId, created.id));
    expect(logs).toHaveLength(2);
  });
});
