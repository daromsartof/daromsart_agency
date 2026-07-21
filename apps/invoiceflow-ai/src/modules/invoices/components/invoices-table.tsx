"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, CreditCard, MoreHorizontal, Receipt, Trash2 } from "lucide-react";
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
  deleteInvoiceAction,
  duplicateInvoiceAction,
  recordPaymentAction,
} from "@/modules/invoices/actions";
import { PaymentDialog } from "@/modules/invoices/components/payment-dialog";
import type { InvoiceRow } from "@/modules/invoices/queries";

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export interface InvoicesTableProps {
  items: InvoiceRow[];
  pageIndex: number;
  pageCount: number;
  onPageChange: (pageIndex: number) => void;
  hasFilters: boolean;
}

export function InvoicesTable({
  items,
  pageIndex,
  pageCount,
  onPageChange,
  hasFilters,
}: InvoicesTableProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<InvoiceRow | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<InvoiceRow | null>(null);

  function handleDuplicate(invoice: InvoiceRow) {
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

  function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await deleteInvoiceAction(target.id);
      if (!result.ok) {
        toast.error("Échec de la suppression.");
        return;
      }
      toast.success("Facture supprimée.");
      router.refresh();
    });
  }

  const columns: ColumnDef<InvoiceRow>[] = [
    {
      accessorKey: "clientName",
      header: "Client",
      cell: ({ row }) => (
        <Link
          href={
            row.original.status === "draft"
              ? `/factures/${row.original.id}/modifier`
              : `/factures/${row.original.id}`
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
      id: "dueDate",
      header: "Échéance",
      cell: ({ row }) =>
        row.original.dueDate ? formatDateShort(row.original.dueDate) : "—",
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
      id: "remainingCents",
      header: "Reste dû",
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatCentsEUR(row.original.totalCents - row.original.amountPaidCents)}
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
                <Link href={`/factures/${row.original.id}/modifier`}>
                  Modifier
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem asChild>
                <Link href={`/factures/${row.original.id}`}>Consulter</Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              disabled={pending}
              onSelect={() => handleDuplicate(row.original)}
            >
              <Copy className="mr-2 h-4 w-4" />
              Dupliquer
            </DropdownMenuItem>
            {row.original.status !== "draft" &&
            row.original.status !== "cancelled" &&
            row.original.totalCents - row.original.amountPaidCents > 0 ? (
              <DropdownMenuItem onSelect={() => setPaymentTarget(row.original)}>
                <CreditCard className="mr-2 h-4 w-4" />
                Enregistrer un paiement
              </DropdownMenuItem>
            ) : null}
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
            icon={Receipt}
            title={hasFilters ? "Aucun résultat" : "Aucune facture"}
            description={
              hasFilters
                ? "Essayez une autre recherche ou un autre filtre."
                : "Créez votre première facture pour commencer."
            }
          />
        }
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Supprimer cette facture ?"
        description={`La facture brouillon de « ${deleteTarget?.clientName} » sera définitivement supprimée.`}
        confirmLabel="Supprimer"
        onConfirm={confirmDelete}
      />
      {paymentTarget ? (
        <PaymentDialog
          open={paymentTarget !== null}
          onOpenChange={(open) => !open && setPaymentTarget(null)}
          remainingCents={paymentTarget.totalCents - paymentTarget.amountPaidCents}
          onRecord={(input) => recordPaymentAction(paymentTarget.id, input)}
          onSuccess={() => {
            setPaymentTarget(null);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
