import { z } from "zod";
import { eq } from "drizzle-orm";
import { formatEUR, isOverdue, renderEmailVariables, type EmailVariables } from "@daromsart/core";
import { renderDocumentPdf } from "@daromsart/pdf";
import type { Storage } from "@daromsart/storage";
import type { Mailer } from "@daromsart/email";
import type { AppDb } from "../../db/types";
import { emailLogs, invoices } from "../../db/schema";
import { getInvoiceById } from "./queries";
import { buildInvoicePdfInput } from "./pdf";
import { addDocumentEvent } from "../documents/events";

/**
 * Relance manuelle d'une facture en retard (story 16). Miroir de
 * `sendInvoiceEmail` (story 14) mais avec des garde-fous propres : refuse si
 * la facture n'est pas en retard (`isOverdue`, revérifié ici — jamais
 * confiance dans un état affiché côté client, une facture réglée entre
 * l'affichage du bouton et le clic ne doit jamais être relancée) et
 * anti-spam léger (`< 24 h` depuis la dernière relance → nécessite
 * `confirmed: true`, porté par un `ConfirmDialog` côté UI).
 */

const emailListSchema = z.array(z.string().trim().email()).min(1);
const ccListSchema = z.array(z.string().trim().email());

const MIN_HOURS_BETWEEN_REMINDERS = 24;
const MS_PER_HOUR = 1000 * 60 * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;

export interface RemindInvoiceInput {
  to: string[];
  cc?: string[];
  subject: string;
  bodyText: string;
  /** `true` si l'utilisateur a confirmé malgré une relance récente (< 24 h). */
  confirmed?: boolean;
}

export type RemindInvoiceResult =
  | { ok: true; emailLogId: string }
  | { ok: false; errors: Record<string, string>; needsConfirmation?: boolean };

function formatDateFr(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function daysOverdueSince(dueDate: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / MS_PER_DAY));
}

export async function remindInvoice(
  db: AppDb,
  storage: Storage,
  mailer: Mailer,
  organizationId: string,
  invoiceId: string,
  input: RemindInvoiceInput,
): Promise<RemindInvoiceResult> {
  const toParsed = emailListSchema.safeParse(input.to);
  if (!toParsed.success) {
    return { ok: false, errors: { to: "Au moins une adresse email valide est requise." } };
  }
  const ccParsed = ccListSchema.safeParse(input.cc ?? []);
  if (!ccParsed.success) {
    return { ok: false, errors: { cc: "Adresse email invalide en copie." } };
  }

  const invoice = await getInvoiceById(db, organizationId, invoiceId);
  if (!invoice) {
    return { ok: false, errors: { _root: "Facture introuvable." } };
  }

  const now = new Date();
  const overdue = isOverdue(
    {
      status: invoice.status,
      dueDate: invoice.dueDate,
      totalCents: invoice.totalCents,
      amountPaidCents: invoice.amountPaidCents,
    },
    now,
  );
  if (!overdue) {
    return { ok: false, errors: { _root: "Cette facture n'est pas en retard — relance impossible." } };
  }

  if (!input.confirmed && invoice.lastReminderAt) {
    const hoursSinceLastReminder = (now.getTime() - invoice.lastReminderAt.getTime()) / MS_PER_HOUR;
    if (hoursSinceLastReminder < MIN_HOURS_BETWEEN_REMINDERS) {
      return { ok: false, errors: {}, needsConfirmation: true };
    }
  }

  const pdfInput = await buildInvoicePdfInput(db, storage, organizationId, invoiceId);
  if (!pdfInput) {
    return { ok: false, errors: { _root: "Impossible de générer le PDF de la facture." } };
  }

  const remainingCents = invoice.totalCents - invoice.amountPaidCents;
  const daysOverdue = invoice.dueDate ? daysOverdueSince(invoice.dueDate, now) : 0;

  const vars: EmailVariables = {
    client: invoice.clientName,
    numero: invoice.number ?? undefined,
    total: formatEUR(invoice.totalCents),
    lien: pdfInput.publicUrl ?? undefined,
    echeance: formatDateFr(invoice.dueDate) || undefined,
    jours_retard: String(daysOverdue),
  };
  const subject = renderEmailVariables(input.subject, vars);
  const bodyText = renderEmailVariables(input.bodyText, vars);

  const [log] = await db
    .insert(emailLogs)
    .values({
      organizationId,
      documentType: "invoice",
      documentId: invoiceId,
      kind: "reminder",
      to: toParsed.data,
      cc: ccParsed.data.length ? ccParsed.data : null,
      subject,
      status: "queued",
    })
    .returning({ id: emailLogs.id });

  const pdfBuffer = await renderDocumentPdf(pdfInput);
  const sendResult = await mailer.sendReminderEmail({
    to: toParsed.data,
    cc: ccParsed.data.length ? ccParsed.data : undefined,
    subject,
    reminder: {
      number: invoice.number ?? "",
      clientName: invoice.clientName,
      organizationName: pdfInput.organization.tradeName ?? pdfInput.organization.legalName,
      remainingCents,
      daysOverdue,
      publicUrl: pdfInput.publicUrl ?? "",
      bodyText,
      accentColor: pdfInput.template.accentColor,
    },
    pdfBuffer,
    pdfFilename: `facture-${invoice.number ?? invoice.id}.pdf`,
  });

  const sentAt = new Date();
  if (!sendResult.ok) {
    await db
      .update(emailLogs)
      .set({ status: "failed", errorMessage: sendResult.error, updatedAt: sentAt })
      .where(eq(emailLogs.id, log.id));
    return { ok: false, errors: { _root: "Échec de l'envoi de la relance — réessayez." } };
  }

  await db
    .update(emailLogs)
    .set({ status: "sent", resendId: sendResult.id, sentAt, updatedAt: sentAt })
    .where(eq(emailLogs.id, log.id));

  await db
    .update(invoices)
    .set({ lastReminderAt: sentAt, updatedAt: sentAt })
    .where(eq(invoices.id, invoiceId));

  await addDocumentEvent(db, {
    organizationId,
    documentType: "invoice",
    documentId: invoiceId,
    eventType: "reminded",
    payload: { to: toParsed.data },
  });

  return { ok: true, emailLogId: log.id };
}
