"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Download, Mail, MoreHorizontal, Send, Trash2, XCircle } from "lucide-react";
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
      router.push(`/devis/${result.id}/modifier`);
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
      toast.success("Devis supprimé.");
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

  const canRefuse = canTransition("quote", quote.status, "refused");
  const alreadySent = quote.status !== "draft";

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
        willIssueFirst={!alreadySent}
        attachmentLabel="Le PDF du devis sera joint automatiquement."
        onSend={(input) => sendQuoteEmailAction(quote.id, input)}
        onSuccess={() => router.refresh()}
      />

      {alreadySent ? (
        <Button asChild size="sm" variant="outline">
          <a href={`/api/documents/devis/${quote.id}/pdf`} target="_blank" rel="noreferrer">
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

      {!alreadySent ? (
        <Button asChild size="sm" variant="outline">
          <Link href={`/devis/${quote.id}/modifier`}>Modifier</Link>
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
          {canRefuse ? (
            <DropdownMenuItem onSelect={() => setConfirmRefuse(true)}>
              <XCircle className="mr-2 h-4 w-4" />
              Marquer refusé
            </DropdownMenuItem>
          ) : null}
          {!alreadySent ? (
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
        title="Supprimer ce devis ?"
        description="Ce devis brouillon sera définitivement supprimé."
        confirmLabel="Supprimer"
        destructive
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={confirmRefuse}
        onOpenChange={setConfirmRefuse}
        title="Marquer ce devis comme refusé ?"
        description="À utiliser si le client a refusé par un autre canal (téléphone, email)."
        confirmLabel="Marquer refusé"
        destructive
        onConfirm={handleRefuse}
      />
    </div>
  );
}
