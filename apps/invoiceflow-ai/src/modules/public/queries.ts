import { eq } from "drizzle-orm";
import type { InvoiceStatus, QuoteStatus } from "@daromsart/core";
import type { AppDb } from "../../db/types";
import { clients, invoices, organizations, quotes, signatures } from "../../db/schema";

export interface PublicQuoteSignature {
  name: string;
  email: string | null;
  imageKey: string;
  signedAt: Date;
}

export interface PublicQuoteData {
  id: string;
  organizationId: string;
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  status: QuoteStatus;
  number: string | null;
  validUntil: Date | null;
  totalCents: number;
  refusalReason: string | null;
  organizationName: string;
  signature: PublicQuoteSignature | null;
}

/**
 * Accès public par token (share_token, 256 bits — aucune protection
 * supplémentaire nécessaire, cf. plans/story-11.md). `null` si le token est
 * inconnu : ne JAMAIS distinguer "inexistant" de "autre erreur" côté appelant
 * (pas d'information exploitable pour un tiers).
 */
export async function getQuoteByToken(
  db: AppDb,
  token: string,
): Promise<PublicQuoteData | null> {
  const [row] = await db
    .select({
      id: quotes.id,
      organizationId: quotes.organizationId,
      clientId: quotes.clientId,
      clientName: clients.displayName,
      clientEmail: clients.email,
      status: quotes.status,
      number: quotes.number,
      validUntil: quotes.validUntil,
      totalCents: quotes.totalCents,
      refusalReason: quotes.refusalReason,
      organizationName: organizations.legalName,
    })
    .from(quotes)
    .innerJoin(clients, eq(clients.id, quotes.clientId))
    .innerJoin(organizations, eq(organizations.id, quotes.organizationId))
    .where(eq(quotes.shareToken, token))
    .limit(1);
  if (!row) return null;

  const [signatureRow] = await db
    .select({
      name: signatures.signerName,
      email: signatures.signerEmail,
      imageKey: signatures.imageKey,
      signedAt: signatures.signedAt,
    })
    .from(signatures)
    .where(eq(signatures.quoteId, row.id))
    .limit(1);

  return {
    ...row,
    status: row.status as QuoteStatus,
    signature: signatureRow ?? null,
  };
}

export interface PublicInvoiceData {
  id: string;
  organizationId: string;
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  status: InvoiceStatus;
  number: string | null;
  dueDate: Date | null;
  totalCents: number;
  amountPaidCents: number;
  /** Émetteur+IBAN/BIC issus du **snapshot** figé à l'émission (H7) — jamais
   * des données live de l'organisation, un token n'existant que pour une
   * facture déjà émise. */
  organizationName: string;
  iban: string | null;
  bic: string | null;
}

/**
 * Accès public par token (share_token, story 14, symétrique de
 * `getQuoteByToken`) : `null` si le token est inconnu, sans distinguer la
 * raison (parade E-27).
 */
export async function getInvoiceByToken(
  db: AppDb,
  token: string,
): Promise<PublicInvoiceData | null> {
  const [row] = await db
    .select({
      id: invoices.id,
      organizationId: invoices.organizationId,
      clientId: invoices.clientId,
      clientName: clients.displayName,
      clientEmail: clients.email,
      status: invoices.status,
      number: invoices.number,
      dueDate: invoices.dueDate,
      totalCents: invoices.totalCents,
      amountPaidCents: invoices.amountPaidCents,
      organizationSnapshot: invoices.organizationSnapshot,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(eq(invoices.shareToken, token))
    .limit(1);
  if (!row) return null;

  return {
    id: row.id,
    organizationId: row.organizationId,
    clientId: row.clientId,
    clientName: row.clientName,
    clientEmail: row.clientEmail,
    status: row.status as InvoiceStatus,
    number: row.number,
    dueDate: row.dueDate,
    totalCents: row.totalCents,
    amountPaidCents: row.amountPaidCents,
    organizationName: row.organizationSnapshot?.legalName ?? "",
    iban: row.organizationSnapshot?.iban ?? null,
    bic: row.organizationSnapshot?.bic ?? null,
  };
}
