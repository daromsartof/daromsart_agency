import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { cn, formatCentsEUR } from "@daromsart/ui";
import type { OverdueInvoiceRow } from "../queries";

export interface OverdueInvoicesListProps {
  invoices: OverdueInvoiceRow[];
}

function overdueTone(days: number): string {
  if (days >= 90) return "bg-destructive/15 text-destructive";
  if (days >= 60) return "bg-warning/15 text-warning";
  return "bg-info/15 text-info";
}

/** Liste factures en retard — lignes densifiées avec pastille d'ancienneté. */
export function OverdueInvoicesList({ invoices }: OverdueInvoicesListProps) {
  if (invoices.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune facture en retard.</p>;
  }

  return (
    <ul className="-mx-2 space-y-0.5">
      {invoices.map((invoice) => (
        <li key={invoice.id}>
          <Link
            href={`/factures/${invoice.id}`}
            className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                overdueTone(invoice.daysOverdue),
              )}
              aria-hidden
            >
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">
                  {invoice.number ?? "Brouillon"}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                    overdueTone(invoice.daysOverdue),
                  )}
                >
                  {invoice.daysOverdue} j
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">{invoice.clientName}</p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {formatCentsEUR(invoice.remainingCents)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
