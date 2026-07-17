import { redirect } from "next/navigation";
import { db } from "@/db";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import { getOrg } from "@/modules/organization/queries";
import { getClientById } from "@/modules/clients/queries";
import { NouveauDevisClient } from "./nouveau-devis-client";

export const metadata = { title: "Nouveau devis" };

export default async function NouveauDevisPage({
  searchParams,
}: {
  searchParams: { client?: string };
}) {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    redirect("/");
  }

  const org = await getOrg();

  let preselectedClient: { id: string; displayName: string } | undefined;
  if (searchParams.client) {
    const client = await getClientById(db, organizationId, searchParams.client);
    if (client) {
      preselectedClient = { id: client.id, displayName: client.displayName };
    }
  }

  return (
    <NouveauDevisClient
      vatRateOptions={org.vatRatesActive}
      vatRateDefault={Number(org.vatRateDefault)}
      quoteValidityDays={org.quoteValidityDays}
      preselectedClient={preselectedClient}
    />
  );
}
