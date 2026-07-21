"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, MoreHorizontal, Send, Trash2 } from "lucide-react";
import {
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
} from "@daromsart/ui";
import { deleteInvoiceAction, issueCreditNoteAction } from "@/modules/invoices/actions";
import type { InvoiceDetail } from "@/modules/invoices/queries";

/**
 * Actions du détail d'un avoir (story 18) — miroir très simplifié
 * d'`InvoiceDetailActions` : pas d'envoi par email, pas de relance, pas de
 * paiement (interdit sur un avoir, H15/story-18), pas de duplication
 * (`plans/story-18.md`, « quand s'arrêter »).
 */
export interface CreditNoteDetailActionsProps {
  creditNote: InvoiceDetail;
}

export function CreditNoteDetailActions({ creditNote }: CreditNoteDetailActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isDraft = creditNote.status === "draft";

  function handleIssue() {
    startTransition(async () => {
      const result = await issueCreditNoteAction(creditNote.id);
      if (!result.ok) {
        toast.error(result.errors._root ?? "Échec de l'émission.");
        return;
      }
      toast.success(
        result.parentCancelled
          ? `Avoir émis (${result.number}) — facture d'origine annulée.`
          : `Avoir émis (${result.number}).`,
      );
      router.refresh();
    });
  }

  function handleDelete() {
    setConfirmDelete(false);
    startTransition(async () => {
      const result = await deleteInvoiceAction(creditNote.id);
      if (!result.ok) {
        toast.error("Échec de la suppression.");
        return;
      }
      toast.success("Avoir supprimé.");
      router.push(`/factures/${creditNote.parentInvoiceId ?? ""}`);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {isDraft ? (
          <>
            <Button asChild size="sm" variant="outline">
              <Link href={`/factures/${creditNote.id}/modifier`}>Modifier</Link>
            </Button>
            <Button size="sm" disabled={pending} onClick={handleIssue}>
              <Send className="mr-2 h-4 w-4" />
              Émettre
            </Button>
          </>
        ) : (
          <Button asChild size="sm" variant="outline">
            <a href={`/api/documents/factures/${creditNote.id}/pdf`} target="_blank" rel="noreferrer">
              <Download className="mr-2 h-4 w-4" />
              Télécharger le PDF
            </a>
          </Button>
        )}

        {isDraft ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Autres actions" disabled={pending}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setConfirmDelete(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Supprimer cet avoir ?"
        description="Cet avoir brouillon sera définitivement supprimé."
        confirmLabel="Supprimer"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
