"use client";

import { useRouter } from "next/navigation";
import { PageHeader, toast } from "@daromsart/ui";
import {
  InvoiceCreateWizard,
  type InvoiceWizardTemplateOption,
} from "@/modules/documents/invoice-create-wizard";
import { createInvoiceAction } from "@/modules/invoices/actions";
import {
  emptyDocumentFormValues,
  type DocumentFormValues,
} from "@/modules/documents/document-form-schema";

export interface NouvelleFactureClientProps {
  vatRateOptions: number[];
  vatRateDefault: number;
  paymentTermsDays: number;
  preselectedClient?: { id: string; displayName: string };
  templateOptions: InvoiceWizardTemplateOption[];
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
        description="Créez une facture en quelques étapes : client, lignes, modèle, vérification."
      />
      <InvoiceCreateWizard
        defaultValues={defaultValues}
        vatRateOptions={vatRateOptions}
        templateOptions={templateOptions}
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
