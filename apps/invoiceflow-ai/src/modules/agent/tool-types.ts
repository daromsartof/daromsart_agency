/**
 * Types des SORTIES d'outils — sans secret ni import serveur, partagés par
 * `tools.ts` (serveur) et les composants de generative UI (client). Les outils
 * renvoient des chaînes déjà formatées (montants €, dates fr) : le modèle ET
 * l'UI consomment les mêmes valeurs lisibles, sans reformatage côté client.
 */

export interface ClientLite {
  id: string;
  name: string;
  email: string | null;
}
export interface ClientsToolOutput {
  total: number;
  clients: ClientLite[];
}

export interface InvoiceLite {
  id: string;
  number: string | null;
  clientName: string;
  status: string;
  total: string;
  reste: string;
  echeance: string | null;
}
export interface InvoicesToolOutput {
  total: number;
  invoices: InvoiceLite[];
}

export interface QuoteLite {
  id: string;
  number: string | null;
  clientName: string;
  status: string;
  total: string;
  validite: string | null;
}
export interface QuotesToolOutput {
  total: number;
  quotes: QuoteLite[];
}

export interface DashboardStatsOutput {
  encaisseMois: string;
  encaisseAnnee: string;
  enAttente: string;
  enRetard: string;
  enRetardCount: number;
}

export interface InvoiceLineLite {
  description: string;
  quantity: number;
  unitPrice: string;
  vatRate: number;
  total: string;
}

/** Détail d'une facture + URL PDF (preview / téléchargement dans le chat). */
export interface InvoiceDetailToolOutput {
  found: boolean;
  id?: string;
  number?: string | null;
  clientName?: string;
  status?: string;
  issueDate?: string | null;
  dueDate?: string | null;
  subtotal?: string;
  total?: string;
  reste?: string;
  notes?: string | null;
  lines?: InvoiceLineLite[];
  /** Chemin app authentifié — iframe + lien download côté UI. */
  pdfUrl?: string;
  pdfFilename?: string;
  message?: string;
}

export interface AskUserOutput {
  question: string;
  options: string[];
}

/** Noms d'outils exposés au modèle (sert aussi au routage de la generative UI). */
export const AGENT_TOOL_NAMES = [
  "listClients",
  "listInvoices",
  "listQuotes",
  "getDashboardStats",
  "getInvoiceDetail",
  "askUser",
  "proposeCreateClient",
] as const;
export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number];
