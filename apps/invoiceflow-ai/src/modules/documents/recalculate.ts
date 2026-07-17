import {
  computeDocumentTotals,
  type Discount,
  type TotalsLineInput,
} from "@daromsart/core";

/**
 * Recalcul autoritaire des totaux, effectué et persisté côté serveur à
 * chaque écriture (création/modification) — jamais accepté tel quel depuis
 * le client. Le client n'affiche qu'une prévision (`totals-panel.tsx`) via
 * le même moteur `@daromsart/core`, mais seule cette fonction fait foi pour
 * les valeurs stockées en base.
 */
export interface RecalculateLine {
  quantity: number;
  unitPriceCents: number;
  vatRate: number;
  discount?: Discount | null;
}

export interface RecalculatedTotals {
  subtotalCents: number;
  discountCents: number;
  vatByRate: Record<string, number>;
  totalCents: number;
}

export function recalculateDocumentTotals(
  lines: RecalculateLine[],
  globalDiscount?: Discount | null,
): RecalculatedTotals {
  const input: TotalsLineInput[] = lines.map((l) => ({
    quantity: l.quantity,
    unitPriceCents: l.unitPriceCents,
    vatRate: l.vatRate,
    discount: l.discount ?? null,
  }));
  const totals = computeDocumentTotals(input, globalDiscount ?? null);
  return {
    subtotalCents: totals.subtotal,
    discountCents: totals.discount,
    vatByRate: totals.vatByRate,
    totalCents: totals.total,
  };
}
