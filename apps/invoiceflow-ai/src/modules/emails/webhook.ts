import { Webhook } from "svix";
import { eq } from "drizzle-orm";
import type { AppDb } from "../../db/types";
import { emailLogs, type EmailLogStatus } from "../../db/schema";
import { addDocumentEvent } from "../documents/events";

/**
 * Webhook Resend (story 20, H12) : le corps DOIT être lu brut (`req.text()`)
 * pour la vérification svix — un body déjà parsé/re-sérialisé produirait une
 * signature différente et ferait échouer une requête pourtant légitime.
 */

export interface ResendWebhookEvent {
  type: string;
  data: { email_id?: string; [key: string]: unknown };
}

export type VerifyResendWebhookResult =
  | { ok: true; event: ResendWebhookEvent }
  | { ok: false };

/** Vérifie la signature svix avec de VRAIES primitives (jamais de bypass en
 * prod — les tests génèrent aussi de vraies signatures avec `svix.Webhook`). */
export function verifyResendWebhook(
  secret: string,
  rawBody: string,
  headers: { "svix-id"?: string | null; "svix-timestamp"?: string | null; "svix-signature"?: string | null },
): VerifyResendWebhookResult {
  try {
    const wh = new Webhook(secret);
    const event = wh.verify(rawBody, {
      "svix-id": headers["svix-id"] ?? "",
      "svix-timestamp": headers["svix-timestamp"] ?? "",
      "svix-signature": headers["svix-signature"] ?? "",
    }) as ResendWebhookEvent;
    return { ok: true, event };
  } catch {
    return { ok: false };
  }
}

/** Rang de progression (H12) : `bounced`/`complained`/`failed` sont
 * terminaux (rang max) ; le statut ne régresse jamais. */
const STATUS_RANK: Record<EmailLogStatus, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  opened: 3,
  bounced: 4,
  complained: 4,
  failed: 4,
};

const EVENT_TO_STATUS: Record<string, EmailLogStatus | undefined> = {
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

const STATUS_TO_TIMESTAMP_FIELD: Partial<
  Record<EmailLogStatus, "deliveredAt" | "openedAt" | "bouncedAt">
> = {
  delivered: "deliveredAt",
  opened: "openedAt",
  bounced: "bouncedAt",
  complained: "bouncedAt",
};

const STATUS_TO_DOCUMENT_EVENT: Partial<Record<EmailLogStatus, string>> = {
  delivered: "email_delivered",
  opened: "email_opened",
  bounced: "email_bounced",
  complained: "email_complained",
};

/**
 * Applique un event Resend déjà vérifié : idempotent (replay = no-op, jamais
 * de doublon de `DocumentEvent`), tolère un ordre non garanti (opened avant
 * delivered) — chaque horodatage est rempli indépendamment du statut
 * affiché, qui lui ne progresse jamais en arrière. `resend_id` inconnu ou
 * type d'event non géré → no-op silencieux (jamais une erreur : la requête
 * répond quand même 200 côté route, cf. plans/story-20.md).
 */
export async function applyResendWebhookEvent(
  db: AppDb,
  event: ResendWebhookEvent,
): Promise<void> {
  const newStatus = EVENT_TO_STATUS[event.type];
  const resendId = event.data.email_id;
  if (!newStatus || !resendId) return;

  const [log] = await db.select().from(emailLogs).where(eq(emailLogs.resendId, resendId)).limit(1);
  if (!log) return;

  const now = new Date();
  const updates: { updatedAt: Date; status?: EmailLogStatus; deliveredAt?: Date; openedAt?: Date; bouncedAt?: Date } = {
    updatedAt: now,
  };

  const timestampField = STATUS_TO_TIMESTAMP_FIELD[newStatus];
  if (timestampField && !log[timestampField]) {
    updates[timestampField] = now;
  }
  if (STATUS_RANK[newStatus] > STATUS_RANK[log.status]) {
    updates.status = newStatus;
  }

  if (Object.keys(updates).length <= 1) return; // rien de nouveau (replay)

  await db.update(emailLogs).set(updates).where(eq(emailLogs.id, log.id));

  const eventType = STATUS_TO_DOCUMENT_EVENT[newStatus];
  if (eventType) {
    await addDocumentEvent(db, {
      organizationId: log.organizationId,
      documentType: log.documentType,
      documentId: log.documentId,
      eventType,
      payload: { resendId },
    });
  }
}
