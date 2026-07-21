import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { canTransition, isQuoteExpired, type InvoiceStatus, type QuoteStatus } from "@daromsart/core";
import { renderDocumentPdf, type DocumentPdfInput } from "@daromsart/pdf";
import type { Storage } from "@daromsart/storage";
import type { Mailer, SendSignatureConfirmationParams } from "@daromsart/email";
import type { AppDb } from "../../db/types";
import { emailLogs, invoices, quotes, signatures } from "../../db/schema";
import { addDocumentEvent } from "../documents/events";
import { buildQuotePdfInput } from "../documents/pdf";
import { env } from "../../lib/env";
import { getQuoteByToken } from "./queries";

const MAX_SIGNATURE_PNG_BYTES = 500 * 1024;

function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Marque un devis comme vu (première consultation publique, H14). Idempotent
 * (via `canTransition` : `viewed→viewed` refusé, `signed/refused/expired`
 * ne régressent jamais vers `viewed`) — appelable sans risque à chaque
 * chargement de la page publique, y compris par un préchargement de lien
 * (limite acceptée V1, plans/story-11.md).
 */
export async function markViewed(db: AppDb, quoteId: string): Promise<void> {
  const [row] = await db
    .select({ status: quotes.status, organizationId: quotes.organizationId })
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .limit(1);
  if (!row) return;
  if (!canTransition("quote", row.status as QuoteStatus, "viewed")) return;

  const now = new Date();
  await db
    .update(quotes)
    .set({ status: "viewed", viewedAt: now, updatedAt: now })
    .where(eq(quotes.id, quoteId));
  await addDocumentEvent(db, {
    organizationId: row.organizationId,
    documentType: "quote",
    documentId: quoteId,
    eventType: "viewed",
  });
}

/**
 * Marque une facture comme vue (story 14, symétrique de `markViewed` pour
 * les devis). Idempotent via `canTransition` : `viewed→viewed` refusé,
 * `partially_paid/paid/overdue/cancelled` ne régressent jamais vers `viewed`.
 */
export async function markInvoiceViewed(db: AppDb, invoiceId: string): Promise<void> {
  const [row] = await db
    .select({ status: invoices.status, organizationId: invoices.organizationId })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  if (!row) return;
  if (!canTransition("invoice", row.status as InvoiceStatus, "viewed")) return;

  const now = new Date();
  await db
    .update(invoices)
    .set({ status: "viewed", viewedAt: now, updatedAt: now })
    .where(eq(invoices.id, invoiceId));
  await addDocumentEvent(db, {
    organizationId: row.organizationId,
    documentType: "invoice",
    documentId: invoiceId,
    eventType: "viewed",
  });
}

export interface SignQuoteInput {
  name: string;
  email?: string | null;
  /** Data URL PNG du tracé (canvas maison, cf. modules/public/components). */
  pngDataUrl: string;
  ip?: string | null;
  userAgent?: string | null;
}

export type SignQuoteResult = { ok: true } | { ok: false; errors: Record<string, string> };

async function sendConfirmationAndLog(
  db: AppDb,
  mailer: Mailer,
  organizationId: string,
  quoteId: string,
  params: SendSignatureConfirmationParams,
): Promise<void> {
  const result = await mailer.sendSignatureConfirmation(params);
  const now = new Date();
  await db.insert(emailLogs).values({
    organizationId,
    documentType: "quote",
    documentId: quoteId,
    kind: "document",
    to: [params.to],
    subject: params.forOrganization
      ? `Devis ${params.quoteNumber} signé`
      : `Signature confirmée — devis ${params.quoteNumber}`,
    status: result.ok ? "sent" : "failed",
    resendId: result.ok ? result.id : null,
    errorMessage: result.ok ? null : result.error,
    sentAt: result.ok ? now : null,
  });
}

/**
 * Signature publique (H9) — transaction logique en plusieurs étapes :
 * 1. re-vérifie que le devis est signable (statut, non expiré) ;
 * 2. rend le PDF NON signé pour en calculer l'empreinte SHA-256 (preuve de
 *    contenu imprimée sur le PDF final) ;
 * 3. upload le PNG puis rend le PDF SIGNÉ (avec la page/bloc signature) et
 *    l'archive (jamais le PDF non signé, plans/story-11.md) ;
 * 4. journalise la Signature (contrainte unique `quote_id` = filet anti
 *    double-signature concurrente), fait passer le devis à `signed` ;
 * 5. envoie 2 emails de confirmation (client + organisation), journalisés en
 *    EmailLog quel que soit le résultat (échec email ≠ échec de la signature,
 *    déjà acquise à ce stade).
 */
export async function signQuote(
  db: AppDb,
  storage: Storage,
  mailer: Mailer,
  token: string,
  input: SignQuoteInput,
): Promise<SignQuoteResult> {
  const quote = await getQuoteByToken(db, token);
  if (!quote) {
    return { ok: false, errors: { _root: "Lien invalide." } };
  }
  if (!canTransition("quote", quote.status, "signed")) {
    return { ok: false, errors: { _root: "Ce devis ne peut plus être signé." } };
  }
  if (isQuoteExpired(quote.validUntil)) {
    return { ok: false, errors: { _root: "Ce devis a expiré." } };
  }
  if (!input.name.trim()) {
    return { ok: false, errors: { name: "Le nom est requis." } };
  }
  const pngMatch = /^data:image\/png;base64,(.+)$/.exec(input.pngDataUrl);
  if (!pngMatch) {
    return { ok: false, errors: { signature: "Signature invalide." } };
  }
  const pngBuffer = Buffer.from(pngMatch[1], "base64");
  if (pngBuffer.byteLength === 0) {
    return { ok: false, errors: { signature: "Signature requise." } };
  }
  if (pngBuffer.byteLength > MAX_SIGNATURE_PNG_BYTES) {
    return { ok: false, errors: { signature: "Signature trop volumineuse." } };
  }

  const unsignedInput = await buildQuotePdfInput(db, storage, quote.organizationId, quote.id);
  if (!unsignedInput) {
    return { ok: false, errors: { _root: "Devis introuvable." } };
  }
  const unsignedBuffer = await renderDocumentPdf(unsignedInput);
  const originalPdfHash = sha256Hex(unsignedBuffer);

  const now = new Date();
  const imageKey = `signatures/${quote.id}.png`;
  await storage.put(imageKey, pngBuffer, "image/png");
  const imageDataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;

  const signedInput: DocumentPdfInput = {
    ...unsignedInput,
    signature: {
      name: input.name.trim(),
      email: input.email?.trim() || null,
      signedAt: now,
      imageDataUrl,
      ip: input.ip ?? null,
      originalPdfHash,
    },
  };
  const signedBuffer = await renderDocumentPdf(signedInput);
  const pdfHash = sha256Hex(signedBuffer);
  const pdfSignedKey = `signed-quotes/${quote.id}.pdf`;
  await storage.put(pdfSignedKey, signedBuffer, "application/pdf");

  try {
    await db.insert(signatures).values({
      quoteId: quote.id,
      signerName: input.name.trim(),
      signerEmail: input.email?.trim() || null,
      imageKey,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      signedAt: now,
    });
  } catch {
    // Contrainte unique quote_id : filet de sécurité en cas de course
    // concurrente (deux requêtes de signature simultanées).
    return { ok: false, errors: { _root: "Ce devis a déjà été signé." } };
  }

  await db
    .update(quotes)
    .set({ status: "signed", signedAt: now, pdfSignedKey, pdfHash, updatedAt: now })
    .where(eq(quotes.id, quote.id));

  await addDocumentEvent(db, {
    organizationId: quote.organizationId,
    documentType: "quote",
    documentId: quote.id,
    eventType: "signed",
    payload: { name: input.name.trim() },
  });

  const publicUrl = `${env.APP_URL}/p/devis/${token}`;
  const organizationName = unsignedInput.organization.tradeName ?? unsignedInput.organization.legalName;
  const accentColor = unsignedInput.template.accentColor;
  const quoteNumber = quote.number ?? "";
  const pdfFilename = `devis-signe-${quote.number ?? quote.id}.pdf`;

  if (quote.clientEmail) {
    await sendConfirmationAndLog(db, mailer, quote.organizationId, quote.id, {
      to: quote.clientEmail,
      organizationName,
      accentColor,
      quoteNumber,
      clientName: quote.clientName,
      signerName: input.name.trim(),
      forOrganization: false,
      publicUrl,
      pdfBuffer: signedBuffer,
      pdfFilename,
    });
  }
  if (unsignedInput.organization.email) {
    await sendConfirmationAndLog(db, mailer, quote.organizationId, quote.id, {
      to: unsignedInput.organization.email,
      organizationName,
      accentColor,
      quoteNumber,
      clientName: quote.clientName,
      signerName: input.name.trim(),
      forOrganization: true,
      publicUrl,
    });
  }

  return { ok: true };
}

export type RefuseQuoteResult = { ok: true } | { ok: false; errors: Record<string, string> };

/** Refus côté client sur la page publique (symétrique de `signQuote`, sans PDF/email). */
export async function refuseQuote(
  db: AppDb,
  token: string,
  reason?: string,
): Promise<RefuseQuoteResult> {
  const quote = await getQuoteByToken(db, token);
  if (!quote) {
    return { ok: false, errors: { _root: "Lien invalide." } };
  }
  if (!canTransition("quote", quote.status, "refused")) {
    return { ok: false, errors: { _root: "Cette action n'est plus possible." } };
  }
  if (isQuoteExpired(quote.validUntil)) {
    return { ok: false, errors: { _root: "Ce devis a expiré." } };
  }

  const now = new Date();
  await db
    .update(quotes)
    .set({ status: "refused", refusedAt: now, refusalReason: reason?.trim() || null, updatedAt: now })
    .where(eq(quotes.id, quote.id));

  await addDocumentEvent(db, {
    organizationId: quote.organizationId,
    documentType: "quote",
    documentId: quote.id,
    eventType: "refused",
    payload: reason ? { reason } : undefined,
  });

  return { ok: true };
}
