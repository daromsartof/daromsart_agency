import Link from "next/link";
import { FileText } from "lucide-react";
import type { QuoteStatus } from "@daromsart/core";
import { formatCentsEUR, StatusBadge } from "@daromsart/ui";
import type { RecentQuoteRow } from "../queries";

export interface RecentQuotesListProps {
  quotes: RecentQuoteRow[];
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Liste derniers devis — montant + badge statut, hover de ligne. */
export function RecentQuotesList({ quotes }: RecentQuotesListProps) {
  if (quotes.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun devis pour l&apos;instant.</p>;
  }

  return (
    <ul className="-mx-2 space-y-0.5">
      {quotes.map((quote) => {
        const href =
          quote.status === "draft" ? `/devis/${quote.id}/modifier` : `/devis/${quote.id}`;
        return (
          <li key={quote.id}>
            <Link
              href={href}
              className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
                aria-hidden
              >
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {quote.number ?? "Brouillon"}
                  </span>
                  <StatusBadge status={quote.status as QuoteStatus} />
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {quote.clientName} · {formatDateShort(quote.createdAt)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {formatCentsEUR(quote.totalCents)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
