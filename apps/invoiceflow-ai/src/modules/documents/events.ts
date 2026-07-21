import { and, desc, eq } from "drizzle-orm";
import type { AppDb } from "../../db/types";
import { documentEvents } from "../../db/schema";

export type DocumentKind = "quote" | "invoice" | "credit_note";

export interface AddDocumentEventParams {
  organizationId: string;
  documentType: DocumentKind;
  documentId: string;
  eventType: string;
  payload?: Record<string, unknown>;
  actorUserId?: string | null;
}

/** Journalise un événement de cycle de vie (H14/H15). Utilisé dès la story 07
 * pour `created`/`updated` sur les devis. */
export async function addDocumentEvent(
  db: AppDb,
  params: AddDocumentEventParams,
): Promise<void> {
  await db.insert(documentEvents).values({
    organizationId: params.organizationId,
    documentType: params.documentType,
    documentId: params.documentId,
    eventType: params.eventType,
    payload: params.payload,
    actorUserId: params.actorUserId ?? null,
  });
}

export interface DocumentEventRow {
  id: string;
  eventType: string;
  payload: Record<string, unknown> | null;
  actorUserId: string | null;
  createdAt: Date;
}

/** Timeline d'un document (plus récent en premier), onglet "Activité"/détail. */
export async function listDocumentEvents(
  db: AppDb,
  organizationId: string,
  documentType: DocumentKind,
  documentId: string,
): Promise<DocumentEventRow[]> {
  return db
    .select({
      id: documentEvents.id,
      eventType: documentEvents.eventType,
      payload: documentEvents.payload,
      actorUserId: documentEvents.actorUserId,
      createdAt: documentEvents.createdAt,
    })
    .from(documentEvents)
    .where(
      and(
        eq(documentEvents.organizationId, organizationId),
        eq(documentEvents.documentType, documentType),
        eq(documentEvents.documentId, documentId),
      ),
    )
    .orderBy(desc(documentEvents.createdAt));
}
