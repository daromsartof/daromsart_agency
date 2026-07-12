"use client";

import * as React from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Button } from "./ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

/** Pagination pilotée par l'appelant (ex. `searchParams` côté serveur). */
export interface DataTableManualPagination {
  /** Page courante, 0-indexée. */
  pageIndex: number;
  /** Nombre total de pages. */
  pageCount: number;
  onPageChange: (pageIndex: number) => void;
}

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Rendu affiché quand il n'y a aucune ligne. */
  emptyState?: React.ReactNode;
  pageSize?: number;
  /**
   * Si fourni, la pagination est pilotée par l'appelant (page/count/callback)
   * plutôt que calculée côté client à partir de `data` — utile quand `data`
   * est déjà une page issue d'une requête serveur.
   */
  manualPagination?: DataTableManualPagination;
}

function DataTable<TData, TValue>({
  columns,
  data,
  emptyState,
  pageSize = 10,
  manualPagination,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(manualPagination
      ? {
          manualPagination: true,
          pageCount: manualPagination.pageCount,
          state: {
            sorting,
            pagination: { pageIndex: manualPagination.pageIndex, pageSize },
          },
        }
      : {
          getPaginationRowModel: getPaginationRowModel(),
          state: { sorting },
          initialState: { pagination: { pageSize } },
        }),
    onSortingChange: setSorting,
  });

  const rows = table.getRowModel().rows;

  const canPreviousPage = manualPagination
    ? manualPagination.pageIndex > 0
    : table.getCanPreviousPage();
  const canNextPage = manualPagination
    ? manualPagination.pageIndex < manualPagination.pageCount - 1
    : table.getCanNextPage();
  const pageIndex = manualPagination
    ? manualPagination.pageIndex
    : table.getState().pagination.pageIndex;
  const pageCount = manualPagination ? manualPagination.pageCount : table.getPageCount();

  function goToPreviousPage() {
    if (manualPagination) {
      manualPagination.onPageChange(manualPagination.pageIndex - 1);
    } else {
      table.previousPage();
    }
  }

  function goToNextPage() {
    if (manualPagination) {
      manualPagination.onPageChange(manualPagination.pageIndex + 1);
    } else {
      table.nextPage();
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="h-32 p-0">
                  {emptyState ?? (
                    <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                      Aucun résultat.
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {pageCount > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousPage}
            disabled={!canPreviousPage}
          >
            Précédent
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pageIndex + 1} sur {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextPage}
            disabled={!canNextPage}
          >
            Suivant
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export { DataTable };
