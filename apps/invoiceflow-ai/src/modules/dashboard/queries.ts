import { and, asc, desc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import type { AppDb } from "../../db/types";
import { clients, documentEvents, invoices, payments, quotes } from "../../db/schema";

/**
 * Agrégats du dashboard (story 19, E-06) — un bloc = une requête (pas de
 * N+1), `Promise.all` des blocs dans la page. Mois/années : calendrier du
 * process Node, sans conversion Europe/Paris explicite (même simplification
 * assumée que `isQuoteExpired`, story 11 — le fuseau exact n'a jamais été
 * jugé critique pour ces indicateurs).
 */

export interface CashflowStats {
  encaisseAnneeCents: number;
  encaisseAnneePrecedenteCents: number;
  /** `null` si l'année précédente est à 0 (variation non calculable). */
  variationPercent: number | null;
  encaisseMoisCents: number;
  encaisseMoisPrecedentCents: number;
  /** `null` si le mois précédent est à 0 (variation non calculable). */
  variationMoisPercent: number | null;
}

/** Encaissé année civile courante vs précédente, et mois courant vs mois
 * précédent. Aucun remboursement à déduire tant qu'aucun paiement n'est
 * jamais enregistré sur un avoir (H23, plans/ledger.md, story 18). */
export async function getCashflowStats(
  db: AppDb,
  organizationId: string,
): Promise<CashflowStats> {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const prevYearStart = new Date(now.getFullYear() - 1, 0, 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  async function sumSince(from: Date, to?: Date): Promise<number> {
    const conditions = [eq(invoices.organizationId, organizationId), gte(payments.paidAt, from)];
    if (to) conditions.push(lt(payments.paidAt, to));
    const [{ sum }] = await db
      .select({ sum: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int` })
      .from(payments)
      .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
      .where(and(...conditions));
    return sum;
  }

  const [
    encaisseAnneeCents,
    encaisseAnneePrecedenteCents,
    encaisseMoisCents,
    encaisseMoisPrecedentCents,
  ] = await Promise.all([
    sumSince(yearStart),
    sumSince(prevYearStart, yearStart),
    sumSince(monthStart),
    sumSince(prevMonthStart, monthStart),
  ]);

  const variationPercent =
    encaisseAnneePrecedenteCents > 0
      ? Math.round(
          ((encaisseAnneeCents - encaisseAnneePrecedenteCents) / encaisseAnneePrecedenteCents) *
            100,
        )
      : null;

  const variationMoisPercent =
    encaisseMoisPrecedentCents > 0
      ? Math.round(
          ((encaisseMoisCents - encaisseMoisPrecedentCents) / encaisseMoisPrecedentCents) * 100,
        )
      : null;

  return {
    encaisseAnneeCents,
    encaisseAnneePrecedenteCents,
    variationPercent,
    encaisseMoisCents,
    encaisseMoisPrecedentCents,
    variationMoisPercent,
  };
}

export interface EncoursStats {
  enAttenteCents: number;
  enRetardCents: number;
  enRetardCount: number;
}

/** Restes dus des factures actives, ventilés échues/non échues (E-06). */
export async function getEncoursStats(db: AppDb, organizationId: string): Promise<EncoursStats> {
  const rows = await db
    .select({
      status: invoices.status,
      totalCents: invoices.totalCents,
      amountPaidCents: invoices.amountPaidCents,
      dueDate: invoices.dueDate,
    })
    .from(invoices)
    .where(and(eq(invoices.organizationId, organizationId), eq(invoices.kind, "invoice")));

  let enAttenteCents = 0;
  let enRetardCents = 0;
  let enRetardCount = 0;
  const now = new Date();

  for (const row of rows) {
    if (row.status === "draft" || row.status === "cancelled") continue;
    const remaining = row.totalCents - row.amountPaidCents;
    if (remaining <= 0) continue;
    if (row.dueDate && row.dueDate.getTime() < now.getTime()) {
      enRetardCents += remaining;
      enRetardCount += 1;
    } else {
      enAttenteCents += remaining;
    }
  }

  return { enAttenteCents, enRetardCents, enRetardCount };
}

export interface DevisEnCoursStats {
  count: number;
  totalCents: number;
}

/** Devis envoyés/consultés, pas encore signés/refusés/expirés. */
export async function getDevisEnCoursStats(
  db: AppDb,
  organizationId: string,
): Promise<DevisEnCoursStats> {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      sum: sql<number>`coalesce(sum(${quotes.totalCents}), 0)::int`,
    })
    .from(quotes)
    .where(
      and(eq(quotes.organizationId, organizationId), inArray(quotes.status, ["sent", "viewed"])),
    );

  return { count: row.count, totalCents: row.sum };
}

export interface CaParMoisPoint {
  key: string;
  label: string;
  totalCents: number;
}

/** CA net d'avoirs (factures + avoirs, montants déjà signés) par mois
 * d'émission, 12 derniers mois, mois manquants à 0. */
export async function getCaParMois(db: AppDb, organizationId: string): Promise<CaParMoisPoint[]> {
  const points = await getCaVsEncaisseParMois(db, organizationId, 12);
  return points.map((p) => ({ key: p.key, label: p.label, totalCents: p.emisCents }));
}

export interface CaVsEncaissePoint {
  key: string;
  label: string;
  emisCents: number;
  encaisseCents: number;
}

/** CA émis (issueDate) vs encaissé (paidAt) par mois, N derniers mois. */
export async function getCaVsEncaisseParMois(
  db: AppDb,
  organizationId: string,
  monthsCount = 12,
): Promise<CaVsEncaissePoint[]> {
  const now = new Date();
  const months = Array.from({ length: monthsCount }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (monthsCount - 1 - i), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
      year: d.getFullYear(),
      month: d.getMonth(),
    };
  });
  const windowStart = new Date(months[0].year, months[0].month, 1);

  const [invoiceRows, paymentRows] = await Promise.all([
    db
      .select({ issueDate: invoices.issueDate, totalCents: invoices.totalCents })
      .from(invoices)
      .where(
        and(
          eq(invoices.organizationId, organizationId),
          ne(invoices.status, "draft"),
          ne(invoices.status, "cancelled"),
          gte(invoices.issueDate, windowStart),
        ),
      ),
    db
      .select({ paidAt: payments.paidAt, amountCents: payments.amountCents })
      .from(payments)
      .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
      .where(
        and(eq(invoices.organizationId, organizationId), gte(payments.paidAt, windowStart)),
      ),
  ]);

  const emisByMonth = new Map<string, number>();
  for (const row of invoiceRows) {
    if (!row.issueDate) continue;
    const key = `${row.issueDate.getFullYear()}-${String(row.issueDate.getMonth() + 1).padStart(2, "0")}`;
    emisByMonth.set(key, (emisByMonth.get(key) ?? 0) + row.totalCents);
  }

  const encaisseByMonth = new Map<string, number>();
  for (const row of paymentRows) {
    const key = `${row.paidAt.getFullYear()}-${String(row.paidAt.getMonth() + 1).padStart(2, "0")}`;
    encaisseByMonth.set(key, (encaisseByMonth.get(key) ?? 0) + row.amountCents);
  }

  return months.map((m) => ({
    key: m.key,
    label: m.label,
    emisCents: emisByMonth.get(m.key) ?? 0,
    encaisseCents: encaisseByMonth.get(m.key) ?? 0,
  }));
}

export type AgingBucketId = "0-30" | "31-60" | "61-90" | "90+";

export interface AgingBucket {
  bucket: AgingBucketId;
  label: string;
  totalCents: number;
  count: number;
}

const AGING_BUCKETS: { id: AgingBucketId; label: string; min: number; max: number }[] = [
  { id: "0-30", label: "0 – 30 j", min: 0, max: 30 },
  { id: "31-60", label: "31 – 60 j", min: 31, max: 60 },
  { id: "61-90", label: "61 – 90 j", min: 61, max: 90 },
  { id: "90+", label: "90+ j", min: 91, max: Number.POSITIVE_INFINITY },
];

/** Ventilation du reste dû échu par ancienneté (E-06 / trésorerie). */
export async function getAgingBuckets(
  db: AppDb,
  organizationId: string,
): Promise<AgingBucket[]> {
  const rows = await db
    .select({
      status: invoices.status,
      totalCents: invoices.totalCents,
      amountPaidCents: invoices.amountPaidCents,
      dueDate: invoices.dueDate,
    })
    .from(invoices)
    .where(and(eq(invoices.organizationId, organizationId), eq(invoices.kind, "invoice")));

  const totals = new Map<AgingBucketId, { totalCents: number; count: number }>();
  for (const b of AGING_BUCKETS) totals.set(b.id, { totalCents: 0, count: 0 });

  const now = new Date();
  for (const row of rows) {
    if (row.status === "draft" || row.status === "cancelled") continue;
    const remaining = row.totalCents - row.amountPaidCents;
    if (remaining <= 0 || !row.dueDate || row.dueDate.getTime() >= now.getTime()) continue;

    const daysOverdue = Math.floor(
      (now.getTime() - row.dueDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const bucket = AGING_BUCKETS.find((b) => daysOverdue >= b.min && daysOverdue <= b.max);
    if (!bucket) continue;
    const current = totals.get(bucket.id)!;
    current.totalCents += remaining;
    current.count += 1;
  }

  return AGING_BUCKETS.map((b) => {
    const current = totals.get(b.id)!;
    return {
      bucket: b.id,
      label: b.label,
      totalCents: current.totalCents,
      count: current.count,
    };
  });
}

export interface ConversionStats {
  /** Pourcentage 0–100, `null` si aucun devis « sorti » (dénominateur = 0). */
  conversionPercent: number | null;
  signedOrInvoicedCount: number;
  pipelineCount: number;
  panierMoyenCents: number | null;
  /** Délai moyen (jours) entre émission et dernier paiement pour les factures payées. */
  dsoJours: number | null;
}

/** Taux de conversion devis + panier moyen + DSO (délai moyen d'encaissement). */
export async function getConversionStats(
  db: AppDb,
  organizationId: string,
): Promise<ConversionStats> {
  const [quoteRows, avgInvoice, paidInvoices] = await Promise.all([
    db
      .select({ status: quotes.status, count: sql<number>`count(*)::int` })
      .from(quotes)
      .where(eq(quotes.organizationId, organizationId))
      .groupBy(quotes.status),
    db
      .select({
        avg: sql<number | null>`avg(${invoices.totalCents})::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.organizationId, organizationId),
          eq(invoices.kind, "invoice"),
          ne(invoices.status, "draft"),
          ne(invoices.status, "cancelled"),
        ),
      ),
    db
      .select({
        issueDate: invoices.issueDate,
        paidAt: sql<Date>`max(${payments.paidAt})`.as("paid_at"),
      })
      .from(invoices)
      .innerJoin(payments, eq(payments.invoiceId, invoices.id))
      .where(
        and(
          eq(invoices.organizationId, organizationId),
          eq(invoices.kind, "invoice"),
          eq(invoices.status, "paid"),
        ),
      )
      .groupBy(invoices.id, invoices.issueDate),
  ]);

  const counts: Record<string, number> = {};
  for (const row of quoteRows) counts[row.status] = row.count;

  const signedOrInvoicedCount = (counts.signed ?? 0) + (counts.invoiced ?? 0);
  const pipelineCount =
    (counts.sent ?? 0) +
    (counts.viewed ?? 0) +
    (counts.signed ?? 0) +
    (counts.refused ?? 0) +
    (counts.expired ?? 0) +
    (counts.invoiced ?? 0);

  const conversionPercent =
    pipelineCount > 0 ? Math.round((signedOrInvoicedCount / pipelineCount) * 100) : null;

  const panierMoyenCents =
    avgInvoice[0].count > 0 && avgInvoice[0].avg != null ? avgInvoice[0].avg : null;

  let dsoJours: number | null = null;
  if (paidInvoices.length > 0) {
    let sumDays = 0;
    let counted = 0;
    for (const row of paidInvoices) {
      if (!row.issueDate || !row.paidAt) continue;
      const days = Math.max(
        0,
        Math.floor(
          (new Date(row.paidAt).getTime() - row.issueDate.getTime()) / (1000 * 60 * 60 * 24),
        ),
      );
      sumDays += days;
      counted += 1;
    }
    if (counted > 0) dsoJours = Math.round(sumDays / counted);
  }

  return {
    conversionPercent,
    signedOrInvoicedCount,
    pipelineCount,
    panierMoyenCents,
    dsoJours,
  };
}

export interface TopClientRow {
  clientId: string;
  clientName: string;
  caCents: number;
  resteDuCents: number;
}

/** Top clients par CA facturé (hors brouillon/annulé), avec reste dû. */
export async function getTopClients(
  db: AppDb,
  organizationId: string,
  limit = 5,
): Promise<TopClientRow[]> {
  const rows = await db
    .select({
      clientId: invoices.clientId,
      clientName: clients.displayName,
      status: invoices.status,
      totalCents: invoices.totalCents,
      amountPaidCents: invoices.amountPaidCents,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(eq(invoices.organizationId, organizationId), eq(invoices.kind, "invoice")));

  const byClient = new Map<
    string,
    { clientName: string; caCents: number; resteDuCents: number }
  >();

  for (const row of rows) {
    if (row.status === "draft" || row.status === "cancelled") continue;
    const current = byClient.get(row.clientId) ?? {
      clientName: row.clientName,
      caCents: 0,
      resteDuCents: 0,
    };
    current.caCents += row.totalCents;
    const remaining = row.totalCents - row.amountPaidCents;
    if (remaining > 0) current.resteDuCents += remaining;
    byClient.set(row.clientId, current);
  }

  return Array.from(byClient.entries())
    .map(([clientId, data]) => ({
      clientId,
      clientName: data.clientName,
      caCents: data.caCents,
      resteDuCents: data.resteDuCents,
    }))
    .sort((a, b) => b.caCents - a.caCents)
    .slice(0, limit);
}

export interface OverdueInvoiceRow {
  id: string;
  clientName: string;
  number: string | null;
  dueDate: Date;
  remainingCents: number;
  daysOverdue: number;
}

/** Top factures en retard, triées par ancienneté d'échéance décroissante (E-06). */
export async function getFacturesEnRetard(
  db: AppDb,
  organizationId: string,
  limit = 8,
): Promise<OverdueInvoiceRow[]> {
  const now = new Date();
  const rows = await db
    .select({
      id: invoices.id,
      clientName: clients.displayName,
      number: invoices.number,
      dueDate: invoices.dueDate,
      totalCents: invoices.totalCents,
      amountPaidCents: invoices.amountPaidCents,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(
      and(
        eq(invoices.organizationId, organizationId),
        eq(invoices.kind, "invoice"),
        inArray(invoices.status, ["issued", "sent", "viewed", "partially_paid"]),
        sql`${invoices.dueDate} < now()`,
        sql`(${invoices.totalCents} - ${invoices.amountPaidCents}) > 0`,
      ),
    )
    .orderBy(asc(invoices.dueDate))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    clientName: row.clientName,
    number: row.number,
    dueDate: row.dueDate as Date,
    remainingCents: row.totalCents - row.amountPaidCents,
    daysOverdue: Math.max(
      0,
      Math.floor((now.getTime() - (row.dueDate as Date).getTime()) / (1000 * 60 * 60 * 24)),
    ),
  }));
}

export interface RecentQuoteRow {
  id: string;
  clientName: string;
  number: string | null;
  status: string;
  totalCents: number;
  createdAt: Date;
}

/** Derniers devis créés, tous statuts confondus (E-06). */
export async function getDerniersDevis(
  db: AppDb,
  organizationId: string,
  limit = 6,
): Promise<RecentQuoteRow[]> {
  return db
    .select({
      id: quotes.id,
      clientName: clients.displayName,
      number: quotes.number,
      status: quotes.status,
      totalCents: quotes.totalCents,
      createdAt: quotes.createdAt,
    })
    .from(quotes)
    .innerJoin(clients, eq(clients.id, quotes.clientId))
    .where(eq(quotes.organizationId, organizationId))
    .orderBy(desc(quotes.createdAt))
    .limit(limit);
}

export interface RecentActivityRow {
  id: string;
  eventType: string;
  createdAt: Date;
  label: string;
  href: string | null;
}

/** Activité récente toutes entités confondues (devis/factures/avoirs), 2
 * requêtes d'enrichissement par lot (`inArray`) — jamais un N+1 par ligne.
 * Un document supprimé (brouillon) après coup n'a plus de ligne à joindre :
 * l'événement reste affiché avec un libellé générique plutôt que d'être
 * silencieusement perdu (le "top 10" ne doit pas se réduire sans raison). */
export async function getActiviteRecente(
  db: AppDb,
  organizationId: string,
  limit = 10,
): Promise<RecentActivityRow[]> {
  const events = await db
    .select({
      id: documentEvents.id,
      documentType: documentEvents.documentType,
      documentId: documentEvents.documentId,
      eventType: documentEvents.eventType,
      createdAt: documentEvents.createdAt,
    })
    .from(documentEvents)
    .where(eq(documentEvents.organizationId, organizationId))
    .orderBy(desc(documentEvents.createdAt))
    .limit(limit);

  const quoteIds = events.filter((e) => e.documentType === "quote").map((e) => e.documentId);
  const invoiceIds = events.filter((e) => e.documentType !== "quote").map((e) => e.documentId);

  const [quoteRows, invoiceRows] = await Promise.all([
    quoteIds.length
      ? db
          .select({ id: quotes.id, number: quotes.number, clientName: clients.displayName })
          .from(quotes)
          .innerJoin(clients, eq(clients.id, quotes.clientId))
          .where(inArray(quotes.id, quoteIds))
      : Promise.resolve([] as { id: string; number: string | null; clientName: string }[]),
    invoiceIds.length
      ? db
          .select({
            id: invoices.id,
            number: invoices.number,
            clientName: clients.displayName,
            kind: invoices.kind,
          })
          .from(invoices)
          .innerJoin(clients, eq(clients.id, invoices.clientId))
          .where(inArray(invoices.id, invoiceIds))
      : Promise.resolve(
          [] as { id: string; number: string | null; clientName: string; kind: string }[],
        ),
  ]);

  const quoteMap = new Map(quoteRows.map((r) => [r.id, r]));
  const invoiceMap = new Map(invoiceRows.map((r) => [r.id, r]));

  return events.map((event) => {
    if (event.documentType === "quote") {
      const q = quoteMap.get(event.documentId);
      return {
        id: event.id,
        eventType: event.eventType,
        createdAt: event.createdAt,
        label: q ? `${q.number ?? "Devis brouillon"} — ${q.clientName}` : "Devis supprimé",
        href: q ? `/devis/${event.documentId}` : null,
      };
    }
    const inv = invoiceMap.get(event.documentId);
    const prefix = inv?.kind === "credit_note" ? "Avoir" : "Facture";
    return {
      id: event.id,
      eventType: event.eventType,
      createdAt: event.createdAt,
      label: inv
        ? `${inv.number ?? `${prefix} brouillon`} — ${inv.clientName}`
        : "Document supprimé",
      href: inv ? `/factures/${event.documentId}` : null,
    };
  });
}

/** Vrai s'il existe au moins un devis ou une facture (empty state global E-06). */
export async function hasAnyDocument(db: AppDb, organizationId: string): Promise<boolean> {
  const [quote] = await db
    .select({ id: quotes.id })
    .from(quotes)
    .where(eq(quotes.organizationId, organizationId))
    .limit(1);
  if (quote) return true;

  const [invoice] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.organizationId, organizationId))
    .limit(1);
  return Boolean(invoice);
}
