"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, MoreHorizontal, User, Users } from "lucide-react";
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  toast,
  type ColumnDef,
} from "@daromsart/ui";
import {
  archiveClientAction,
  unarchiveClientAction,
} from "@/modules/clients/actions";
import type { ClientRow } from "@/modules/clients/queries";

export interface ClientsTableProps {
  items: ClientRow[];
  pageIndex: number;
  pageCount: number;
  onPageChange: (pageIndex: number) => void;
  onEdit: (clientId: string) => void;
  hasFilters: boolean;
}

export function ClientsTable({
  items,
  pageIndex,
  pageCount,
  onPageChange,
  onEdit,
  hasFilters,
}: ClientsTableProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [archiveTarget, setArchiveTarget] = useState<ClientRow | null>(null);

  function handleUnarchive(client: ClientRow) {
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

  function confirmArchive() {
    if (!archiveTarget) return;
    const target = archiveTarget;
    setArchiveTarget(null);
    startTransition(async () => {
      const result = await archiveClientAction(target.id);
      if (!result.ok) {
        toast.error("Échec de l'archivage.");
        return;
      }
      toast.success("Client archivé.");
      router.refresh();
    });
  }

  const columns: ColumnDef<ClientRow>[] = [
    {
      accessorKey: "displayName",
      header: "Nom",
      cell: ({ row }) => (
        <Link
          href={`/clients/${row.original.id}`}
          className="flex items-center gap-2 hover:underline"
        >
          {row.original.type === "company" ? (
            <Building2 className="h-4 w-4 text-muted-foreground" />
          ) : (
            <User className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-medium">{row.original.displayName}</span>
          {row.original.archivedAt ? (
            <Badge variant="outline" className="text-[10px]">
              Archivé
            </Badge>
          ) : null}
        </Link>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => row.original.email ?? "—",
    },
    {
      accessorKey: "addressCity",
      header: "Ville",
      cell: ({ row }) => row.original.addressCity ?? "—",
    },
    {
      id: "revenue",
      header: "CA facturé",
      // Branché en story 12 (stats client).
      cell: () => <span className="text-muted-foreground">—</span>,
    },
    {
      id: "outstanding",
      header: "Encours",
      // Branché en story 12 (stats client).
      cell: () => <span className="text-muted-foreground">—</span>,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onEdit(row.original.id)}>
              Modifier
            </DropdownMenuItem>
            {row.original.archivedAt ? (
              <DropdownMenuItem
                disabled={pending}
                onSelect={() => handleUnarchive(row.original)}
              >
                Désarchiver
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                disabled={pending}
                onSelect={() => setArchiveTarget(row.original)}
              >
                Archiver
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={items}
        manualPagination={{ pageIndex, pageCount, onPageChange }}
        emptyState={
          <EmptyState
            icon={Users}
            title={hasFilters ? "Aucun résultat" : "Aucun client"}
            description={
              hasFilters
                ? "Essayez une autre recherche ou modifiez les filtres."
                : "Créez votre premier client pour commencer."
            }
          />
        }
      />
      <ConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title="Archiver ce client ?"
        description={`« ${archiveTarget?.displayName} » sera masqué des listes actives. Vous pourrez le désarchiver à tout moment.`}
        confirmLabel="Archiver"
        onConfirm={confirmArchive}
      />
    </>
  );
}
