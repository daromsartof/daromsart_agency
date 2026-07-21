import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { Webhook } from "svix";
import * as schema from "../../db/schema";
import { clients, documentEvents, emailLogs, organizations, quotes } from "../../db/schema";
import { applyResendWebhookEvent, verifyResendWebhook } from "./webhook";

/**
 * Webhook Resend (story 20) : les signatures svix des tests sont de VRAIES
 * signatures générées avec `svix.Webhook#sign` (jamais un bypass du code de
 * prod, plans/story-20.md, parade « signature svix en test »).
 */
const url = process.env.TEST_DATABASE_URL;
const client = postgres(url ?? "", { max: 1 });
const db = drizzle(client, { schema });

const SECRET = `whsec_${Buffer.from(randomUUID() + randomUUID()).toString("base64")}`;

let orgId = "";
let clientId = "";

function signedHeaders(payload: string) {
  const id = `msg_${randomUUID()}`;
  const timestamp = new Date();
  const wh = new Webhook(SECRET);
  const signature = wh.sign(id, timestamp, payload);
  return {
    "svix-id": id,
    "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "svix-signature": signature,
  };
}

function resendEventPayload(type: string, emailId: string): string {
  return JSON.stringify({ type, data: { email_id: emailId } });
}

async function insertEmailLog(resendId: string) {
  const [quote] = await db
    .insert(quotes)
    .values({
      organizationId: orgId,
      clientId,
      status: "sent",
      subtotalCents: 10000,
      totalCents: 12000,
    })
    .returning();

  const [log] = await db
    .insert(emailLogs)
    .values({
      organizationId: orgId,
      documentType: "quote",
      documentId: quote.id,
      kind: "document",
      to: ["client@example.com"],
      subject: "Votre devis",
      status: "sent",
      resendId,
      sentAt: new Date(),
    })
    .returning();

  return { quoteId: quote.id, logId: log.id };
}

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  const [org] = await db
    .insert(organizations)
    .values({ legalName: "Org Webhook Resend Test" })
    .returning();
  orgId = org.id;

  const [c] = await db
    .insert(clients)
    .values({ organizationId: orgId, type: "company", displayName: "Client Webhook Test" })
    .returning();
  clientId = c.id;
});

afterAll(async () => {
  await db.delete(documentEvents).where(eq(documentEvents.organizationId, orgId));
  await db.delete(emailLogs).where(eq(emailLogs.organizationId, orgId));
  await db.delete(quotes).where(eq(quotes.organizationId, orgId));
  await db.delete(clients).where(eq(clients.organizationId, orgId));
  await db.delete(organizations).where(eq(organizations.id, orgId));
  await client.end({ timeout: 5 });
});

describe("verifyResendWebhook", () => {
  it("accepte une signature svix valide", () => {
    const payload = resendEventPayload("email.delivered", "re_test123");
    const headers = signedHeaders(payload);
    const result = verifyResendWebhook(SECRET, payload, headers);
    expect(result.ok).toBe(true);
  });

  it("refuse une signature invalide (secret différent)", () => {
    const payload = resendEventPayload("email.delivered", "re_test123");
    const headers = signedHeaders(payload);
    const result = verifyResendWebhook("whsec_wrongsecretwrongsecretwrongsecret==", payload, headers);
    expect(result.ok).toBe(false);
  });

  it("refuse un payload altéré après signature", () => {
    const payload = resendEventPayload("email.delivered", "re_test123");
    const headers = signedHeaders(payload);
    const tampered = resendEventPayload("email.bounced", "re_test123");
    const result = verifyResendWebhook(SECRET, tampered, headers);
    expect(result.ok).toBe(false);
  });
});

describe("applyResendWebhookEvent", () => {
  it("delivered → opened → replay opened : statuts/horodatages corrects, jamais de doublon d'event", async () => {
    const resendId = `re_${randomUUID()}`;
    const { logId } = await insertEmailLog(resendId);

    await applyResendWebhookEvent(db, { type: "email.delivered", data: { email_id: resendId } });
    let [log] = await db.select().from(emailLogs).where(eq(emailLogs.id, logId));
    expect(log.status).toBe("delivered");
    expect(log.deliveredAt).not.toBeNull();
    expect(log.openedAt).toBeNull();

    await applyResendWebhookEvent(db, { type: "email.opened", data: { email_id: resendId } });
    [log] = await db.select().from(emailLogs).where(eq(emailLogs.id, logId));
    expect(log.status).toBe("opened");
    expect(log.openedAt).not.toBeNull();

    const openedAtFirst = log.openedAt;
    // Replay Resend (at-least-once delivery) : aucun changement, aucun doublon.
    await applyResendWebhookEvent(db, { type: "email.opened", data: { email_id: resendId } });
    [log] = await db.select().from(emailLogs).where(eq(emailLogs.id, logId));
    expect(log.status).toBe("opened");
    expect(log.openedAt?.getTime()).toBe(openedAtFirst?.getTime());

    const events = await db
      .select()
      .from(documentEvents)
      .where(and(eq(documentEvents.documentId, log.documentId), eq(documentEvents.eventType, "email_opened")));
    expect(events).toHaveLength(1);
  });

  it("ordre non garanti (opened avant delivered) : le statut ne régresse jamais, deliveredAt rempli quand même", async () => {
    const resendId = `re_${randomUUID()}`;
    const { logId } = await insertEmailLog(resendId);

    await applyResendWebhookEvent(db, { type: "email.opened", data: { email_id: resendId } });
    await applyResendWebhookEvent(db, { type: "email.delivered", data: { email_id: resendId } });

    const [log] = await db.select().from(emailLogs).where(eq(emailLogs.id, logId));
    expect(log.status).toBe("opened");
    expect(log.deliveredAt).not.toBeNull();
    expect(log.openedAt).not.toBeNull();
  });

  it("bounced : statut terminal + DocumentEvent", async () => {
    const resendId = `re_${randomUUID()}`;
    const { logId } = await insertEmailLog(resendId);

    await applyResendWebhookEvent(db, { type: "email.bounced", data: { email_id: resendId } });
    const [log] = await db.select().from(emailLogs).where(eq(emailLogs.id, logId));
    expect(log.status).toBe("bounced");
    expect(log.bouncedAt).not.toBeNull();

    const events = await db
      .select()
      .from(documentEvents)
      .where(and(eq(documentEvents.documentId, log.documentId), eq(documentEvents.eventType, "email_bounced")));
    expect(events).toHaveLength(1);

    // Un "opened" tardif après un bounce ne rétrograde jamais le statut terminal.
    await applyResendWebhookEvent(db, { type: "email.opened", data: { email_id: resendId } });
    const [after] = await db.select().from(emailLogs).where(eq(emailLogs.id, logId));
    expect(after.status).toBe("bounced");
  });

  it("resend_id inconnu : no-op silencieux, jamais d'exception", async () => {
    await expect(
      applyResendWebhookEvent(db, { type: "email.delivered", data: { email_id: "re_inconnu" } }),
    ).resolves.toBeUndefined();
  });

  it("type d'event non géré : no-op silencieux", async () => {
    const resendId = `re_${randomUUID()}`;
    const { logId } = await insertEmailLog(resendId);
    await applyResendWebhookEvent(db, { type: "email.clicked", data: { email_id: resendId } });
    const [log] = await db.select().from(emailLogs).where(eq(emailLogs.id, logId));
    expect(log.status).toBe("sent");
  });
});
