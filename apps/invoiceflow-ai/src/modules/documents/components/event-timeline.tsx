import Link from "next/link";
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
  email_delivered: "Email délivré",
  email_opened: "Email ouvert",
  email_bounced: "Email non délivré (bounce)",
  email_complained: "Email signalé comme spam",
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

/** Une ligne peut porter un libellé/lien de document (activité du dashboard,
 * story 19 — plusieurs documents mêlés) ; sans ces champs, comportement
 * inchangé (détail d'un document unique, sa propre timeline). */
export interface EventTimelineRow extends DocumentEventRow {
  label?: string;
  href?: string | null;
}

export interface EventTimelineProps {
  events: EventTimelineRow[];
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
            {event.label ? (
              <p className="text-sm font-medium">
                {event.href ? (
                  <Link href={event.href} className="hover:underline">
                    {event.label}
                  </Link>
                ) : (
                  event.label
                )}{" "}
                <span className="font-normal text-muted-foreground">
                  — {EVENT_LABELS[event.eventType] ?? event.eventType}
                </span>
              </p>
            ) : (
              <p className="text-sm font-medium">
                {EVENT_LABELS[event.eventType] ?? event.eventType}
              </p>
            )}
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
