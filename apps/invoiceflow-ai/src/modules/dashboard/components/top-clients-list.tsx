import Link from "next/link";
import { formatCentsEUR, Progress } from "@daromsart/ui";
import type { TopClientRow } from "../queries";

export interface TopClientsListProps {
  clients: TopClientRow[];
}

/** Liste top clients par CA facturé, barre relative au 1er. */
export function TopClientsList({ clients }: TopClientsListProps) {
  if (clients.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun client facturé pour l&apos;instant.</p>;
  }

  const maxCa = clients[0]?.caCents || 1;

  return (
    <ul className="space-y-4">
      {clients.map((client) => {
        const pct = Math.round((client.caCents / maxCa) * 100);
        return (
          <li key={client.clientId} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <Link
                href={`/clients/${client.clientId}`}
                className="min-w-0 truncate font-medium hover:underline"
              >
                {client.clientName}
              </Link>
              <span className="shrink-0 tabular-nums font-medium">
                {formatCentsEUR(client.caCents)}
              </span>
            </div>
            <Progress value={pct} className="h-1.5" />
            {client.resteDuCents > 0 ? (
              <p className="text-xs text-muted-foreground">
                Reste dû {formatCentsEUR(client.resteDuCents)}
              </p>
            ) : (
              <p className="text-xs text-success">Soldé</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
