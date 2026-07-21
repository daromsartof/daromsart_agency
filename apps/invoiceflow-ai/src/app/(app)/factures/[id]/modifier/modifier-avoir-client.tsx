"use client";

import { useRouter } from "next/navigation";
import { PageHeader, toast } from "@daromsart/ui";
import { DocumentForm, type DocumentTemplateOption } from "@/modules/documents/document-form";
import { updateCreditNoteAction } from "@/modules/invoices/actions";
import { invoiceToFormValues } from "@/modules/invoices/invoice-to-form-values";
import type { InvoiceDetail } from "@/modules/invoices/queries";

export interface ModifierAvoirClientProps {
  invoice: InvoiceDetail;
  vatRateOptions: number[];
  templateOptions: DocumentTemplateOption[];
  /** Numéro de la facture d'origine (toujours présente pour un avoir). */
  parentInvoiceNumber: string | null;
}

/**
 * Éditeur d'avoir brouillon (story 18, E-11) — même `DocumentForm` partagé
 * que la facture (le schéma RHF ne contraint pas le signe de la quantité,
 * seul `creditNoteDraftSchema` côté serveur l'impose) ; bannière dédiée pour
 * rappeler la contrainte de signe et le plafond du reste créditable.
 */
export function ModifierAvoirClient({
  invoice,
  vatRateOptions,
  templateOptions,
  parentInvoiceNumber,
}: ModifierAvoirClientProps) {
  const router = useRouter();

  return (
    <>
      <PageHeader
        title={`Modifier l'avoir${invoice.clientName ? ` — ${invoice.clientName}` : ""}`}
        description="Brouillon : les modifications ne sont visibles que par vous jusqu'à l'émission."
      />
      <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
        Avoir sur la facture {parentInvoiceNumber ?? "d'origine"} : les quantités doivent rester
        négatives (un avoir crédite, il ne facture jamais) et le total absolu ne peut pas dépasser
        le reste créditable de cette facture.
      </div>
      <DocumentForm
        defaultValues={invoiceToFormValues(invoice)}
        vatRateOptions={vatRateOptions}
        templateOptions={templateOptions}
        secondDateLabel="Date d'échéance"
        submitLabel="Enregistrer"
        onSubmit={(input) => updateCreditNoteAction(invoice.id, input)}
        onSuccess={() => {
          toast.success("Avoir mis à jour.");
          router.push(`/factures/${invoice.id}`);
        }}
      />
    </>
  );
}
