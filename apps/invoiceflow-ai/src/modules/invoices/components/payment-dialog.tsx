"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Button,
  DatePicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  MoneyInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  formatCentsEUR,
  toast,
} from "@daromsart/ui";
import type { PaymentMethod, RecordPaymentResult } from "@/modules/invoices/payments";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  transfer: "Virement",
  card: "Carte",
  cash: "Espèces",
  check: "Chèque",
  other: "Autre",
};

export interface PaymentDialogProps {
  /** Si omis, le dialog est piloté en externe via `open`/`onOpenChange`
   * (action rapide depuis la liste des factures, story 15). */
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  remainingCents: number;
  onRecord: (input: {
    amountCents: number;
    paidAt: Date;
    method: PaymentMethod;
    reference?: string;
    note?: string;
  }) => Promise<RecordPaymentResult>;
  onSuccess?: () => void;
}

/** Dialog d'enregistrement de paiement (E-17, story 15). */
export function PaymentDialog({
  trigger,
  open: openProp,
  onOpenChange,
  remainingCents,
  onRecord,
  onSuccess,
}: PaymentDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = trigger ? internalOpen : (openProp ?? false);
  const setOpen = trigger ? setInternalOpen : (next: boolean) => onOpenChange?.(next);

  const [amountCents, setAmountCents] = useState<number | null>(remainingCents);
  const [paidAt, setPaidAt] = useState<Date | undefined>(new Date());
  const [method, setMethod] = useState<PaymentMethod>("transfer");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setAmountCents(remainingCents);
      setPaidAt(new Date());
      setMethod("transfer");
      setReference("");
      setNote("");
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne réinitialise qu'à l'ouverture
  }, [open]);

  function handleSubmit() {
    if (amountCents == null || amountCents <= 0) {
      setErrors({ amountCents: "Le montant doit être positif." });
      return;
    }
    // Garde bloquante côté client (en plus de la garde serveur, autoritaire) :
    // ne jamais soumettre un montant supérieur au reste dû.
    if (amountCents > remainingCents) {
      setErrors({ amountCents: "Le montant dépasse le reste dû." });
      return;
    }
    if (!paidAt) {
      setErrors({ paidAt: "La date est requise." });
      return;
    }

    startTransition(async () => {
      const result = await onRecord({
        amountCents,
        paidAt,
        method,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
      });
      if (!result.ok) {
        setErrors(result.errors);
        toast.error(result.errors._root ?? "Échec de l'enregistrement.");
        return;
      }
      toast.success(
        result.status === "paid" ? "Facture soldée." : "Paiement enregistré.",
      );
      setOpen(false);
      onSuccess?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enregistrer un paiement</DialogTitle>
          <DialogDescription>
            Reste dû : {formatCentsEUR(remainingCents)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="payment-amount">Montant</Label>
            <MoneyInput
              id="payment-amount"
              value={amountCents}
              onValueChange={setAmountCents}
            />
            {errors.amountCents ? (
              <p className="text-sm text-destructive">{errors.amountCents}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>Date</Label>
            <DatePicker value={paidAt} onChange={setPaidAt} />
            {errors.paidAt ? <p className="text-sm text-destructive">{errors.paidAt}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label>Moyen de paiement</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(METHOD_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment-reference">Référence (optionnel)</Label>
            <Input
              id="payment-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment-note">Note (optionnel)</Label>
            <Input id="payment-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {errors._root ? <p className="text-sm text-destructive">{errors._root}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
