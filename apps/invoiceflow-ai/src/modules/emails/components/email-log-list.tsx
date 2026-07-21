import { Badge, EmptyState } from "@daromsart/ui";
import { Mail } from "lucide-react";
import type { EmailLogRow } from "../queries";
import type { EmailLogStatus } from "../../../db/schema";

const STATUS_LABEL: Record<EmailLogStatus, string> = {
  queued: "En file",
  sent: "Envoyé",
  delivered: "Délivré",
  opened: "Ouvert",
  bounced: "Échec (bounce)",
  complained: "Signalé spam",
  failed: "Échec d'envoi",
};

const STATUS_VARIANT: Record<
  EmailLogStatus,
  "info" | "success" | "default" | "destructive"
> = {
  queued: "info",
  sent: "info",
  delivered: "success",
  opened: "default",
  bounced: "destructive",
  complained: "destructive",
  failed: "destructive",
};

function formatDateTime(date: Date): string {
  return date.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface EmailLogListProps {
  logs: EmailLogRow[];
}

/** Historique des emails d'un document (onglet "Emails", story 20). */
export function EmailLogList({ logs }: EmailLogListProps) {
  if (logs.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="Aucun email envoyé"
        description="L'historique des envois (statut de délivrabilité inclus) apparaîtra ici."
      />
    );
  }

  return (
    <ul className="space-y-4">
      {logs.map((log) => (
        <li key={log.id} className="rounded-md border p-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium">{log.subject}</p>
              <p className="text-xs text-muted-foreground">
                À {log.to.join(", ")}
                {log.cc?.length ? ` — Cc ${log.cc.join(", ")}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {log.kind === "reminder" ? <Badge variant="outline">Relance</Badge> : null}
              <Badge variant={STATUS_VARIANT[log.status]}>{STATUS_LABEL[log.status]}</Badge>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {log.sentAt ? <span>Envoyé le {formatDateTime(log.sentAt)}</span> : null}
            {log.deliveredAt ? <span>Délivré le {formatDateTime(log.deliveredAt)}</span> : null}
            {log.openedAt ? <span>Ouvert le {formatDateTime(log.openedAt)}</span> : null}
            {log.bouncedAt ? <span>Échec le {formatDateTime(log.bouncedAt)}</span> : null}
          </div>
          {log.errorMessage ? (
            <p className="mt-1 text-xs text-destructive">{log.errorMessage}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
