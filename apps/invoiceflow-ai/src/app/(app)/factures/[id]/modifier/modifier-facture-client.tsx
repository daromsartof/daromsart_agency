"use client";

import { useRouter } from "next/navigation";
import { PageHeader, toast } from "@daromsart/ui";
import { DocumentForm, type DocumentTemplateOption } from "@/modules/documents/document-form";
import { updateInvoiceAction } from "@/modules/invoices/actions";
import { invoiceToFormValues } from "@/modules/invoices/invoice-to-form-values";
import type { InvoiceDetail } from "@/modules/invoices/queries";

export interface ModifierFactureClientProps {
  invoice: InvoiceDetail;
  vatRateOptions: number[];
  templateOptions: DocumentTemplateOption[];
}

export function ModifierFactureClient({
  invoice,
  vatRateOptions,
  templateOptions,
}: ModifierFactureClientProps) {
  const router = useRouter();

  return (
    <>
      <PageHeader
        title={`Modifier la facture${invoice.clientName ? ` — ${invoice.clientName}` : ""}`}
        description="Brouillon : les modifications ne sont visibles que par vous jusqu'à l'émission."
      />
      <DocumentForm
        defaultValues={invoiceToFormValues(invoice)}
        vatRateOptions={vatRateOptions}
        templateOptions={templateOptions}
        secondDateLabel="Date d'échéance"
        submitLabel="Enregistrer"
        onSubmit={(input) => updateInvoiceAction(invoice.id, input)}
        onSuccess={() => {
          toast.success("Facture mise à jour.");
          router.push("/factures");
        }}
      />
    </>
  );
}
