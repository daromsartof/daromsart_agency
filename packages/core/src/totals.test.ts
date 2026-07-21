import { describe, expect, it } from "vitest";
import { computeDocumentTotals, type TotalsLineInput } from "./totals";

function line(partial: Partial<TotalsLineInput>): TotalsLineInput {
  return {
    quantity: 1,
    unitPriceCents: 1000,
    vatRate: 20,
    discount: null,
    ...partial,
  };
}

describe("computeDocumentTotals", () => {
  it("1. une ligne, un taux, sans remise", () => {
    const result = computeDocumentTotals([line({ unitPriceCents: 10000, vatRate: 20 })]);
    expect(result.subtotal).toBe(10000);
    expect(result.discount).toBe(0);
    expect(result.vatByRate).toEqual({ "20": 2000 });
    expect(result.total).toBe(12000);
  });

  it("2. plusieurs lignes, taux multiples, sans remise", () => {
    const result = computeDocumentTotals([
      line({ unitPriceCents: 10000, vatRate: 20 }),
      line({ unitPriceCents: 5000, vatRate: 10 }),
      line({ unitPriceCents: 2000, vatRate: 0 }),
    ]);
    expect(result.subtotal).toBe(17000);
    expect(result.vatByRate).toEqual({ "20": 2000, "10": 500, "0": 0 });
    expect(result.total).toBe(17000 + 2000 + 500);
  });

  it("3. remise ligne en pourcentage", () => {
    const result = computeDocumentTotals([
      line({ unitPriceCents: 10000, vatRate: 20, discount: { type: "percent", value: 10 } }),
    ]);
    expect(result.subtotal).toBe(9000);
    expect(result.vatByRate).toEqual({ "20": 1800 });
    expect(result.total).toBe(10800);
  });

  it("4. remise ligne en montant fixe", () => {
    const result = computeDocumentTotals([
      line({ unitPriceCents: 10000, vatRate: 20, discount: { type: "amount", value: 1500 } }),
    ]);
    expect(result.subtotal).toBe(8500);
    expect(result.vatByRate).toEqual({ "20": 1700 });
    expect(result.total).toBe(10200);
  });

  it("5. remise globale en pourcentage, prorata sur taux multiples", () => {
    const result = computeDocumentTotals(
      [
        line({ unitPriceCents: 10000, vatRate: 20 }),
        line({ unitPriceCents: 10000, vatRate: 10 }),
      ],
      { type: "percent", value: 10 },
    );
    // subtotal 20000, remise 10% = 2000, prorata 50/50 → 1000 chacune
    expect(result.subtotal).toBe(20000);
    expect(result.discount).toBe(2000);
    expect(result.vatByRate).toEqual({ "20": 1800, "10": 900 });
    expect(result.total).toBe(20000 - 2000 + 1800 + 900);
  });

  it("6. remise globale en montant fixe, prorata sur taux multiples", () => {
    const result = computeDocumentTotals(
      [
        line({ unitPriceCents: 30000, vatRate: 20 }),
        line({ unitPriceCents: 10000, vatRate: 10 }),
      ],
      { type: "amount", value: 4000 },
    );
    // subtotal 40000 ; prorata 3/4 et 1/4 → 3000 et 1000
    expect(result.discount).toBe(4000);
    expect(result.vatByRate).toEqual({
      "20": Math.round((30000 - 3000) * 0.2),
      "10": Math.round((10000 - 1000) * 0.1),
    });
  });

  it("7. remise ligne + remise globale combinées", () => {
    const result = computeDocumentTotals(
      [
        line({
          unitPriceCents: 10000,
          vatRate: 20,
          discount: { type: "percent", value: 10 },
        }),
      ],
      { type: "percent", value: 10 },
    );
    // ligne : 10000 -10% = 9000 (subtotal) ; remise globale 10% de 9000 = 900
    expect(result.subtotal).toBe(9000);
    expect(result.discount).toBe(900);
    expect(result.vatByRate).toEqual({ "20": Math.round((9000 - 900) * 0.2) });
  });

  it("8. quantité fractionnaire 0,333", () => {
    const result = computeDocumentTotals([
      line({ unitPriceCents: 300, quantity: 0.333, vatRate: 20 }),
    ]);
    expect(result.subtotal).toBe(100);
    expect(result.vatByRate).toEqual({ "20": 20 });
  });

  it("9. montant unitaire de 1 centime", () => {
    const result = computeDocumentTotals([
      line({ unitPriceCents: 1, quantity: 1, vatRate: 20 }),
    ]);
    expect(result.subtotal).toBe(1);
    expect(result.vatByRate).toEqual({ "20": 0 });
    expect(result.total).toBe(1);
  });

  it("10. remise globale supérieure au total → clamp à 0", () => {
    const result = computeDocumentTotals(
      [line({ unitPriceCents: 5000, vatRate: 20 })],
      { type: "amount", value: 999999 },
    );
    expect(result.discount).toBe(5000);
    expect(result.vatByRate).toEqual({ "20": 0 });
    expect(result.total).toBe(0);
  });

  it("11. taux 0 % (franchise en base, art. 293 B)", () => {
    const result = computeDocumentTotals([line({ unitPriceCents: 10000, vatRate: 0 })]);
    expect(result.vatByRate).toEqual({ "0": 0 });
    expect(result.total).toBe(10000);
  });

  it("12. arrondi par taux (une fois pour le groupe, pas ligne par ligne)", () => {
    // 3 lignes à 5,5% de 1 centime chacune : ligne par ligne 0,055ct arrondirait
    // à 0 trois fois (total 0) ; groupé, 3 centimes × 5,5% = 0,165 → arrondi à 0.
    // On vérifie plutôt un cas où le regroupement change le résultat par rapport
    // à un arrondi ligne à ligne naïf.
    const result = computeDocumentTotals([
      line({ unitPriceCents: 50, vatRate: 5.5 }),
      line({ unitPriceCents: 50, vatRate: 5.5 }),
      line({ unitPriceCents: 50, vatRate: 5.5 }),
    ]);
    // Regroupé : taxable = 150, 5.5% de 150 = 8,25 → 8 (half-up de 8,25 → 8).
    // Ligne par ligne : 5.5% de 50 = 2,75 → 3 chacune, total 9 (différent).
    expect(result.vatByRate).toEqual({ "5.5": 8 });
  });

  it("13. remise ligne ne peut pas rendre le HT négatif (clamp à 0)", () => {
    const result = computeDocumentTotals([
      line({ unitPriceCents: 1000, vatRate: 20, discount: { type: "amount", value: 5000 } }),
    ]);
    expect(result.subtotal).toBe(0);
    expect(result.vatByRate).toEqual({ "20": 0 });
    expect(result.total).toBe(0);
  });

  it("14. document sans lignes taxables (subtotal 0) ne divise pas par zéro", () => {
    const result = computeDocumentTotals([line({ unitPriceCents: 0, vatRate: 20 })], {
      type: "percent",
      value: 50,
    });
    expect(result.subtotal).toBe(0);
    expect(result.discount).toBe(0);
    expect(result.total).toBe(0);
  });

  it("15. quantités négatives (avoir, story 18) : total négatif, jamais clampé à 0", () => {
    const result = computeDocumentTotals([
      line({ unitPriceCents: 10000, quantity: -1, vatRate: 20 }),
    ]);
    expect(result.subtotal).toBe(-10000);
    expect(result.vatByRate).toEqual({ "20": -2000 });
    expect(result.total).toBe(-12000);
  });

  it("16. avoir partiel (quantité négative fractionnaire) — TVA négative arrondie par taux", () => {
    const result = computeDocumentTotals([
      line({ unitPriceCents: 15000, quantity: -0.5, vatRate: 10 }),
    ]);
    expect(result.subtotal).toBe(-7500);
    expect(result.vatByRate).toEqual({ "10": -750 });
    expect(result.total).toBe(-8250);
  });

  it("17. avoir : une remise ligne ne s'applique jamais à une ligne négative (garde base <= 0)", () => {
    const result = computeDocumentTotals([
      line({
        unitPriceCents: 10000,
        quantity: -1,
        vatRate: 20,
        discount: { type: "percent", value: 10 },
      }),
    ]);
    // La remise (pensée pour une ligne positive) est ignorée sur une ligne
    // négative plutôt que de produire un résultat incohérent.
    expect(result.subtotal).toBe(-10000);
    expect(result.total).toBe(-12000);
  });

  it("18. avoir : une remise globale ne s'applique jamais à un sous-total négatif", () => {
    const result = computeDocumentTotals(
      [line({ unitPriceCents: 10000, quantity: -1, vatRate: 20 })],
      { type: "amount", value: 1000 },
    );
    expect(result.discount).toBe(0);
    expect(result.total).toBe(-12000);
  });

  it("19. avoir multi-lignes, taux mixtes : totaux au centime, symétriques de la facture d'origine", () => {
    const invoiceLines = [
      line({ unitPriceCents: 20000, quantity: 2, vatRate: 20 }),
      line({ unitPriceCents: 5000, quantity: 1, vatRate: 10 }),
    ];
    const invoiceTotals = computeDocumentTotals(invoiceLines);

    const creditNoteLines = invoiceLines.map((l) => ({ ...l, quantity: -l.quantity }));
    const creditNoteTotals = computeDocumentTotals(creditNoteLines);

    expect(creditNoteTotals.subtotal).toBe(-invoiceTotals.subtotal);
    expect(creditNoteTotals.total).toBe(-invoiceTotals.total);
    for (const rate of Object.keys(invoiceTotals.vatByRate)) {
      expect(creditNoteTotals.vatByRate[rate]).toBe(-invoiceTotals.vatByRate[rate]);
    }
  });
});
