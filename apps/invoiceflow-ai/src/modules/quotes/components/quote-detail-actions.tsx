"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowRightLeft,
  Copy,
  Download,
  Mail,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
} from "@daromsart/ui";
import { canTransition } from "@daromsart/core";
import {
  convertToInvoiceAction,
  deleteQuoteAction,
  duplicateQuoteAction,
  issueQuoteAction,
  markRefusedAction,
} from "@/modules/quotes/actions";
import { sendQuoteEmailAction } from "@/modules/emails/actions";
import { SendDialog } from "@/modules/documents/components/send-dialog";
import type { QuoteDetail } from "@/modules/quotes/queries";

export interface QuoteDetailActionsProps {
  quote: QuoteDetail;
  publicUrl: string | null;
  defaultRecipient: string | null;
  defaultSubject: string;
  defaultBody: string;
}

export function QuoteDetailActions({
  quote,
  publicUrl,
  defaultRecipient,
  defaultSubject,
  defaultBody,
}: QuoteDetailActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRefuse, setConfirmRefuse] = useState(false);
  const [confirmConvert, setConfirmConvert] = useState(false);

  function handleIssue() {
    startTransition(async () => {
      const result = await issueQuoteAction(quote.id);
      if (!result.ok) {
        toast.error(result.errors._root ?? "Échec de l'émission.");
        return;
      }
      toast.success(`Devis émis (${result.number}).`);
      router.refresh();
    });
  }

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateQuoteAction(quote.id);
      if (!result.ok) {
        toast.error("Échec de la duplication.");
        return;
      }
      toast.success("Devis dupliqué.");
      router.push(`/devis/${result.id}`);
    });
  }

  function handleDelete() {
    setConfirmDelete(false);
    startTransition(async () => {
      const result = await deleteQuoteAction(quote.id);
      if (!result.ok) {
        toast.error("Échec de la suppression.");
        return;
      }
      toast.success("Devis archivé.");
      router.push("/devis");
    });
  }

  function handleRefuse() {
    setConfirmRefuse(false);
    startTransition(async () => {
      const result = await markRefusedAction(quote.id);
      if (!result.ok) {
        toast.error(result.errors._root ?? "Échec de l'opération.");
        return;
      }
      toast.success("Devis marqué refusé.");
      router.refresh();
    });
  }

  async function handleCopyLink() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    toast.success("Lien public copié.");
  }

  function handleConvert(force: boolean) {
    setConfirmConvert(false);
    startTransition(async () => {
      const result = await convertToInvoiceAction(quote.id, { force });
      if (!result.ok) {
        toast.error(result.errors._root ?? "Échec de la conversion.");
        return;
      }
      toast.success("Devis converti en facture.");
      router.push(`/factures/${result.invoiceId}/modifier`);
    });
  }

  const canRefuse = canTransition("quote", quote.status, "refused");
  const isDraft = quote.status === "draft";
  const alreadySent = !isDraft;
  const canConvert =
    !quote.invoiceId &&
    (quote.status === "signed" || quote.status === "sent" || quote.status === "viewed");
  const pdfHref = `/api/documents/devis/${quote.id}/pdf`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isDraft ? (
        <Button asChild size="sm" variant="outline">
          <Link href={`/devis/${quote.id}/modifier`}>
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
        willIssueFirst={!alreadySent}
        attachmentLabel="Le PDF du devis sera joint automatiquement."
        onSend={(input) => sendQuoteEmailAction(quote.id, input)}
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
      ) : canRefuse ? (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => setConfirmRefuse(true)}
        >
          <Archive className="mr-2 h-4 w-4" />
          Archiver
        </Button>
      ) : null}

      {isDraft ? (
        <Button size="sm" variant="ghost" disabled={pending} onClick={handleIssue}>
          <Send className="mr-2 h-4 w-4" />
          Émettre sans envoyer
        </Button>
      ) : null}

      {canConvert ? (
        <Button
          size="sm"
          variant={quote.status === "signed" ? "default" : "outline"}
          disabled={pending}
          onClick={() =>
            quote.status === "signed" ? handleConvert(false) : setConfirmConvert(true)
          }
        >
          <ArrowRightLeft className="mr-2 h-4 w-4" />
          Convertir en facture
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
          {canRefuse && !isDraft ? (
            <DropdownMenuItem onSelect={() => setConfirmRefuse(true)}>
              <XCircle className="mr-2 h-4 w-4" />
              Marquer refusé
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
        title="Archiver ce devis ?"
        description="Ce devis brouillon sera définitivement retiré de la liste."
        confirmLabel="Archiver"
        destructive
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={confirmRefuse}
        onOpenChange={setConfirmRefuse}
        title="Archiver ce devis ?"
        description="Le devis sera marqué comme refusé et ne pourra plus être modifié."
        confirmLabel="Archiver"
        destructive
        onConfirm={handleRefuse}
      />
      <ConfirmDialog
        open={confirmConvert}
        onOpenChange={setConfirmConvert}
        title="Convertir ce devis en facture ?"
        description="Ce devis n'est pas encore signé par le client. Convertir maintenant en facture brouillon quand même ?"
        confirmLabel="Convertir"
        onConfirm={() => handleConvert(true)}
      />
    </div>
  );
}
