import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { QuoteStatus } from "@daromsart/core";
import type { AppDb } from "../../db/types";
import { clients, quoteLines, quotes } from "../../db/schema";

/**
 * Requêtes pures (sans `server-only`/Next), injectables avec n'importe quelle
 * connexion Drizzle — testables en intégration contre la base de test.
 */

export interface QuoteRow {
  id: string;
  clientId: string;
  clientName: string;
  status: QuoteStatus;
  number: string | null;
  issueDate: Date | null;
  validUntil: Date | null;
  totalCents: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListQuotesParams {
  organizationId: string;
  /** `"all"` = tous statuts confondus (onglet "Tous"). */
  status?: QuoteStatus | "all";
  /** Recherche sur le nom du client ou le numéro de devis. */
  q?: string;
  /** 1-indexée. */
  page: number;
  pageSize: number;
}

export interface ListQuotesResult {
  items: QuoteRow[];
  total: number;
  page: number;
  pageCount: number;
}

function toQuoteRow(row: {
  id: string;
  clientId: string;
  clientName: string;
  status: string;
  number: string | null;
  issueDate: Date | null;
  validUntil: Date | null;
  totalCents: number;
  createdAt: Date;
  updatedAt: Date;
}): QuoteRow {
  return { ...row, status: row.status as QuoteStatus };
}

export async function listQuotes(
  db: AppDb,
  params: ListQuotesParams,
): Promise<ListQuotesResult> {
  const page = Math.max(1, params.page);
  const pageSize = params.pageSize;

  const conditions = [eq(quotes.organizationId, params.organizationId)];
  if (params.status && params.status !== "all") {
    conditions.push(eq(quotes.status, params.status));
  }
  if (params.q?.trim()) {
    const term = `%${params.q.trim()}%`;
    conditions.push(
      or(ilike(clients.displayName, term), ilike(quotes.number, term))!,
    );
  }
  const where = and(...conditions);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(quotes)
    .innerJoin(clients, eq(clients.id, quotes.clientId))
    .where(where);

  const items = await db
    .select({
      id: quotes.id,
      clientId: quotes.clientId,
      clientName: clients.displayName,
      status: quotes.status,
      number: quotes.number,
      issueDate: quotes.issueDate,
      validUntil: quotes.validUntil,
      totalCents: quotes.totalCents,
      createdAt: quotes.createdAt,
      updatedAt: quotes.updatedAt,
    })
    .from(quotes)
    .innerJoin(clients, eq(clients.id, quotes.clientId))
    .where(where)
    .orderBy(desc(quotes.updatedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const pageCount = Math.max(1, Math.ceil(count / pageSize));

  return { items: items.map(toQuoteRow), total: count, page, pageCount };
}

/** Nombre de devis par statut (compteurs des onglets-filtres, E-10). */
export async function getQuoteStatusCounts(
  db: AppDb,
  organizationId: string,
): Promise<Record<QuoteStatus, number>> {
  const rows = await db
    .select({ status: quotes.status, count: sql<number>`count(*)::int` })
    .from(quotes)
    .where(eq(quotes.organizationId, organizationId))
    .groupBy(quotes.status);

  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = row.count;
  return counts as Record<QuoteStatus, number>;
}

export interface QuoteLineRow {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  vatRate: number;
  discount: { type: "percent" | "amount"; value: number } | null;
  position: number;
}

export interface QuoteDetail {
  id: string;
  organizationId: string;
  clientId: string;
  clientName: string;
  status: QuoteStatus;
  number: string | null;
  issueDate: Date | null;
  validUntil: Date | null;
  notes: string | null;
  globalDiscount: { type: "percent" | "amount"; value: number } | null;
  subtotalCents: number;
  discountCents: number;
  vatByRate: Record<string, number>;
  totalCents: number;
  createdAt: Date;
  updatedAt: Date;
  lines: QuoteLineRow[];
}

export async function getQuoteById(
  db: AppDb,
  organizationId: string,
  id: string,
): Promise<QuoteDetail | null> {
  const [quote] = await db
    .select({
      id: quotes.id,
      organizationId: quotes.organizationId,
      clientId: quotes.clientId,
      clientName: clients.displayName,
      status: quotes.status,
      number: quotes.number,
      issueDate: quotes.issueDate,
      validUntil: quotes.validUntil,
      notes: quotes.notes,
      globalDiscountType: quotes.globalDiscountType,
      globalDiscountValue: quotes.globalDiscountValue,
      subtotalCents: quotes.subtotalCents,
      discountCents: quotes.discountCents,
      vatByRate: quotes.vatByRate,
      totalCents: quotes.totalCents,
      createdAt: quotes.createdAt,
      updatedAt: quotes.updatedAt,
    })
    .from(quotes)
    .innerJoin(clients, eq(clients.id, quotes.clientId))
    .where(and(eq(quotes.id, id), eq(quotes.organizationId, organizationId)))
    .limit(1);
  if (!quote) return null;

  const lineRows = await db
    .select()
    .from(quoteLines)
    .where(eq(quoteLines.quoteId, id))
    .orderBy(asc(quoteLines.position));

  return {
    id: quote.id,
    organizationId: quote.organizationId,
    clientId: quote.clientId,
    clientName: quote.clientName,
    status: quote.status as QuoteStatus,
    number: quote.number,
    issueDate: quote.issueDate,
    validUntil: quote.validUntil,
    notes: quote.notes,
    globalDiscount: quote.globalDiscountType
      ? {
          type: quote.globalDiscountType,
          value: Number(quote.globalDiscountValue),
        }
      : null,
    subtotalCents: quote.subtotalCents,
    discountCents: quote.discountCents,
    vatByRate: quote.vatByRate,
    totalCents: quote.totalCents,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
    lines: lineRows.map((line) => ({
      id: line.id,
      description: line.description,
      quantity: Number(line.quantity),
      unitPriceCents: line.unitPriceCents,
      vatRate: Number(line.vatRate),
      discount: line.discountType
        ? { type: line.discountType, value: Number(line.discountValue) }
        : null,
      position: line.position,
    })),
  };
}

/** Devis d'un client (fiche client, onglet Devis). */
export async function listQuotesForClient(
  db: AppDb,
  organizationId: string,
  clientId: string,
): Promise<QuoteRow[]> {
  const items = await db
    .select({
      id: quotes.id,
      clientId: quotes.clientId,
      clientName: clients.displayName,
      status: quotes.status,
      number: quotes.number,
      issueDate: quotes.issueDate,
      validUntil: quotes.validUntil,
      totalCents: quotes.totalCents,
      createdAt: quotes.createdAt,
      updatedAt: quotes.updatedAt,
    })
    .from(quotes)
    .innerJoin(clients, eq(clients.id, quotes.clientId))
    .where(
      and(eq(quotes.organizationId, organizationId), eq(quotes.clientId, clientId)),
    )
    .orderBy(desc(quotes.updatedAt));

  return items.map(toQuoteRow);
}
