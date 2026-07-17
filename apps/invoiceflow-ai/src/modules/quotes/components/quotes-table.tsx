"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, FileText, MoreHorizontal, Trash2 } from "lucide-react";
import {
  Button,
  ConfirmDialog,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  StatusBadge,
  formatCentsEUR,
  toast,
  type ColumnDef,
} from "@daromsart/ui";
import {
  deleteQuoteAction,
  duplicateQuoteAction,
} from "@/modules/quotes/actions";
import type { QuoteRow } from "@/modules/quotes/queries";

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export interface QuotesTableProps {
  items: QuoteRow[];
  pageIndex: number;
  pageCount: number;
  onPageChange: (pageIndex: number) => void;
  hasFilters: boolean;
}

export function QuotesTable({
  items,
  pageIndex,
  pageCount,
  onPageChange,
  hasFilters,
}: QuotesTableProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<QuoteRow | null>(null);

  function handleDuplicate(quote: QuoteRow) {
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

  function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await deleteQuoteAction(target.id);
      if (!result.ok) {
        toast.error("Échec de la suppression.");
        return;
      }
      toast.success("Devis supprimé.");
      router.refresh();
    });
  }

  const columns: ColumnDef<QuoteRow>[] = [
    {
      accessorKey: "clientName",
      header: "Client",
      cell: ({ row }) => (
        <Link
          href={
            row.original.status === "draft"
              ? `/devis/${row.original.id}/modifier`
              : `/devis/${row.original.id}`
          }
          className="font-medium hover:underline"
        >
          {row.original.clientName}
        </Link>
      ),
    },
    {
      accessorKey: "number",
      header: "Numéro",
      cell: ({ row }) => row.original.number ?? "—",
    },
    {
      id: "issueDate",
      header: "Émission",
      cell: ({ row }) =>
        row.original.issueDate ? formatDateShort(row.original.issueDate) : "—",
    },
    {
      id: "totalCents",
      header: "Total TTC",
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatCentsEUR(row.original.totalCents)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Statut",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
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
            {row.original.status === "draft" ? (
              <DropdownMenuItem asChild>
                <Link href={`/devis/${row.original.id}/modifier`}>
                  Modifier
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem asChild>
                <Link href={`/devis/${row.original.id}`}>Consulter</Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              disabled={pending}
              onSelect={() => handleDuplicate(row.original)}
            >
              <Copy className="mr-2 h-4 w-4" />
              Dupliquer
            </DropdownMenuItem>
            {row.original.status === "draft" ? (
              <DropdownMenuItem
                disabled={pending}
                onSelect={() => setDeleteTarget(row.original)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </DropdownMenuItem>
            ) : null}
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
            icon={FileText}
            title={hasFilters ? "Aucun résultat" : "Aucun devis"}
            description={
              hasFilters
                ? "Essayez une autre recherche ou un autre filtre."
                : "Créez votre premier devis pour commencer."
            }
          />
        }
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Supprimer ce devis ?"
        description={`Le devis brouillon de « ${deleteTarget?.clientName} » sera définitivement supprimé.`}
        confirmLabel="Supprimer"
        onConfirm={confirmDelete}
      />
    </>
  );
}
