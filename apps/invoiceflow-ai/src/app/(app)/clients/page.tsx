import { redirect } from "next/navigation";
import { PageHeader } from "@daromsart/ui";
import { db } from "@/db";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import { listClients } from "@/modules/clients/queries";
import { ClientsPageClient } from "./clients-page-client";

export const metadata = { title: "Clients" };

const PAGE_SIZE = 10;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string; archives?: string };
}) {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    redirect("/");
  }

  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1);
  const q = searchParams.q ?? "";
  const includeArchived = searchParams.archives === "1";

  const result = await listClients(db, {
    organizationId,
    q,
    includeArchived,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <>
      <PageHeader
        title="Clients"
        description="Gérez vos clients et leurs contacts."
      />
      <ClientsPageClient
        items={result.items}
        page={result.page}
        pageCount={result.pageCount}
        query={q}
        includeArchived={includeArchived}
      />
    </>
  );
}
