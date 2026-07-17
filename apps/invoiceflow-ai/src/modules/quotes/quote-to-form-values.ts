import type { DocumentFormValues } from "@/modules/documents/document-form-schema";
import type { QuoteDetail } from "./queries";

/** Convertit un devis chargé en base vers les valeurs par défaut de l'éditeur. */
export function quoteToFormValues(quote: QuoteDetail): DocumentFormValues {
  return {
    clientId: quote.clientId,
    clientLabel: quote.clientName,
    issueDate: quote.issueDate ?? undefined,
    validUntil: quote.validUntil ?? undefined,
    notes: quote.notes ?? "",
    globalDiscountType: quote.globalDiscount?.type ?? "",
    globalDiscountValue: quote.globalDiscount ? String(quote.globalDiscount.value) : "",
    lines: quote.lines.map((line) => ({
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
