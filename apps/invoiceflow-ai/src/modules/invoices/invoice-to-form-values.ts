import type { DocumentFormValues } from "@/modules/documents/document-form-schema";
import type { InvoiceDetail } from "./queries";

/** Convertit une facture chargée en base vers les valeurs par défaut de l'éditeur. */
export function invoiceToFormValues(invoice: InvoiceDetail): DocumentFormValues {
  return {
    clientId: invoice.clientId,
    clientLabel: invoice.clientName,
    templateId: invoice.templateId ?? "",
    issueDate: invoice.issueDate ?? undefined,
    validUntil: invoice.dueDate ?? undefined,
    notes: invoice.notes ?? "",
    globalDiscountType: invoice.globalDiscount?.type ?? "",
    globalDiscountValue: invoice.globalDiscount ? String(invoice.globalDiscount.value) : "",
    lines: invoice.lines.map((line) => ({
      lineId: line.id,
      description: line.description,
      quantity: String(line.quantity),
      unitPriceCents: line.unitPriceCents,
      vatRate: String(line.vatRate),
      discountType: line.discount?.type ?? "",
      discountValue: line.discount ? String(line.discount.value) : "",
    })),
  };
}
