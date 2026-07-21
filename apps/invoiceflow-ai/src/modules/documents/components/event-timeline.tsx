import { Circle } from "lucide-react";
import type { DocumentEventRow } from "../events";

const EVENT_LABELS: Record<string, string> = {
  created: "Créé",
  updated: "Modifié",
  deleted: "Supprimé",
  issued: "Émis",
  sent: "Envoyé par e-mail",
  viewed: "Consulté par le client",
  signed: "Signé",
  refused: "Refusé",
  expired: "Expiré",
  converted: "Converti en facture",
  invoiced: "Facturé (facture émise)",
  unlinked: "Lien de facturation retiré",
  payment_recorded: "Paiement enregistré",
  payment_deleted: "Paiement supprimé",
  reminded: "Relance envoyée",
  cancelled: "Annulé",
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

export interface EventTimelineProps {
  events: DocumentEventRow[];
}

/** Timeline verticale des événements du cycle de vie d'un document (E-12). */
export function EventTimeline({ events }: EventTimelineProps) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun événement pour l'instant.</p>;
  }

  return (
    <ol className="space-y-4">
      {events.map((event) => (
        <li key={event.id} className="flex gap-3">
          <Circle className="mt-0.5 h-3 w-3 shrink-0 fill-primary text-primary" />
          <div>
            <p className="text-sm font-medium">
              {EVENT_LABELS[event.eventType] ?? event.eventType}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(event.createdAt)}
            </p>
            {event.payload && "reason" in event.payload && event.payload.reason ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Motif : {String(event.payload.reason)}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
