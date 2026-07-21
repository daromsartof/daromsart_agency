import type { Storage } from "@daromsart/storage";
import type { AppDb } from "../../db/types";
import { resolveQuotePdfBuffer, type QuotePdfFile } from "../documents/pdf";
import { resolveInvoicePdfBuffer, type InvoicePdfFile } from "../invoices/pdf";
import { getInvoiceByToken, getQuoteByToken } from "./queries";

/** Résout le PDF pour la page publique (E-25) — même logique que la route
 * interne (archive signée si présente, sinon rendu à la volée), via token. */
export async function resolvePublicQuotePdfBuffer(
  db: AppDb,
  storage: Storage,
  token: string,
): Promise<QuotePdfFile | null> {
  const quote = await getQuoteByToken(db, token);
  if (!quote) return null;
  return resolveQuotePdfBuffer(db, storage, quote.organizationId, quote.id);
}

/** Résout le PDF facture pour la page publique (story 14), via token. */
export async function resolvePublicInvoicePdfBuffer(
  db: AppDb,
  storage: Storage,
  token: string,
): Promise<InvoicePdfFile | null> {
  const invoice = await getInvoiceByToken(db, token);
  if (!invoice) return null;
  return resolveInvoicePdfBuffer(db, storage, invoice.organizationId, invoice.id);
}
