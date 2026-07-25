import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { InvoiceStatus, QuoteStatus } from "@daromsart/core";
import type { AppDb } from "../../db/types";
import { listClients } from "../clients/queries";
import { listInvoices } from "../invoices/queries";
import { listQuotes } from "../quotes/queries";
import { getCashflowStats, getEncoursStats } from "../dashboard/queries";
import type {
  ClientsToolOutput,
  DashboardStatsOutput,
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
  };
}
