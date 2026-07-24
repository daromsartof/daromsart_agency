import { redirect } from "next/navigation";
import { db } from "@/db";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import { getOrg } from "@/modules/organization/queries";
import { getClientById } from "@/modules/clients/queries";
import { listTemplates } from "@/modules/templates/queries";
import { NouvelleFactureClient } from "./nouvelle-facture-client";

export const metadata = { title: "Nouvelle facture" };

export default async function NouvelleFacturePage({
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
  const invoiceTemplates = templates.filter((t) => t.type === "invoice" || t.type === "both");
  const defaultTemplate = invoiceTemplates.find((t) => t.isDefault);

  let preselectedClient: { id: string; displayName: string } | undefined;
  if (searchParams.client) {
    const client = await getClientById(db, organizationId, searchParams.client);
    if (client) {
      preselectedClient = { id: client.id, displayName: client.displayName };
    }
  }

  return (
    <NouvelleFactureClient
      vatRateOptions={org.vatRatesActive}
      vatRateDefault={Number(org.vatRateDefault)}
      paymentTermsDays={org.paymentTermsDays}
      preselectedClient={preselectedClient}
      templateOptions={invoiceTemplates.map((t) => ({
        id: t.id,
        name: t.name,
        isDefault: t.isDefault,
        options: t.options,
      }))}
      defaultTemplateId={defaultTemplate?.id ?? ""}
    />
  );
}
