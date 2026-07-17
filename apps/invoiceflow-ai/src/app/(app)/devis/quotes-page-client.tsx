"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Button, Input, Tabs, TabsList, TabsTrigger } from "@daromsart/ui";
import type { QuoteStatus } from "@daromsart/core";
import { QuotesTable } from "@/modules/quotes/components/quotes-table";
import type { QuoteRow } from "@/modules/quotes/queries";

const STATUS_TABS: { value: QuoteStatus | "all"; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "draft", label: "Brouillons" },
  { value: "sent", label: "Envoyés" },
  { value: "viewed", label: "Vus" },
  { value: "signed", label: "Signés" },
  { value: "refused", label: "Refusés" },
  { value: "expired", label: "Expirés" },
  { value: "invoiced", label: "Facturés" },
];

const DEBOUNCE_MS = 300;

export interface QuotesPageClientProps {
  items: QuoteRow[];
  page: number;
  pageCount: number;
  query: string;
  status: QuoteStatus | "all";
  counts: Partial<Record<QuoteStatus | "all", number>>;
}

export function QuotesPageClient({
  items,
  page,
  pageCount,
  query,
  status,
  counts,
}: QuotesPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(query);

  useEffect(() => {
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (search.trim()) {
        params.set("q", search.trim());
      } else {
        params.delete("q");
      }
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne réagit qu'à `search`
  }, [search]);

  function goToTab(tab: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "all") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function goToPage(pageIndex: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(pageIndex + 1));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un devis…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button asChild>
          <Link href="/devis/nouveau">Nouveau devis</Link>
        </Button>
      </div>

      <Tabs value={status} onValueChange={goToTab}>
        <TabsList className="flex-wrap">
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
              {counts[tab.value] ? ` (${counts[tab.value]})` : ""}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <QuotesTable
        items={items}
        pageIndex={page - 1}
        pageCount={pageCount}
        onPageChange={goToPage}
        hasFilters={Boolean(query) || status !== "all"}
      />
    </div>
  );
}
