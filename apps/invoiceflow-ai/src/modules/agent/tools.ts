import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { InvoiceStatus, QuoteStatus } from "@daromsart/core";
import type { AppDb } from "../../db/types";
import { listClients } from "../clients/queries";
import { getInvoiceById, listInvoices } from "../invoices/queries";
import { listQuotes } from "../quotes/queries";
import { getCashflowStats, getEncoursStats } from "../dashboard/queries";
import type {
  ClientsToolOutput,
  DashboardStatsOutput,
  InvoiceDetailToolOutput,
  InvoicesToolOutput,
  QuotesToolOutput,
} from "./tool-types";

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const money = (cents: number) => eur.format(cents / 100);
const date = (d: Date | null) => (d ? d.toLocaleDateString("fr-FR") : null);

const INVOICE_STATUSES: (InvoiceStatus | "all" | "overdue")[] = [
  "all",
  "overdue",
  "draft",
  "issued",
  "sent",
  "viewed",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
];
const QUOTE_STATUSES: (QuoteStatus | "all")[] = [
  "all",
  "draft",
  "sent",
  "viewed",
  "signed",
  "refused",
  "expired",
  "invoiced",
];

/**
 * Outils de LECTURE du copilote (story 27) — org-scopés (organizationId lié à
 * la construction) et réutilisant les `queries.ts` existantes : l'agent ne
 * réimplémente aucune logique métier, il l'appelle. Les sorties sont
 * pré-formatées (€, dates fr) pour le modèle ET l'UI. Schémas volontairement
 * simples (chaînes/nombres optionnels) pour rester compatibles Gemini ET Claude.
 */
export function createAgentTools(db: AppDb, organizationId: string): ToolSet {
  return {
    listClients: tool({
      description:
        "Liste les clients de l'organisation. Utilise `search` pour filtrer par nom ou email.",
      inputSchema: z.object({
        search: z.string().optional().describe("Filtre nom/email (optionnel)"),
        limit: z.number().int().min(1).max(50).optional().describe("Nombre max (défaut 20)"),
      }),
      execute: async ({ search, limit }): Promise<ClientsToolOutput> => {
        const res = await listClients(db, {
          organizationId,
          q: search,
          page: 1,
          pageSize: limit ?? 20,
        });
        return {
          total: res.total,
          clients: res.items.map((c) => ({
            id: c.id,
            name: c.displayName,
            email: c.email ?? null,
          })),
        };
      },
    }),

    listInvoices: tool({
      description:
        "Liste les factures. `status` accepte un statut, `all`, ou `overdue` (échues impayées). `search` filtre par client ou numéro.",
      inputSchema: z.object({
        status: z.string().optional().describe("Statut, 'all' ou 'overdue' (optionnel)"),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async ({ status, search, limit }): Promise<InvoicesToolOutput> => {
        const safeStatus = (
          status && INVOICE_STATUSES.includes(status as InvoiceStatus | "all" | "overdue")
            ? status
            : "all"
        ) as InvoiceStatus | "all";
        const res = await listInvoices(db, {
          organizationId,
          status: safeStatus,
          q: search,
          page: 1,
          pageSize: limit ?? 20,
        });
        return {
          total: res.total,
          invoices: res.items.map((i) => ({
            id: i.id,
            number: i.number,
            clientName: i.clientName,
            status: i.status,
            total: money(i.totalCents),
            reste: money(i.totalCents - i.amountPaidCents),
            echeance: date(i.dueDate),
          })),
        };
      },
    }),

    listQuotes: tool({
      description: "Liste les devis. `status` accepte un statut ou `all`. `search` filtre par client ou numéro.",
      inputSchema: z.object({
        status: z.string().optional().describe("Statut ou 'all' (optionnel)"),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async ({ status, search, limit }): Promise<QuotesToolOutput> => {
        const safeStatus = (
          status && QUOTE_STATUSES.includes(status as QuoteStatus | "all") ? status : "all"
        ) as QuoteStatus | "all";
        const res = await listQuotes(db, {
          organizationId,
          status: safeStatus,
          q: search,
          page: 1,
          pageSize: limit ?? 20,
        });
        return {
          total: res.total,
          quotes: res.items.map((q) => ({
            id: q.id,
            number: q.number,
            clientName: q.clientName,
            status: q.status,
            total: money(q.totalCents),
            validite: date(q.validUntil),
          })),
        };
      },
    }),

    getDashboardStats: tool({
      description:
        "Indicateurs clés : encaissé (mois/année), encours en attente et en retard. Aucun paramètre.",
      inputSchema: z.object({}),
      execute: async (): Promise<DashboardStatsOutput> => {
        const [cashflow, encours] = await Promise.all([
          getCashflowStats(db, organizationId),
          getEncoursStats(db, organizationId),
        ]);
        return {
          encaisseMois: money(cashflow.encaisseMoisCents),
          encaisseAnnee: money(cashflow.encaisseAnneeCents),
          enAttente: money(encours.enAttenteCents),
          enRetard: money(encours.enRetardCents),
          enRetardCount: encours.enRetardCount,
        };
      },
    }),

    getInvoiceDetail: tool({
      description:
        "Détail d'UNE facture avec aperçu PDF. À utiliser quand l'utilisateur consulte une facture précise (par id ou numéro, ex. FAC-2026-0072). Affiche le PDF dans le chat.",
      inputSchema: z.object({
        invoiceId: z.string().optional().describe("UUID de la facture (si connu)"),
        number: z
          .string()
          .optional()
          .describe("Numéro de facture (ex. FAC-2026-0072)"),
      }),
      execute: async ({ invoiceId, number }): Promise<InvoiceDetailToolOutput> => {
        let id = invoiceId?.trim() || null;
        if (!id && number?.trim()) {
          const res = await listInvoices(db, {
            organizationId,
            status: "all",
            q: number.trim(),
            page: 1,
            pageSize: 10,
          });
          const exact = res.items.find(
            (i) => i.number?.toLowerCase() === number.trim().toLowerCase(),
          );
          id = (exact ?? res.items[0])?.id ?? null;
        }
        if (!id) {
          return {
            found: false,
            message: "Indiquez un numéro ou un id de facture.",
          };
        }

        const invoice = await getInvoiceById(db, organizationId, id);
        if (!invoice) {
          return { found: false, message: "Facture introuvable." };
        }

        const lineTotal = (qty: number, unitCents: number, vat: number) => {
          const ht = Math.round(qty * unitCents);
          return money(Math.round(ht * (1 + vat / 100)));
        };

        const filename = `${invoice.number ?? `facture-${invoice.id}`}.pdf`;
        return {
          found: true,
          id: invoice.id,
          number: invoice.number,
          clientName: invoice.clientName,
          status: invoice.status,
          issueDate: date(invoice.issueDate),
          dueDate: date(invoice.dueDate),
          subtotal: money(invoice.subtotalCents),
          total: money(invoice.totalCents),
          reste: money(invoice.totalCents - invoice.amountPaidCents),
          notes: invoice.notes,
          lines: invoice.lines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unitPrice: money(l.unitPriceCents),
            vatRate: l.vatRate,
            total: lineTotal(l.quantity, l.unitPriceCents, l.vatRate),
          })),
          pdfUrl: `/api/documents/factures/${invoice.id}/pdf`,
          pdfFilename: filename,
        };
      },
    }),

    askUser: tool({
      description:
        "Pose une question à l'utilisateur quand une information manque pour continuer. Fournis 2 à 6 `options` cliquables si un choix fermé est possible. Attends la réponse avant de poursuivre.",
      inputSchema: z.object({
        question: z.string().describe("La question posée à l'utilisateur"),
        options: z
          .array(z.string())
          .min(2)
          .max(6)
          .optional()
          .describe("Choix cliquables (optionnel)"),
      }),
      // Pas d'`execute` : outil résolu par l'HUMAIN (carte cliquable côté client
      // → `addToolResult`), pas par le serveur.
    }),

    proposeCreateClient: tool({
      description:
        "PROPOSE la création d'un client — N'ÉCRIT RIEN. L'utilisateur doit confirmer dans le chat (carte Confirmer/Annuler) avant toute écriture. Fournis au moins `type` et `displayName`.",
      inputSchema: z.object({
        type: z.string().describe("'company' (entreprise) ou 'individual' (particulier)"),
        displayName: z.string().min(1).describe("Nom affiché du client"),
        email: z.string().optional(),
        phone: z.string().optional(),
        siret: z.string().optional(),
        vatNumber: z.string().optional(),
        addressStreet: z.string().optional(),
        addressZip: z.string().optional(),
        addressCity: z.string().optional(),
      }),
      // Pas d'`execute` : l'ÉCRITURE est déclenchée par le clic « Confirmer »
      // côté client (createClientAction, avec auth + validation zod serveur),
      // jamais automatiquement par le modèle.
    }),
  };
}
