"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  Copy,
  Download,
  FileMinus,
  Mail,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";
import {
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  formatCentsEUR,
  toast,
} from "@daromsart/ui";
import {
  createCreditNoteAction,
  deleteInvoiceAction,
  duplicateInvoiceAction,
  issueInvoiceAction,
  remindInvoiceAction,
} from "@/modules/invoices/actions";
import { sendInvoiceEmailAction } from "@/modules/emails/actions";
import { SendDialog } from "@/modules/documents/components/send-dialog";
import type { InvoiceDetail } from "@/modules/invoices/queries";

/**
 * Miroir de `quote-detail-actions.tsx` : Modifier / Envoyer / Télécharger / Archiver
 * en actions principales, plus relance / avoir / émettre dans le flux facture.
 */
export interface InvoiceDetailActionsProps {
  invoice: InvoiceDetail;
  publicUrl: string | null;
  defaultRecipient: string | null;
  defaultSubject: string;
  defaultBody: string;
  overdue: boolean;
  daysOverdue: number;
  remainingCents: number;
  defaultReminderSubject: string;
  defaultReminderBody: string;
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function InvoiceDetailActions({
  invoice,
  publicUrl,
  defaultRecipient,
  defaultSubject,
  defaultBody,
  overdue,
  daysOverdue,
  remainingCents,
  defaultReminderSubject,
  defaultReminderBody,
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
      router.push(`/factures/${result.id}`);
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
      toast.success("Facture archivée.");
      router.push("/factures");
    });
  }

  function handleCreateCreditNote() {
    startTransition(async () => {
      const result = await createCreditNoteAction(invoice.id);
      if (!result.ok) {
        toast.error(result.errors._root ?? "Échec de la création de l'avoir.");
        return;
      }
      toast.success("Avoir créé en brouillon.");
      router.push(`/factures/${result.id}/modifier`);
    });
  }

  async function handleCopyLink() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    toast.success("Lien public copié.");
  }

  const isDraft = invoice.status === "draft";
  const alreadySent = invoice.status !== "draft" && invoice.status !== "issued";
  const canCreateCreditNote = invoice.status !== "draft" && invoice.status !== "cancelled";
  const pdfHref = `/api/documents/factures/${invoice.id}/pdf`;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {isDraft ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`/factures/${invoice.id}/modifier`}>
              <Pencil className="mr-2 h-4 w-4" />
              Modifier
            </Link>
          </Button>
        ) : null}

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

        <Button asChild size="sm" variant="outline">
          <a href={pdfHref} download target="_blank" rel="noreferrer">
            <Download className="mr-2 h-4 w-4" />
            Télécharger
          </a>
        </Button>

        {isDraft ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setConfirmDelete(true)}
          >
            <Archive className="mr-2 h-4 w-4" />
            Archiver
          </Button>
        ) : null}

        {overdue ? (
          <SendDialog
            trigger={
              <Button size="sm" variant="outline" disabled={pending}>
                <AlertTriangle className="mr-2 h-4 w-4" />
                Relancer
              </Button>
            }
            defaultTo={defaultRecipient ? [defaultRecipient] : []}
            defaultSubject={defaultReminderSubject}
            defaultBody={defaultReminderBody}
            banner={
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                En retard de {daysOverdue} jour{daysOverdue > 1 ? "s" : ""} — reste dû{" "}
                {formatCentsEUR(remainingCents)}.
              </div>
            }
            attachmentLabel="Le PDF de la facture sera joint automatiquement."
            onSend={(input) => remindInvoiceAction(invoice.id, input)}
            onSuccess={() => router.refresh()}
          />
        ) : null}

        {isDraft ? (
          <Button size="sm" variant="ghost" disabled={pending} onClick={handleIssue}>
            <Send className="mr-2 h-4 w-4" />
            Émettre sans envoyer
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
            {canCreateCreditNote ? (
              <DropdownMenuItem onSelect={handleCreateCreditNote}>
                <FileMinus className="mr-2 h-4 w-4" />
                Créer un avoir
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
      </div>

      {overdue && invoice.lastReminderAt ? (
        <p className="text-xs text-muted-foreground">
          Dernière relance le {formatDateShort(invoice.lastReminderAt)}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Archiver cette facture ?"
        description="Cette facture brouillon sera définitivement retirée de la liste."
        confirmLabel="Archiver"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
