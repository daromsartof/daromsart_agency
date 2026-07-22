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
import { createDraft, issueInvoice } from "./mutations";
import { getInvoiceById } from "./queries";
import { remindInvoice } from "./reminders";

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
  async sendReminderEmail() {
    return { ok: true, id: "resend_fake_id", mode: "resend" };
  },
  async sendInviteEmail() {
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
  async sendReminderEmail() {
    return { ok: false, error: "Resend indisponible (mock test)." };
  },
  async sendInviteEmail() {
    return { ok: false, error: "Resend indisponible (mock test)." };
  },
};

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  storageDir = await mkdtemp(join(tmpdir(), "daromsart-reminders-"));
  const [org] = await db
    .insert(organizations)
    .values({ legalName: "Org Reminders Test" })
    .returning();
  orgId = org.id;

  const [c] = await db
    .insert(clients)
    .values({ organizationId: orgId, type: "company", displayName: "Client Reminders Test" })
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

async function issuedInvoice(dueDate: Date) {
  const created = await createDraft(db, orgId, {
    clientId,
    validUntil: dueDate,
    lines: [{ description: "Prestation", quantity: 1, unitPriceCents: 10000, vatRate: 20 }],
  });
  if (!created.ok) throw new Error("createDraft failed");
  const issued = await issueInvoice(db, orgId, created.id);
  if (!issued.ok) throw new Error("issueInvoice failed");
  const invoice = await getInvoiceById(db, orgId, created.id);
  if (!invoice) throw new Error("invoice not found");
  return invoice;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function reminderInput(overrides: Partial<Parameters<typeof remindInvoice>[5]> = {}) {
  return {
    to: ["destinataire@example.com"],
    subject: "Rappel — facture {numero}",
    bodyText: "Bonjour {client}, en retard de {jours_retard} jours, reste dû {total}.",
    ...overrides,
  };
}

describe("remindInvoice", () => {
  it("relance une facture en retard : EmailLog kind=reminder, event reminded, last_reminder_at", async () => {
    const invoice = await issuedInvoice(daysAgo(10));
    const result = await remindInvoice(db, storage(), okMailer, orgId, invoice.id, reminderInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [log] = await db.select().from(emailLogs).where(eq(emailLogs.id, result.emailLogId));
    expect(log.kind).toBe("reminder");
    expect(log.status).toBe("sent");
    expect(log.subject).toContain(invoice.number ?? "");

    const after = await getInvoiceById(db, orgId, invoice.id);
    expect(after?.lastReminderAt).not.toBeNull();
  });

  it("refuse la relance d'une facture non en retard (échéance future)", async () => {
    const invoice = await issuedInvoice(daysFromNow(30));
    const result = await remindInvoice(db, storage(), okMailer, orgId, invoice.id, reminderInput());
    expect(result.ok).toBe(false);

    const after = await getInvoiceById(db, orgId, invoice.id);
    expect(after?.lastReminderAt).toBeNull();
  });

  it("refuse la relance d'une facture payée entre-temps (revérifiée côté serveur)", async () => {
    const invoice = await issuedInvoice(daysAgo(15));
    await db
      .update(invoices)
      .set({ status: "paid", amountPaidCents: invoice.totalCents, paidAt: new Date() })
      .where(eq(invoices.id, invoice.id));

    const result = await remindInvoice(db, storage(), okMailer, orgId, invoice.id, reminderInput());
    expect(result.ok).toBe(false);
  });

  it("< 24 h depuis la dernière relance sans confirmation → needsConfirmation, aucun envoi", async () => {
    const invoice = await issuedInvoice(daysAgo(5));
    const first = await remindInvoice(db, storage(), okMailer, orgId, invoice.id, reminderInput());
    expect(first.ok).toBe(true);

    const second = await remindInvoice(db, storage(), okMailer, orgId, invoice.id, reminderInput());
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.needsConfirmation).toBe(true);

    const logs = await db
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.documentId, invoice.id));
    expect(logs).toHaveLength(1);
  });

  it("< 24 h avec confirmed:true → envoie quand même", async () => {
    const invoice = await issuedInvoice(daysAgo(5));
    await remindInvoice(db, storage(), okMailer, orgId, invoice.id, reminderInput());

    const confirmed = await remindInvoice(
      db,
      storage(),
      okMailer,
      orgId,
      invoice.id,
      reminderInput({ confirmed: true }),
    );
    expect(confirmed.ok).toBe(true);

    const logs = await db
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.documentId, invoice.id));
    expect(logs).toHaveLength(2);
  });

  it("échec d'envoi (mock) : EmailLog failed, last_reminder_at non mis à jour", async () => {
    const invoice = await issuedInvoice(daysAgo(8));
    const result = await remindInvoice(
      db,
      storage(),
      failingMailer,
      orgId,
      invoice.id,
      reminderInput(),
    );
    expect(result.ok).toBe(false);

    const after = await getInvoiceById(db, orgId, invoice.id);
    expect(after?.lastReminderAt).toBeNull();

    const logs = await db
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.documentId, invoice.id));
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe("failed");
  });

  it("rejette une adresse email invalide", async () => {
    const invoice = await issuedInvoice(daysAgo(3));
    const result = await remindInvoice(
      db,
      storage(),
      okMailer,
      orgId,
      invoice.id,
      reminderInput({ to: ["pas-un-email"] }),
    );
    expect(result.ok).toBe(false);
  });
});
