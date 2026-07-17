"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, FileText, Receipt, User } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  ConfirmDialog,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  initials,
  toast,
} from "@daromsart/ui";
import {
  archiveClientAction,
  unarchiveClientAction,
} from "@/modules/clients/actions";
import type { ClientWithContacts } from "@/modules/clients/queries";

export interface ClientHeaderProps {
  client: ClientWithContacts;
  onEdit: () => void;
}

export function ClientHeader({ client, onEdit }: ClientHeaderProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const archived = Boolean(client.archivedAt);

  function handleUnarchive() {
    startTransition(async () => {
      const result = await unarchiveClientAction(client.id);
      if (!result.ok) {
        toast.error("Échec du désarchivage.");
        return;
      }
      toast.success("Client désarchivé.");
      router.refresh();
    });
  }

  function handleArchive() {
    setConfirmArchive(false);
    startTransition(async () => {
      const result = await archiveClientAction(client.id);
      if (!result.ok) {
        toast.error("Échec de l'archivage.");
        return;
      }
      toast.success("Client archivé.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <Avatar className="h-14 w-14">
          <AvatarFallback className="text-lg">
            {initials(client.displayName)}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{client.displayName}</h1>
            <Badge variant="outline" className="gap-1">
              {client.type === "company" ? (
                <Building2 className="h-3 w-3" />
              ) : (
                <User className="h-3 w-3" />
              )}
              {client.type === "company" ? "Société" : "Particulier"}
            </Badge>
            {archived ? <Badge variant="outline">Archivé</Badge> : null}
          </div>
          {client.email ? (
            <p className="text-sm text-muted-foreground">{client.email}</p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button variant="outline" size="sm" disabled>
                <FileText className="mr-2 h-4 w-4" />
                Nouveau devis
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Bientôt disponible</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button variant="outline" size="sm" disabled>
                <Receipt className="mr-2 h-4 w-4" />
                Nouvelle facture
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Bientôt disponible</TooltipContent>
        </Tooltip>
        <Button variant="outline" size="sm" onClick={onEdit}>
          Modifier
        </Button>
        {archived ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={handleUnarchive}
          >
            Désarchiver
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => setConfirmArchive(true)}
          >
            Archiver
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="Archiver ce client ?"
        description={`« ${client.displayName} » sera masqué des listes actives. Vous pourrez le désarchiver à tout moment.`}
        confirmLabel="Archiver"
        onConfirm={handleArchive}
      />
    </div>
  );
}
