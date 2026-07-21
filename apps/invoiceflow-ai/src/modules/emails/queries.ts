import { and, desc, eq } from "drizzle-orm";
import type { AppDb } from "../../db/types";
import { emailLogs, type EmailLogKind, type EmailLogStatus } from "../../db/schema";

export interface EmailLogRow {
  id: string;
  documentType: "quote" | "invoice";
  documentId: string;
  kind: EmailLogKind;
  to: string[];
  cc: string[] | null;
  subject: string;
  status: EmailLogStatus;
  errorMessage: string | null;
  sentAt: Date | null;
  createdAt: Date;
}

/** Historique des emails d'un document (onglet Emails, story 20). */
export async function listEmailLogsForDocument(
  db: AppDb,
  organizationId: string,
  documentType: "quote" | "invoice",
  documentId: string,
): Promise<EmailLogRow[]> {
  return db
    .select({
      id: emailLogs.id,
      documentType: emailLogs.documentType,
      documentId: emailLogs.documentId,
      kind: emailLogs.kind,
      to: emailLogs.to,
      cc: emailLogs.cc,
      subject: emailLogs.subject,
      status: emailLogs.status,
      errorMessage: emailLogs.errorMessage,
      sentAt: emailLogs.sentAt,
      createdAt: emailLogs.createdAt,
    })
    .from(emailLogs)
    .where(
      and(
        eq(emailLogs.organizationId, organizationId),
        eq(emailLogs.documentType, documentType),
        eq(emailLogs.documentId, documentId),
      ),
    )
    .orderBy(desc(emailLogs.createdAt));
}
