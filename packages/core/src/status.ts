/** Machine à états devis (H14). `invoiced` = converti en facture après signature. */
export type QuoteStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "signed"
  | "refused"
  | "expired"
  | "invoiced";

/** Machine à états facture (H15). `overdue`/`cancelled` = déclenchés par des règles, pas par l'utilisateur directement, mais modélisés comme transitions valides. */
export type InvoiceStatus =
  | "draft"
  | "issued"
  | "sent"
  | "viewed"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled";

const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ["sent"],
  sent: ["viewed", "signed", "refused", "expired"],
  viewed: ["signed", "refused", "expired"],
  signed: ["invoiced"],
  refused: [],
  expired: [],
  invoiced: [],
};

/**
 * `issued`/`sent` → `partially_paid`/`paid` (story 15) : un paiement peut
 * arriver avant même que le client n'ait consulté la facture (règlement
 * comptant, virement anticipé…) — `recordPayment` exige seulement que la
 * facture soit émise (ni `draft` ni `cancelled`), pas qu'elle soit `viewed`.
 * `paid → partially_paid` : SEULE transition arrière, empruntée exclusivement
 * par `deletePayment` (suppression admin d'un paiement qui faisait passer la
 * facture sous le seuil `paid` — jamais déclenchée par une action utilisateur
 * directe). Toute autre régression (retour à `issued`/`sent`/`viewed`) n'est
 * PAS modélisée : si `deletePayment` ramène `amount_paid_cents` à zéro, le
 * statut reste `partially_paid` plutôt que de reconstruire un état antérieur.
 */
const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["issued"],
  issued: ["sent", "cancelled", "partially_paid", "paid"],
  sent: ["viewed", "overdue", "cancelled", "partially_paid", "paid"],
  viewed: ["partially_paid", "paid", "overdue", "cancelled"],
  partially_paid: ["paid", "overdue", "cancelled"],
  overdue: ["partially_paid", "paid", "cancelled"],
  paid: ["partially_paid"],
  cancelled: [],
};

export type DocumentKind = "quote" | "invoice";

/** `false` si `from === to` : une transition change toujours d'état. */
export function canTransition(
  kind: "quote",
  from: QuoteStatus,
  to: QuoteStatus,
): boolean;
export function canTransition(
  kind: "invoice",
  from: InvoiceStatus,
  to: InvoiceStatus,
): boolean;
export function canTransition(
  kind: DocumentKind,
  from: QuoteStatus | InvoiceStatus,
  to: QuoteStatus | InvoiceStatus,
): boolean {
  if (from === to) return false;
  const table = kind === "quote" ? QUOTE_TRANSITIONS : INVOICE_TRANSITIONS;
  const allowed = (table as Record<string, string[]>)[from];
  return allowed ? allowed.includes(to) : false;
}

export const QUOTE_STATUSES: QuoteStatus[] = [
  "draft",
  "sent",
  "viewed",
  "signed",
  "refused",
  "expired",
  "invoiced",
];

export const INVOICE_STATUSES: InvoiceStatus[] = [
  "draft",
  "issued",
  "sent",
  "viewed",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
];
