"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ClientRow } from "@/modules/clients/queries";
import { ClientSheet, type ClientSheetState } from "./client-sheet";
import { ClientsTable } from "./clients-table";
import { ClientsToolbar } from "./clients-toolbar";

export interface ClientsPageClientProps {
  items: ClientRow[];
  page: number;
  pageCount: number;
  query: string;
  includeArchived: boolean;
}

export function ClientsPageClient({
  items,
  page,
  pageCount,
  query,
  includeArchived,
}: ClientsPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sheet, setSheet] = useState<ClientSheetState>({ mode: "closed" });

  function goToPage(pageIndex: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(pageIndex + 1));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <ClientsToolbar
        initialQuery={query}
        initialIncludeArchived={includeArchived}
        onNewClient={() => setSheet({ mode: "create" })}
      />
      <ClientsTable
        items={items}
        pageIndex={page - 1}
        pageCount={pageCount}
        onPageChange={goToPage}
        onEdit={(clientId) => setSheet({ mode: "edit", clientId })}
        hasFilters={Boolean(query) || includeArchived}
      />
      <ClientSheet
        state={sheet}
        onClose={() => setSheet({ mode: "closed" })}
        onSaved={() => {
          setSheet({ mode: "closed" });
          router.refresh();
        }}
      />
    </div>
  );
}
