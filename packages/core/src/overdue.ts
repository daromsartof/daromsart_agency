import type { InvoiceStatus } from "./status";

/**
 * `overdue` (H15) : calculé, jamais stocké (comme l'expiration des devis) —
 * échéance dépassée (fin de journée UTC, même simplification que
 * `isQuoteExpired`) ET reste dû strictement positif ET statut pas terminal
 * (`draft`/`paid`/`cancelled` ne sont jamais en retard).
 */
export interface OverdueCheckInput {
  status: InvoiceStatus;
  dueDate: Date | null;
  totalCents: number;
  amountPaidCents: number;
}

const NON_OVERDUE_STATUSES = new Set<InvoiceStatus>(["draft", "paid", "cancelled"]);

export function isOverdue(invoice: OverdueCheckInput, now: Date = new Date()): boolean {
  if (!invoice.dueDate) return false;
  if (NON_OVERDUE_STATUSES.has(invoice.status)) return false;
  if (invoice.totalCents - invoice.amountPaidCents <= 0) return false;

  const endOfDueDay = new Date(
    Date.UTC(
      invoice.dueDate.getUTCFullYear(),
      invoice.dueDate.getUTCMonth(),
      invoice.dueDate.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
  return now.getTime() > endOfDueDay.getTime();
}
