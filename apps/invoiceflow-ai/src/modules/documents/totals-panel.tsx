"use client";

import { useMemo } from "react";
import { useWatch, type Control } from "react-hook-form";
import { computeDocumentTotals } from "@daromsart/core";
import { formatCentsEUR } from "@daromsart/ui";
import { toTotalsInput, type DocumentFormValues } from "./document-form-schema";

export interface TotalsPanelProps {
  control: Control<DocumentFormValues>;
}

/**
 * Prévisualisation live des totaux, calculée côté client avec le même
 * moteur (`@daromsart/core`) que le serveur — mais seul le recalcul serveur
 * (`recalculate.ts`) fait foi pour les valeurs persistées.
 */
export function TotalsPanel({ control }: TotalsPanelProps) {
  const values = useWatch({ control });

  const totals = useMemo(() => {
    const safeValues = values as DocumentFormValues;
    if (!safeValues?.lines?.length) {
      return computeDocumentTotals([], null);
    }
    const { lines, globalDiscount } = toTotalsInput(safeValues);
    return computeDocumentTotals(lines, globalDiscount);
  }, [values]);

  const vatEntries = Object.entries(totals.vatByRate).filter(([, cents]) => cents !== 0 || Object.keys(totals.vatByRate).length === 1);

  return (
    <div className="space-y-2 rounded-lg border p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Sous-total HT</span>
        <span className="tabular-nums">{formatCentsEUR(totals.subtotal)}</span>
      </div>
      {totals.discount > 0 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Remise</span>
          <span className="tabular-nums">-{formatCentsEUR(totals.discount)}</span>
        </div>
      ) : null}
      {vatEntries.map(([rate, cents]) => (
        <div key={rate} className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">TVA {rate} %</span>
          <span className="tabular-nums">{formatCentsEUR(cents)}</span>
        </div>
      ))}
      <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
        <span>Total TTC</span>
        <span className="tabular-nums">{formatCentsEUR(totals.total)}</span>
      </div>
    </div>
  );
}
