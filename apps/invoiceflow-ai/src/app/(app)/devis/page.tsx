import { redirect } from "next/navigation";
import { PageHeader } from "@daromsart/ui";
import type { QuoteStatus } from "@daromsart/core";
import { db } from "@/db";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import { getQuoteStatusCounts, listQuotes } from "@/modules/quotes/queries";
import { QuotesPageClient } from "./quotes-page-client";

export const metadata = { title: "Devis" };

const PAGE_SIZE = 10;
const VALID_STATUSES: (QuoteStatus | "all")[] = [
  "all",
  "draft",
  "sent",
  "viewed",
  "signed",
  "refused",
  "expired",
  "invoiced",
];

export default async function DevisPage({
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
  const status = VALID_STATUSES.includes(searchParams.tab as QuoteStatus)
    ? (searchParams.tab as QuoteStatus)
    : "all";

  const [result, counts] = await Promise.all([
    listQuotes(db, { organizationId, status, q, page, pageSize: PAGE_SIZE }),
    getQuoteStatusCounts(db, organizationId),
  ]);

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        title="Devis"
        description="Créez, envoyez et faites signer vos devis."
      />
      <QuotesPageClient
        items={result.items}
        page={result.page}
        pageCount={result.pageCount}
        query={q}
        status={status}
        counts={{ ...counts, all: totalCount }}
      />
    </>
  );
}
