"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Download, Mail, MoreHorizontal, Send, Trash2 } from "lucide-react";
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
import { sendInvoiceEmailAction } from "@/modules/emails/actions";
import { SendDialog } from "@/modules/documents/components/send-dialog";
import type { InvoiceDetail } from "@/modules/invoices/queries";

/**
 * Miroir de `quote-detail-actions.tsx` (story 07/08/10/11), simplifié : pas
 * de signature ni de refus côté facture (H15). Story 14 : ajoute l'envoi par
 * email (même `SendDialog` générique que les devis).
 */
export interface InvoiceDetailActionsProps {
  invoice: InvoiceDetail;
  publicUrl: string | null;
  defaultRecipient: string | null;
  defaultSubject: string;
  defaultBody: string;
}

export function InvoiceDetailActions({
  invoice,
  publicUrl,
  defaultRecipient,
  defaultSubject,
  defaultBody,
}: InvoiceDetailActionsProps) {
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

  async function handleCopyLink() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    toast.success("Lien public copié.");
  }

  const isDraft = invoice.status === "draft";
  const alreadySent = invoice.status !== "draft" && invoice.status !== "issued";

  return (
    <div className="flex items-center gap-2">
      <SendDialog
        trigger={
          <Button size="sm" disabled={pending}>
            <Mail className="mr-2 h-4 w-4" />
            {alreadySent ? "Renvoyer" : "Envoyer"}
          </Button>
        }
        defaultTo={defaultRecipient ? [defaultRecipient] : []}
        defaultSubject={defaultSubject}
        defaultBody={defaultBody}
        willIssueFirst={isDraft}
        attachmentLabel="Le PDF de la facture sera joint automatiquement."
        onSend={(input) => sendInvoiceEmailAction(invoice.id, input)}
        onSuccess={() => router.refresh()}
      />

      {!isDraft ? (
        <Button asChild size="sm" variant="outline">
          <a href={`/api/documents/factures/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
            <Download className="mr-2 h-4 w-4" />
            Télécharger le PDF
          </a>
        </Button>
      ) : (
        <Button size="sm" variant="outline" disabled={pending} onClick={handleIssue}>
          <Send className="mr-2 h-4 w-4" />
          Émettre sans envoyer
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
          {publicUrl ? (
            <DropdownMenuItem onSelect={handleCopyLink}>
              <Copy className="mr-2 h-4 w-4" />
              Copier le lien public
            </DropdownMenuItem>
          ) : null}
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
