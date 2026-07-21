import { redirect } from "next/navigation";
import { PageHeader } from "@daromsart/ui";
import type { InvoiceStatus } from "@daromsart/core";
import { db } from "@/db";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import {
  getInvoiceDashboardStats,
  getInvoiceStatusCounts,
  listInvoices,
} from "@/modules/invoices/queries";
import { FacturesPageClient } from "./factures-page-client";

export const metadata = { title: "Factures" };

const PAGE_SIZE = 10;
const VALID_STATUSES: InvoiceStatus[] = [
  "draft",
  "issued",
  "sent",
  "viewed",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
];

export default async function FacturesPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string; tab?: string };
}) {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    redirect("/");
  }

  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1);
  const q = searchParams.q ?? "";
  const isAvoirsTab = searchParams.tab === "avoirs";
  const status: InvoiceStatus | "all" =
    !isAvoirsTab && VALID_STATUSES.includes(searchParams.tab as InvoiceStatus)
      ? (searchParams.tab as InvoiceStatus)
      : "all";
  const kind = isAvoirsTab ? "credit_note" : "invoice";

  const [result, counts, avoirsCounts, stats] = await Promise.all([
    listInvoices(db, { organizationId, status, kind, q, page, pageSize: PAGE_SIZE }),
    getInvoiceStatusCounts(db, organizationId, "invoice"),
    getInvoiceStatusCounts(db, organizationId, "credit_note"),
    getInvoiceDashboardStats(db, organizationId),
  ]);

  const totalCount = Object.entries(counts)
    .filter(([key]) => key !== "overdue")
    .reduce((sum, [, value]) => sum + (value ?? 0), 0);
  const avoirsTotal = Object.entries(avoirsCounts)
    .filter(([key]) => key !== "overdue")
    .reduce((sum, [, value]) => sum + (value ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Factures"
        description="Émettez vos factures et suivez les paiements."
      />
      <FacturesPageClient
        items={result.items}
        page={result.page}
        pageCount={result.pageCount}
        query={q}
        tab={isAvoirsTab ? "avoirs" : status}
        counts={{ ...counts, all: totalCount }}
        avoirsTotal={avoirsTotal}
        stats={stats}
      />
    </>
  );
}
