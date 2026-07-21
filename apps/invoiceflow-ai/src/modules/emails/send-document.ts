import { z } from "zod";
import { eq } from "drizzle-orm";
import { formatEUR, renderEmailVariables, type EmailVariables } from "@daromsart/core";
import { renderDocumentPdf } from "@daromsart/pdf";
import type { Storage } from "@daromsart/storage";
import type { Mailer } from "@daromsart/email";
import type { AppDb } from "../../db/types";
import { emailLogs } from "../../db/schema";
import { getQuoteById } from "../quotes/queries";
import { issueQuote } from "../quotes/mutations";
import { buildQuotePdfInput } from "../documents/pdf";
import { addDocumentEvent } from "../documents/events";

export type SendQuoteEmailResult =
  | { ok: true; emailLogId: string }
  | { ok: false; errors: Record<string, string> };

export interface SendQuoteEmailInput {
  to: string[];
  cc?: string[];
  /** Sujet/corps bruts (tokens `{client}/{numero}/...` non résolus ou
   * partiellement résolus par l'appelant) — résolus ici avec l'état FINAL
   * du devis (numéro/lien tout juste attribués si émission déclenchée). */
  subject: string;
  bodyText: string;
}

const emailListSchema = z.array(z.string().trim().email()).min(1);
const ccListSchema = z.array(z.string().trim().email());

function formatDateFr(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Orchestration d'envoi d'un devis par email (story 10) :
 * 1. valide les destinataires (zod, jamais de split-virgule côté serveur) ;
 * 2. émet le devis d'abord s'il est encore brouillon (numéro + share_token) —
 *    un échec d'émission (ex. client archivé) interrompt tout, AVANT tout
 *    envoi ;
 * 3. génère le PDF, résout les variables avec l'état final, envoie ;
 * 4. journalise l'EmailLog (`sent`/`failed`) + un DocumentEvent `sent`.
 *
 * Échec Resend après émission : l'émission reste acquise (numéro pris), le
 * devis n'est PAS rétrogradé — seul l'EmailLog passe `failed` (H12, parade
 * « Échec Resend après émission », plans/story-10.md).
 */
export async function sendQuoteEmail(
  db: AppDb,
  storage: Storage,
  mailer: Mailer,
  organizationId: string,
  quoteId: string,
  input: SendQuoteEmailInput,
): Promise<SendQuoteEmailResult> {
  const toParsed = emailListSchema.safeParse(input.to);
  if (!toParsed.success) {
    return { ok: false, errors: { to: "Au moins une adresse email valide est requise." } };
  }
  const ccParsed = ccListSchema.safeParse(input.cc ?? []);
  if (!ccParsed.success) {
    return { ok: false, errors: { cc: "Adresse email invalide en copie." } };
  }

  let quote = await getQuoteById(db, organizationId, quoteId);
  if (!quote) {
    return { ok: false, errors: { _root: "Devis introuvable." } };
  }

  if (quote.status === "draft") {
    const issued = await issueQuote(db, organizationId, quoteId);
    if (!issued.ok) {
      return { ok: false, errors: issued.errors };
    }
    quote = await getQuoteById(db, organizationId, quoteId);
    if (!quote) {
      return { ok: false, errors: { _root: "Devis introuvable." } };
    }
  }

  const pdfInput = await buildQuotePdfInput(db, storage, organizationId, quoteId);
  if (!pdfInput) {
    return { ok: false, errors: { _root: "Impossible de générer le PDF du devis." } };
  }

  const vars: EmailVariables = {
    client: quote.clientName,
    numero: quote.number ?? undefined,
    total: formatEUR(quote.totalCents),
    lien: pdfInput.publicUrl ?? undefined,
    echeance: formatDateFr(quote.validUntil) || undefined,
  };
  const subject = renderEmailVariables(input.subject, vars);
  const bodyText = renderEmailVariables(input.bodyText, vars);

  const [log] = await db
    .insert(emailLogs)
    .values({
      organizationId,
      documentType: "quote",
      documentId: quoteId,
      kind: "document",
      to: toParsed.data,
      cc: ccParsed.data.length ? ccParsed.data : null,
      subject,
      status: "queued",
    })
    .returning({ id: emailLogs.id });

  const pdfBuffer = await renderDocumentPdf(pdfInput);
  const sendResult = await mailer.sendDocumentEmail({
    to: toParsed.data,
    cc: ccParsed.data.length ? ccParsed.data : undefined,
    subject,
    document: {
      kind: "quote",
      number: quote.number,
      clientName: quote.clientName,
      organizationName: pdfInput.organization.tradeName ?? pdfInput.organization.legalName,
      totalCents: quote.totalCents,
      publicUrl: pdfInput.publicUrl ?? "",
      bodyText,
      accentColor: pdfInput.template.accentColor,
    },
    pdfBuffer,
    pdfFilename: `devis-${quote.number ?? "brouillon"}.pdf`,
  });

  const now = new Date();
  if (!sendResult.ok) {
    await db
      .update(emailLogs)
      .set({ status: "failed", errorMessage: sendResult.error, updatedAt: now })
      .where(eq(emailLogs.id, log.id));
    return {
      ok: false,
      errors: { _root: "Devis émis mais l'envoi a échoué — réessayez." },
    };
  }

  await db
    .update(emailLogs)
    .set({ status: "sent", resendId: sendResult.id, sentAt: now, updatedAt: now })
    .where(eq(emailLogs.id, log.id));

  await addDocumentEvent(db, {
    organizationId,
    documentType: "quote",
    documentId: quoteId,
    eventType: "sent",
    payload: { to: toParsed.data },
  });

  return { ok: true, emailLogId: log.id };
}
