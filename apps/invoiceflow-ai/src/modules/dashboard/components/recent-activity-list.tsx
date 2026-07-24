import Link from "next/link";
import {
  Ban,
  CheckCircle2,
  CircleDollarSign,
  Eye,
  FilePlus2,
  Mail,
  Pencil,
  Send,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@daromsart/ui";
import type { EventTimelineRow } from "@/modules/documents/components/event-timeline";

const EVENT_LABELS: Record<string, string> = {
  created: "Créé",
  updated: "Modifié",
  deleted: "Supprimé",
  issued: "Émis",
  sent: "Envoyé",
  viewed: "Consulté",
  signed: "Signé",
  refused: "Refusé",
  expired: "Expiré",
  converted: "Converti",
  invoiced: "Facturé",
  unlinked: "Délié",
  payment_recorded: "Paiement",
  payment_deleted: "Paiement annulé",
  reminded: "Relancé",
  cancelled: "Annulé",
  email_delivered: "Délivré",
  email_opened: "Ouvert",
  email_bounced: "Bounce",
  email_complained: "Spam",
};

const EVENT_META: Record<string, { icon: LucideIcon; tone: string }> = {
  created: { icon: FilePlus2, tone: "bg-muted text-muted-foreground" },
  updated: { icon: Pencil, tone: "bg-muted text-muted-foreground" },
  issued: { icon: Send, tone: "bg-info/15 text-info" },
  sent: { icon: Mail, tone: "bg-info/15 text-info" },
  viewed: { icon: Eye, tone: "bg-primary/15 text-primary" },
  signed: { icon: CheckCircle2, tone: "bg-success/15 text-success" },
  refused: { icon: Ban, tone: "bg-destructive/15 text-destructive" },
  payment_recorded: { icon: CircleDollarSign, tone: "bg-success/15 text-success" },
  reminded: { icon: Mail, tone: "bg-warning/15 text-warning" },
  cancelled: { icon: Ban, tone: "bg-destructive/15 text-destructive" },
};

function formatRelative(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Il y a ${days} j`;
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface RecentActivityListProps {
  events: EventTimelineRow[];
}

/** Activité récente compacte pour le dashboard (icônes + temps relatif). */
export function RecentActivityList({ events }: RecentActivityListProps) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun événement pour l&apos;instant.</p>;
  }

  return (
    <ul className="-mx-2 space-y-0.5">
      {events.map((event) => {
        const meta = EVENT_META[event.eventType] ?? {
          icon: FilePlus2,
          tone: "bg-muted text-muted-foreground",
        };
        const Icon = meta.icon;
        const action = EVENT_LABELS[event.eventType] ?? event.eventType;
        const content = (
          <>
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                meta.tone,
              )}
              aria-hidden
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {event.label ?? action}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {action} · {formatRelative(event.createdAt)}
              </p>
            </div>
          </>
        );

        return (
          <li key={event.id}>
            {event.href ? (
              <Link
                href={event.href}
                className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
              >
                {content}
              </Link>
            ) : (
              <div className="flex items-center gap-3 rounded-lg px-2 py-2.5">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
