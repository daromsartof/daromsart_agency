import * as React from "react";

import { Badge } from "./ui/badge";

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

/** Statuts métier des devis et factures (voir @daromsart/core en story 07). */
export type DocumentStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "signed"
  | "refused"
  | "expired"
  | "invoiced"
  | "issued"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled";

const STATUS_MAP: Record<
  DocumentStatus,
  { label: string; variant: BadgeVariant }
> = {
  draft: { label: "Brouillon", variant: "secondary" },
  sent: { label: "Envoyé", variant: "info" },
  viewed: { label: "Vu", variant: "default" },
  signed: { label: "Signé", variant: "success" },
  refused: { label: "Refusé", variant: "destructive" },
  expired: { label: "Expiré", variant: "warning" },
  invoiced: { label: "Facturé", variant: "default" },
  issued: { label: "Émise", variant: "info" },
  partially_paid: { label: "Partiellement payée", variant: "warning" },
  paid: { label: "Payée", variant: "success" },
  overdue: { label: "En retard", variant: "warning" },
  cancelled: { label: "Annulée", variant: "destructive" },
};

export interface StatusBadgeProps {
  status: DocumentStatus;
  className?: string;
}

function StatusBadge({ status, className }: StatusBadgeProps) {
  const entry = STATUS_MAP[status] ?? {
    label: status,
    variant: "outline" as BadgeVariant,
  };
  return (
    <Badge variant={entry.variant} className={className}>
      {entry.label}
    </Badge>
  );
}

export { StatusBadge, STATUS_MAP };
