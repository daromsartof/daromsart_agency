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
}

/** Encaissé année civile courante vs précédente. Aucun remboursement à
 * déduire tant qu'aucun paiement n'est jamais enregistré sur un avoir (H23,
 * plans/ledger.md, story 18). */
export async function getCashflowStats(
  db: AppDb,
  organizationId: string,
): Promise<CashflowStats> {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const prevYearStart = new Date(now.getFullYear() - 1, 0, 1);

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

  const [encaisseAnneeCents, encaisseAnneePrecedenteCents] = await Promise.all([
    sumSince(yearStart),
    sumSince(prevYearStart, yearStart),
  ]);

  const variationPercent =
    encaisseAnneePrecedenteCents > 0
      ? Math.round(
          ((encaisseAnneeCents - encaisseAnneePrecedenteCents) / encaisseAnneePrecedenteCents) *
            100,
        )
      : null;

  return { encaisseAnneeCents, encaisseAnneePrecedenteCents, variationPercent };
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
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
      year: d.getFullYear(),
      month: d.getMonth(),
    };
  });
  const windowStart = new Date(months[0].year, months[0].month, 1);

  const rows = await db
    .select({ issueDate: invoices.issueDate, totalCents: invoices.totalCents })
    .from(invoices)
    .where(
      and(
        eq(invoices.organizationId, organizationId),
        ne(invoices.status, "draft"),
        ne(invoices.status, "cancelled"),
        gte(invoices.issueDate, windowStart),
      ),
    );

  const totalsByMonth = new Map<string, number>();
  for (const row of rows) {
    if (!row.issueDate) continue;
    const key = `${row.issueDate.getFullYear()}-${String(row.issueDate.getMonth() + 1).padStart(2, "0")}`;
    totalsByMonth.set(key, (totalsByMonth.get(key) ?? 0) + row.totalCents);
  }

  return months.map((m) => ({
    key: m.key,
    label: m.label,
    totalCents: totalsByMonth.get(m.key) ?? 0,
  }));
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
