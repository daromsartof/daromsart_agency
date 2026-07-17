import { notFound, redirect } from "next/navigation";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import { getClientDetail, getClientStats } from "@/modules/clients/queries";
import { listQuotesForClient } from "@/modules/quotes/queries";
import { db } from "@/db";
import { ClientDetailClient } from "./client-detail-client";

export const metadata = { title: "Fiche client" };

export default async function ClientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    redirect("/");
  }

  const client = await getClientDetail(db, organizationId, params.id);
  if (!client) {
    notFound();
  }

  const stats = await getClientStats(db, organizationId, client.id);
  const quotes = await listQuotesForClient(db, organizationId, client.id);

  return <ClientDetailClient client={client} stats={stats} quotes={quotes} />;
}
