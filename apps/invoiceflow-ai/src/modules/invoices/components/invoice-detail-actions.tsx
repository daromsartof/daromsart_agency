"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Download, MoreHorizontal, Send, Trash2 } from "lucide-react";
import {
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
} from "@daromsart/ui";
import {
  deleteInvoiceAction,
  duplicateInvoiceAction,
  issueInvoiceAction,
} from "@/modules/invoices/actions";
import type { InvoiceDetail } from "@/modules/invoices/queries";

/**
 * Miroir de `quote-detail-actions.tsx` (story 07/08/11), simplifié : pas de
 * signature ni de refus côté facture (H15). L'envoi par email arrivera en
 * story 14 (page publique facture).
 */
export interface InvoiceDetailActionsProps {
  invoice: InvoiceDetail;
}

export function InvoiceDetailActions({ invoice }: InvoiceDetailActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleIssue() {
    startTransition(async () => {
      const result = await issueInvoiceAction(invoice.id);
      if (!result.ok) {
        toast.error(result.errors._root ?? "Échec de l'émission.");
        return;
      }
      toast.success(`Facture émise (${result.number}).`);
      router.refresh();
    });
  }

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateInvoiceAction(invoice.id);
      if (!result.ok) {
        toast.error("Échec de la duplication.");
        return;
      }
      toast.success("Facture dupliquée.");
      router.push(`/factures/${result.id}/modifier`);
    });
  }

  function handleDelete() {
    setConfirmDelete(false);
    startTransition(async () => {
      const result = await deleteInvoiceAction(invoice.id);
      if (!result.ok) {
        toast.error("Échec de la suppression.");
        return;
      }
      toast.success("Facture supprimée.");
      router.push("/factures");
    });
  }

  const isDraft = invoice.status === "draft";

  return (
    <div className="flex items-center gap-2">
      {isDraft ? (
        <Button size="sm" disabled={pending} onClick={handleIssue}>
          <Send className="mr-2 h-4 w-4" />
          Émettre
        </Button>
      ) : (
        <Button asChild size="sm" variant="outline">
          <a href={`/api/documents/factures/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
            <Download className="mr-2 h-4 w-4" />
            Télécharger le PDF
          </a>
        </Button>
      )}

      {isDraft ? (
        <Button asChild size="sm" variant="outline">
          <Link href={`/factures/${invoice.id}/modifier`}>Modifier</Link>
        </Button>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Autres actions" disabled={pending}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={handleDuplicate}>
            <Copy className="mr-2 h-4 w-4" />
            Dupliquer
          </DropdownMenuItem>
          {isDraft ? (
            <DropdownMenuItem onSelect={() => setConfirmDelete(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Supprimer cette facture ?"
        description="Cette facture brouillon sera définitivement supprimée."
        confirmLabel="Supprimer"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
