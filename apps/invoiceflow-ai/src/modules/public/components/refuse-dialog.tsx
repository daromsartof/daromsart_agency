"use client";

import { useState, useTransition } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Textarea,
  toast,
} from "@daromsart/ui";
import { refuseQuoteAction } from "@/modules/public/actions";

export interface RefuseDialogProps {
  token: string;
}

export function RefuseDialog({ token }: RefuseDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await refuseQuoteAction(token, reason.trim() || undefined);
      if (!result.ok) {
        setError(result.errors._root ?? "Échec de l'opération.");
        return;
      }
      toast.success("Devis refusé.");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg">
          Refuser
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Refuser ce devis ?</DialogTitle>
          <DialogDescription>Un motif est facultatif mais utile pour l'émetteur.</DialogDescription>
        </DialogHeader>

        <Textarea
          rows={4}
          placeholder="Motif du refus (optionnel)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={pending}>
            {pending ? "Envoi…" : "Confirmer le refus"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
