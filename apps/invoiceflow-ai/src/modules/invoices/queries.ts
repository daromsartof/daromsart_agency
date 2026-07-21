import { and, asc, desc, eq, gte, ilike, or, sql } from "drizzle-orm";
import type { InvoiceStatus } from "@daromsart/core";
import type { AppDb } from "../../db/types";
import {
  clients,
  invoiceLines,
  invoices,
  payments,
  type InvoiceClientSnapshot,
  type InvoiceOrgSnapshot,
} from "../../db/schema";

/**
 * Requêtes pures (sans `server-only`/Next), injectables avec n'importe quelle
 * connexion Drizzle — testables en intégration. Miroir de `modules/quotes/
 * queries.ts` (story 07/08), adapté aux spécificités facture : `kind`
 * (invoice/avoir), échéance, `overdue` calculé (jamais stocké, H15).
 */

function overdueCondition(alias = invoices) {
  return sql`${alias.dueDate} < now() and (${alias.totalCents} - ${alias.amountPaidCents}) > 0 and ${alias.status} in ('issued', 'sent', 'viewed', 'partially_paid')`;
}

export interface InvoiceRow {
  id: string;
  clientId: string;
  clientName: string;
  kind: "invoice" | "credit_note";
  status: InvoiceStatus;
  number: string | null;
  issueDate: Date | null;
  dueDate: Date | null;
  totalCents: number;
  amountPaidCents: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListInvoicesParams {
  organizationId: string;
  /** `"all"` = tous statuts confondus. `"overdue"` = filtre calculé (jamais un statut stocké). */
  status?: InvoiceStatus | "all";
  kind?: "invoice" | "credit_note";
  q?: string;
  page: number;
  pageSize: number;
}

export interface ListInvoicesResult {
  items: InvoiceRow[];
  total: number;
  page: number;
  pageCount: number;
}

function toInvoiceRow(row: {
  id: string;
  clientId: string;
  clientName: string;
  kind: string;
  status: string;
  number: string | null;
  issueDate: Date | null;
  dueDate: Date | null;
  totalCents: number;
  amountPaidCents: number;
  createdAt: Date;
  updatedAt: Date;
}): InvoiceRow {
  return {
    ...row,
    kind: row.kind as "invoice" | "credit_note",
    status: row.status as InvoiceStatus,
  };
}

export async function listInvoices(
  db: AppDb,
  params: ListInvoicesParams,
): Promise<ListInvoicesResult> {
  const page = Math.max(1, params.page);
  const pageSize = params.pageSize;

  const conditions = [
    eq(invoices.organizationId, params.organizationId),
    eq(invoices.kind, params.kind ?? "invoice"),
  ];
  if (params.status && params.status !== "all") {
    conditions.push(
      params.status === "overdue" ? overdueCondition() : eq(invoices.status, params.status),
    );
  }
  if (params.q?.trim()) {
    const term = `%${params.q.trim()}%`;
    conditions.push(or(ilike(clients.displayName, term), ilike(invoices.number, term))!);
  }
  const where = and(...conditions);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(where);

  const items = await db
    .select({
      id: invoices.id,
      clientId: invoices.clientId,
      clientName: clients.displayName,
      kind: invoices.kind,
      status: invoices.status,
      number: invoices.number,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      totalCents: invoices.totalCents,
      amountPaidCents: invoices.amountPaidCents,
      createdAt: invoices.createdAt,
      updatedAt: invoices.updatedAt,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(where)
    .orderBy(desc(invoices.updatedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const pageCount = Math.max(1, Math.ceil(count / pageSize));

  return { items: items.map(toInvoiceRow), total: count, page, pageCount };
}

export interface InvoiceStatusCounts extends Partial<Record<InvoiceStatus, number>> {
  overdue: number;
}

/** Compteurs des onglets-filtres (E-14). `overdue` : condition calculée, pas un GROUP BY. */
export async function getInvoiceStatusCounts(
  db: AppDb,
  organizationId: string,
  kind: "invoice" | "credit_note" = "invoice",
): Promise<InvoiceStatusCounts> {
  const rows = await db
    .select({ status: invoices.status, count: sql<number>`count(*)::int` })
    .from(invoices)
    .where(and(eq(invoices.organizationId, organizationId), eq(invoices.kind, kind)))
    .groupBy(invoices.status);

  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = row.count;

  const [{ count: overdueCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(invoices)
    .where(
      and(
        eq(invoices.organizationId, organizationId),
        eq(invoices.kind, kind),
        overdueCondition(),
      ),
    );

  return { ...counts, overdue: overdueCount } as InvoiceStatusCounts;
}

export interface InvoiceLineRow {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  vatRate: number;
  discount: { type: "percent" | "amount"; value: number } | null;
  position: number;
}

export interface InvoiceDetail {
  id: string;
  organizationId: string;
  clientId: string;
  clientName: string;
  templateId: string | null;
  quoteId: string | null;
  kind: "invoice" | "credit_note";
  parentInvoiceId: string | null;
  status: InvoiceStatus;
  number: string | null;
  shareToken: string | null;
  sentAt: Date | null;
  viewedAt: Date | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
  lastReminderAt: Date | null;
  issueDate: Date | null;
  dueDate: Date | null;
  notes: string | null;
  globalDiscount: { type: "percent" | "amount"; value: number } | null;
  subtotalCents: number;
  discountCents: number;
  vatByRate: Record<string, number>;
  totalCents: number;
  amountPaidCents: number;
  organizationSnapshot: InvoiceOrgSnapshot | null;
  clientSnapshot: InvoiceClientSnapshot | null;
  createdAt: Date;
  updatedAt: Date;
  lines: InvoiceLineRow[];
}

export async function getInvoiceById(
  db: AppDb,
  organizationId: string,
  id: string,
): Promise<InvoiceDetail | null> {
  const [invoice] = await db
    .select({
      id: invoices.id,
      organizationId: invoices.organizationId,
      clientId: invoices.clientId,
      clientName: clients.displayName,
      templateId: invoices.templateId,
      quoteId: invoices.quoteId,
      kind: invoices.kind,
      parentInvoiceId: invoices.parentInvoiceId,
      status: invoices.status,
      number: invoices.number,
      shareToken: invoices.shareToken,
      sentAt: invoices.sentAt,
      viewedAt: invoices.viewedAt,
      paidAt: invoices.paidAt,
      cancelledAt: invoices.cancelledAt,
      lastReminderAt: invoices.lastReminderAt,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      notes: invoices.notes,
      globalDiscountType: invoices.globalDiscountType,
      globalDiscountValue: invoices.globalDiscountValue,
      subtotalCents: invoices.subtotalCents,
      discountCents: invoices.discountCents,
      vatByRate: invoices.vatByRate,
      totalCents: invoices.totalCents,
      amountPaidCents: invoices.amountPaidCents,
      organizationSnapshot: invoices.organizationSnapshot,
      clientSnapshot: invoices.clientSnapshot,
      createdAt: invoices.createdAt,
      updatedAt: invoices.updatedAt,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(eq(invoices.id, id), eq(invoices.organizationId, organizationId)))
    .limit(1);
  if (!invoice) return null;

  const lineRows = await db
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, id))
    .orderBy(asc(invoiceLines.position));

  return {
    id: invoice.id,
    organizationId: invoice.organizationId,
    clientId: invoice.clientId,
    clientName: invoice.clientName,
    templateId: invoice.templateId,
    quoteId: invoice.quoteId,
    kind: invoice.kind as "invoice" | "credit_note",
    parentInvoiceId: invoice.parentInvoiceId,
    status: invoice.status as InvoiceStatus,
    number: invoice.number,
    shareToken: invoice.shareToken,
    sentAt: invoice.sentAt,
    viewedAt: invoice.viewedAt,
    paidAt: invoice.paidAt,
    cancelledAt: invoice.cancelledAt,
    lastReminderAt: invoice.lastReminderAt,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    notes: invoice.notes,
    globalDiscount: invoice.globalDiscountType
      ? { type: invoice.globalDiscountType, value: Number(invoice.globalDiscountValue) }
      : null,
    subtotalCents: invoice.subtotalCents,
    discountCents: invoice.discountCents,
    vatByRate: invoice.vatByRate,
    totalCents: invoice.totalCents,
    amountPaidCents: invoice.amountPaidCents,
    organizationSnapshot: invoice.organizationSnapshot,
    clientSnapshot: invoice.clientSnapshot,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
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

/** Factures d'un client (fiche client, onglet Factures). */
export async function listInvoicesForClient(
  db: AppDb,
  organizationId: string,
  clientId: string,
): Promise<InvoiceRow[]> {
  const items = await db
    .select({
      id: invoices.id,
      clientId: invoices.clientId,
      clientName: clients.displayName,
      kind: invoices.kind,
      status: invoices.status,
      number: invoices.number,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      totalCents: invoices.totalCents,
      amountPaidCents: invoices.amountPaidCents,
      createdAt: invoices.createdAt,
      updatedAt: invoices.updatedAt,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(
      and(eq(invoices.organizationId, organizationId), eq(invoices.clientId, clientId)),
    )
    .orderBy(desc(invoices.updatedAt));

  return items.map(toInvoiceRow);
}

export interface ClientInvoiceStats {
  caFactureCents: number;
  encoursCents: number;
  retardCents: number;
}

/**
 * Statistiques réelles de la fiche client (story 12 — remplace le stub
 * zéro de la story 06, signature verrouillée) :
 * - CA facturé = Σ factures émises non annulées (avoirs déduits, kind
 *   confondus : un avoir a des montants négatifs) ;
 * - encours = Σ restes dus des factures actives (émises, pas payées, pas
 *   annulées) ;
 * - retard = Σ restes dus des factures actives ET échues.
 */
export async function getClientInvoiceStats(
  db: AppDb,
  organizationId: string,
  clientId: string,
): Promise<ClientInvoiceStats> {
  const rows = await db
    .select({
      status: invoices.status,
      totalCents: invoices.totalCents,
      amountPaidCents: invoices.amountPaidCents,
      dueDate: invoices.dueDate,
    })
    .from(invoices)
    .where(and(eq(invoices.organizationId, organizationId), eq(invoices.clientId, clientId)));

  let caFactureCents = 0;
  let encoursCents = 0;
  let retardCents = 0;
  const now = new Date();

  for (const row of rows) {
    if (row.status === "draft" || row.status === "cancelled") continue;
    caFactureCents += row.totalCents;

    const remaining = row.totalCents - row.amountPaidCents;
    if (remaining <= 0) continue;
    encoursCents += remaining;
    if (row.dueDate && row.dueDate.getTime() < now.getTime()) {
      retardCents += remaining;
    }
  }

  return { caFactureCents, encoursCents, retardCents };
}

export interface InvoiceDashboardStats {
  encoursCents: number;
  retardCents: number;
  encaisseMoisCents: number;
}

/**
 * Mini-StatCards de `/factures` (E-14) : mêmes définitions qu'`ClientInvoiceStats`
 * mais toutes factures de l'organisation confondues, plus l'encaissé du mois
 * en cours (Σ `payments.amountCents`, structure prête depuis cette story,
 * alimentée en story 15 — vaut donc 0 tant qu'aucun paiement n'est saisi).
 */
export async function getInvoiceDashboardStats(
  db: AppDb,
  organizationId: string,
): Promise<InvoiceDashboardStats> {
  const rows = await db
    .select({
      status: invoices.status,
      totalCents: invoices.totalCents,
      amountPaidCents: invoices.amountPaidCents,
      dueDate: invoices.dueDate,
    })
    .from(invoices)
    .where(and(eq(invoices.organizationId, organizationId), eq(invoices.kind, "invoice")));

  let encoursCents = 0;
  let retardCents = 0;
  const now = new Date();

  for (const row of rows) {
    if (row.status === "draft" || row.status === "cancelled") continue;
    const remaining = row.totalCents - row.amountPaidCents;
    if (remaining <= 0) continue;
    encoursCents += remaining;
    if (row.dueDate && row.dueDate.getTime() < now.getTime()) {
      retardCents += remaining;
    }
  }

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [{ sum: encaisseMoisCents }] = await db
    .select({ sum: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int` })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .where(and(eq(invoices.organizationId, organizationId), gte(payments.paidAt, monthStart)));

  return { encoursCents, retardCents, encaisseMoisCents };
}
