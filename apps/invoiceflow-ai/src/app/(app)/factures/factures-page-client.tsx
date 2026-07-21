"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CreditCard, Receipt, Search, Wallet } from "lucide-react";
import { Button, Input, StatCard, Tabs, TabsList, TabsTrigger, formatCentsEUR } from "@daromsart/ui";
import type { InvoiceStatus } from "@daromsart/core";
import { InvoicesTable } from "@/modules/invoices/components/invoices-table";
import type { InvoiceDashboardStats, InvoiceRow } from "@/modules/invoices/queries";

type Tab = InvoiceStatus | "all" | "avoirs";

const STATUS_TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "draft", label: "Brouillons" },
  { value: "issued", label: "Émises" },
  { value: "sent", label: "Envoyées" },
  { value: "viewed", label: "Vues" },
  { value: "partially_paid", label: "Partiellement payées" },
  { value: "paid", label: "Payées" },
  { value: "overdue", label: "En retard" },
  { value: "cancelled", label: "Annulées" },
  { value: "avoirs", label: "Avoirs" },
];

const DEBOUNCE_MS = 300;

export interface FacturesPageClientProps {
  items: InvoiceRow[];
  page: number;
  pageCount: number;
  query: string;
  tab: Tab;
  counts: Partial<Record<InvoiceStatus | "all", number>>;
  avoirsTotal: number;
  stats: InvoiceDashboardStats;
}

export function FacturesPageClient({
  items,
  page,
  pageCount,
  query,
  tab,
  counts,
  avoirsTotal,
  stats,
}: FacturesPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(query);
  // Ignore l'exécution de l'effet au montage (ou à un remount) : `search`
  // vaut déjà `query` à ce moment-là, un push serait redondant — et surtout
  // dangereux s'il reste en attente pendant qu'une navigation ailleurs
  // (ex. clic sur une ligne juste après un changement d'onglet) est en
  // cours : le push tardif écraserait l'URL cible avec des params obsolètes
  // capturés par la closure. Ne planifier un push qu'en réaction à une
  // VRAIE saisie utilisateur ultérieure.
  const skipNextPush = useRef(true);

  useEffect(() => {
    if (skipNextPush.current) {
      skipNextPush.current = false;
      return;
    }
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

  function goToTab(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") {
      params.delete("tab");
    } else {
      params.set("tab", next);
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
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Encours" value={formatCentsEUR(stats.encoursCents)} icon={Wallet} />
        <StatCard
          label="En retard"
          value={formatCentsEUR(stats.retardCents)}
          icon={Receipt}
          tone={stats.retardCents > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Encaissé ce mois-ci"
          value={formatCentsEUR(stats.encaisseMoisCents)}
          icon={CreditCard}
          tone="success"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher une facture…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button asChild>
          <Link href="/factures/nouvelle">Nouvelle facture</Link>
        </Button>
      </div>

      <Tabs value={tab} onValueChange={goToTab}>
        <TabsList className="flex-wrap">
          {STATUS_TABS.map((t) => {
            const count = t.value === "avoirs" ? avoirsTotal : counts[t.value];
            return (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
                {count ? ` (${count})` : ""}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <InvoicesTable
        items={items}
        pageIndex={page - 1}
        pageCount={pageCount}
        onPageChange={goToPage}
        hasFilters={Boolean(query) || tab !== "all"}
      />
    </div>
  );
}
