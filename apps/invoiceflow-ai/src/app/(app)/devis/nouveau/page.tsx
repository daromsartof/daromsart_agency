import { redirect } from "next/navigation";
import { db } from "@/db";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import { getOrg } from "@/modules/organization/queries";
import { getClientById } from "@/modules/clients/queries";
import { listTemplates } from "@/modules/templates/queries";
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
  const templates = await listTemplates(db, organizationId);
  const quoteTemplates = templates.filter((t) => t.type === "quote" || t.type === "both");
  const defaultTemplate = quoteTemplates.find((t) => t.isDefault);

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
      templateOptions={quoteTemplates.map((t) => ({
        id: t.id,
        name: t.name,
        isDefault: t.isDefault,
        options: t.options,
      }))}
      defaultTemplateId={defaultTemplate?.id ?? ""}
    />
  );
}
