"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Progress,
  formatCentsEUR,
  toast,
} from "@daromsart/ui";
import { deletePaymentAction, recordPaymentAction } from "@/modules/invoices/actions";
import { PaymentDialog } from "./payment-dialog";
import type { PaymentMethod, PaymentRow } from "@/modules/invoices/payments";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  transfer: "Virement",
  card: "Carte",
  cash: "Espèces",
  check: "Chèque",
  other: "Autre",
};

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export interface PaymentCardProps {
  invoiceId: string;
  totalCents: number;
  amountPaidCents: number;
  payments: PaymentRow[];
  isAdmin: boolean;
  /** Une facture brouillon ou annulée ne peut jamais recevoir de paiement (H15). */
  canRecord: boolean;
}

/** Encart Paiement (E-16, story 15) : reste dû, Progress, historique, suppression admin. */
export function PaymentCard({
  invoiceId,
  totalCents,
  amountPaidCents,
  payments,
  isAdmin,
  canRecord,
}: PaymentCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<PaymentRow | null>(null);

  const remainingCents = totalCents - amountPaidCents;
  const percent =
    totalCents > 0 ? Math.min(100, Math.round((amountPaidCents / totalCents) * 100)) : 0;

  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await deletePaymentAction(invoiceId, target.id);
      if (!result.ok) {
        toast.error(result.errors._root ?? "Échec de la suppression.");
        return;
      }
      toast.success("Paiement supprimé.");
      router.refresh();
    });
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Paiement</CardTitle>
          {canRecord && remainingCents > 0 ? (
            <PaymentDialog
              trigger={<Button size="sm">Enregistrer un paiement</Button>}
              remainingCents={remainingCents}
              onRecord={(input) => recordPaymentAction(invoiceId, input)}
              onSuccess={() => router.refresh()}
            />
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-2xl font-semibold tabular-nums">
                {formatCentsEUR(remainingCents)}
              </span>
              <span className="text-sm text-muted-foreground">
                reste dû sur {formatCentsEUR(totalCents)}
              </span>
            </div>
            <Progress value={percent} />
          </div>

          {payments.length ? (
            <ul className="divide-y">
              {payments.map((payment) => (
                <li key={payment.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{METHOD_LABELS[payment.method]}</Badge>
                    <span className="font-medium tabular-nums">
                      {formatCentsEUR(payment.amountCents)}
                    </span>
                    <span className="text-muted-foreground">
                      {formatDateShort(payment.paidAt)}
                    </span>
                    {payment.reference ? (
                      <span className="text-muted-foreground">· {payment.reference}</span>
                    ) : null}
                  </div>
                  {isAdmin ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Supprimer le paiement"
                      disabled={pending}
                      onClick={() => setDeleteTarget(payment)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun paiement enregistré.</p>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Supprimer ce paiement ?"
        description="Le montant sera retiré du reste dû et le statut de la facture recalculé."
        confirmLabel="Supprimer"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
