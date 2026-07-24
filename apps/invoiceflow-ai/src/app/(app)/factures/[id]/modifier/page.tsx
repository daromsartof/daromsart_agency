import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import { getOrg } from "@/modules/organization/queries";
import { getInvoiceById } from "@/modules/invoices/queries";
import { getQuoteById } from "@/modules/quotes/queries";
import { listTemplates } from "@/modules/templates/queries";
import { ModifierFactureClient } from "./modifier-facture-client";
import { ModifierAvoirClient } from "./modifier-avoir-client";

export const metadata = { title: "Modifier la facture" };

export default async function ModifierFacturePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    redirect("/");
  }

  const invoice = await getInvoiceById(db, organizationId, params.id);
  if (!invoice) {
    notFound();
  }
  if (invoice.status !== "draft") {
    redirect(`/factures/${invoice.id}`);
  }

  const org = await getOrg();
  const templates = await listTemplates(db, organizationId);
  const invoiceTemplates = templates
    .filter((t) => t.type === "invoice" || t.type === "both")
    .map((t) => ({
      id: t.id,
      name: t.name,
      isDefault: t.isDefault,
      options: t.options,
    }));

  if (invoice.kind === "credit_note") {
    const parent = invoice.parentInvoiceId
      ? await getInvoiceById(db, organizationId, invoice.parentInvoiceId)
      : null;
    return (
      <ModifierAvoirClient
        invoice={invoice}
        vatRateOptions={org.vatRatesActive}
        templateOptions={invoiceTemplates}
        parentInvoiceNumber={parent?.number ?? null}
      />
    );
  }

  const originQuote = invoice.quoteId
    ? await getQuoteById(db, organizationId, invoice.quoteId)
    : null;

  return (
    <ModifierFactureClient
      invoice={invoice}
      vatRateOptions={org.vatRatesActive}
      templateOptions={invoiceTemplates}
      originQuoteNumber={originQuote?.number ?? null}
    />
  );
}
