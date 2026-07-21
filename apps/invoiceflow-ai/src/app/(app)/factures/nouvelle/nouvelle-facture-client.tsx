"use client";

import { useRouter } from "next/navigation";
import { PageHeader, toast } from "@daromsart/ui";
import { DocumentForm, type DocumentTemplateOption } from "@/modules/documents/document-form";
import { createInvoiceAction } from "@/modules/invoices/actions";
import { emptyDocumentFormValues, type DocumentFormValues } from "@/modules/documents/document-form-schema";

export interface NouvelleFactureClientProps {
  vatRateOptions: number[];
  vatRateDefault: number;
  paymentTermsDays: number;
  preselectedClient?: { id: string; displayName: string };
  templateOptions: DocumentTemplateOption[];
  defaultTemplateId: string;
}

export function NouvelleFactureClient({
  vatRateOptions,
  vatRateDefault,
  paymentTermsDays,
  preselectedClient,
  templateOptions,
  defaultTemplateId,
}: NouvelleFactureClientProps) {
  const router = useRouter();

  const defaultValues: DocumentFormValues = {
    ...emptyDocumentFormValues(vatRateDefault, paymentTermsDays, defaultTemplateId),
    clientId: preselectedClient?.id ?? "",
    clientLabel: preselectedClient?.displayName ?? "",
  };

  return (
    <>
      <PageHeader
        title="Nouvelle facture"
        description="Composez les lignes, la remise et l'échéance de la facture."
      />
      <DocumentForm
        defaultValues={defaultValues}
        vatRateOptions={vatRateOptions}
        templateOptions={templateOptions}
        secondDateLabel="Date d'échéance"
        submitLabel="Créer la facture"
        onSubmit={(input) => createInvoiceAction(input)}
        onSuccess={(id) => {
          toast.success("Facture créée.");
          if (id) router.push(`/factures/${id}/modifier`);
        }}
      />
    </>
  );
}
