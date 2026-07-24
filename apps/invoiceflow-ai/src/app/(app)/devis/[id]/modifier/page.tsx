import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import { getOrg } from "@/modules/organization/queries";
import { getQuoteById } from "@/modules/quotes/queries";
import { listTemplates } from "@/modules/templates/queries";
import { ModifierDevisClient } from "./modifier-devis-client";

export const metadata = { title: "Modifier le devis" };

export default async function ModifierDevisPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    redirect("/");
  }

  const quote = await getQuoteById(db, organizationId, params.id);
  if (!quote) {
    notFound();
  }
  if (quote.status !== "draft") {
    redirect(`/devis/${quote.id}`);
  }

  const org = await getOrg();
  const templates = await listTemplates(db, organizationId);
  const quoteTemplates = templates
    .filter((t) => t.type === "quote" || t.type === "both")
    .map((t) => ({
      id: t.id,
      name: t.name,
      isDefault: t.isDefault,
      options: t.options,
    }));

  return (
    <ModifierDevisClient
      quote={quote}
      vatRateOptions={org.vatRatesActive}
      templateOptions={quoteTemplates}
    />
  );
}
