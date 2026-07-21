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
import { clients, emailLogs, organizations, quotes } from "../../db/schema";
import { createDraft } from "../quotes/mutations";
import { getQuoteById } from "../quotes/queries";
import { sendQuoteEmail } from "./send-document";

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
};

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  storageDir = await mkdtemp(join(tmpdir(), "daromsart-email-send-"));
  const [org] = await db
    .insert(organizations)
    .values({ legalName: "Org Email Send Test" })
    .returning();
  orgId = org.id;

  const [c] = await db
    .insert(clients)
    .values({
      organizationId: orgId,
      type: "company",
      displayName: "Client Email Test",
      email: "client@example.com",
    })
    .returning();
  clientId = c.id;
});

afterAll(async () => {
  await db.delete(emailLogs).where(eq(emailLogs.organizationId, orgId));
  await db.delete(quotes).where(eq(quotes.organizationId, orgId));
  await db.delete(clients).where(eq(clients.organizationId, orgId));
  await db.delete(organizations).where(eq(organizations.id, orgId));
  await rm(storageDir, { recursive: true, force: true });
  await client.end({ timeout: 5 });
});

const storage = () => createFsStorage({ driver: "fs", basePath: storageDir });

function emailInput(overrides: Partial<Parameters<typeof sendQuoteEmail>[5]> = {}) {
  return {
    to: ["destinataire@example.com"],
    subject: "Votre devis {numero}",
    bodyText: "Bonjour {client}, montant {total}.",
    ...overrides,
  };
}

describe("sendQuoteEmail", () => {
  it("émet un devis brouillon puis envoie : EmailLog sent + event + statut sent", async () => {
    const created = await createDraft(db, orgId, {
      clientId,
      lines: [{ description: "Prestation", quantity: 1, unitPriceCents: 10000, vatRate: 20 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await sendQuoteEmail(
      db,
      storage(),
      okMailer,
      orgId,
      created.id,
      emailInput(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const quote = await getQuoteById(db, orgId, created.id);
    expect(quote?.status).toBe("sent");
    expect(quote?.number).toMatch(/^DEV-/);

    const [log] = await db
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.id, result.emailLogId));
    expect(log.status).toBe("sent");
    expect(log.resendId).toBe("resend_fake_id");
    expect(log.subject).toContain(quote?.number ?? "");
  });

  it("échec d'envoi (mock) : EmailLog failed, le devis reste émis (numéro conservé)", async () => {
    const created = await createDraft(db, orgId, {
      clientId,
      lines: [{ description: "Prestation", quantity: 1, unitPriceCents: 5000, vatRate: 20 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await sendQuoteEmail(
      db,
      storage(),
      failingMailer,
      orgId,
      created.id,
      emailInput(),
    );
    expect(result.ok).toBe(false);

    const quote = await getQuoteById(db, orgId, created.id);
    expect(quote?.status).toBe("sent");
    expect(quote?.number).toBeTruthy();

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

    const result = await sendQuoteEmail(
      db,
      storage(),
      okMailer,
      orgId,
      created.id,
      emailInput({ to: ["pas-un-email"] }),
    );
    expect(result.ok).toBe(false);

    const quote = await getQuoteById(db, orgId, created.id);
    expect(quote?.status).toBe("draft");
    expect(quote?.number).toBeNull();
  });

  it("envoi sur un devis déjà émis (renvoi) : n'émet pas une seconde fois", async () => {
    const created = await createDraft(db, orgId, {
      clientId,
      lines: [{ description: "Prestation", quantity: 1, unitPriceCents: 5000, vatRate: 20 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const first = await sendQuoteEmail(db, storage(), okMailer, orgId, created.id, emailInput());
    expect(first.ok).toBe(true);
    const afterFirst = await getQuoteById(db, orgId, created.id);
    const numberAfterFirst = afterFirst?.number;

    const second = await sendQuoteEmail(db, storage(), okMailer, orgId, created.id, emailInput());
    expect(second.ok).toBe(true);
    const afterSecond = await getQuoteById(db, orgId, created.id);
    expect(afterSecond?.number).toBe(numberAfterFirst);

    const logs = await db
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.documentId, created.id));
    expect(logs).toHaveLength(2);
  });
});
