import { applyPercent, mulQty, type Cents } from "./money";

export type DiscountKind = "percent" | "amount";

export interface Discount {
  type: DiscountKind;
  /** `percent` : 0–100. `amount` : centimes. */
  value: number;
}

export interface TotalsLineInput {
  quantity: number;
  unitPriceCents: Cents;
  /** Taux de TVA en pourcentage (0, 5.5, 10, 20…). */
  vatRate: number;
  /** Remise ligne, appliquée avant la remise globale. */
  discount?: Discount | null;
}

export interface DocumentTotals {
  /** Total HT après remises ligne, avant remise globale. */
  subtotal: Cents;
  /** Remise globale (document), en centimes. */
  discount: Cents;
  /** TVA par taux (clé = taux en string, ex. "20", "5.5"), après remises. */
  vatByRate: Record<string, Cents>;
  /** Total TTC. */
  total: Cents;
}

function clamp(value: Cents, min: Cents, max: Cents): Cents {
  return Math.min(Math.max(value, min), max);
}

function discountAmount(base: Cents, discount: Discount | null | undefined): Cents {
  if (!discount || discount.value <= 0 || base <= 0) return 0;
  const raw =
    discount.type === "percent"
      ? applyPercent(base, discount.value)
      : Math.round(discount.value);
  return clamp(raw, 0, base);
}

/**
 * Distribue `total` (centimes) entre `weights` (poids entiers, mêmes unités)
 * au prorata, en garantissant que la somme des parts vaut exactement `total`
 * (l'arrondi restant est absorbé par la dernière part non nulle).
 */
function proRata(total: Cents, weights: Cents[]): Cents[] {
  const sumWeights = weights.reduce((a, b) => a + b, 0);
  if (total === 0 || sumWeights === 0) return weights.map(() => 0);

  const shares: Cents[] = [];
  let allocated = 0;
  for (let i = 0; i < weights.length; i++) {
    if (i === weights.length - 1) {
      shares.push(total - allocated);
      continue;
    }
    const share = Math.floor((total * weights[i] + sumWeights / 2) / sumWeights);
    shares.push(share);
    allocated += share;
  }
  return shares;
}

/**
 * Moteur de totaux (invariant #1 du ledger, « règle FR ») :
 * 1. remise ligne d'abord (par ligne, sur son propre HT) ;
 * 2. remise globale ensuite, au prorata du HT net de chaque ligne ;
 * 3. TVA calculée par taux, sur la base HT après les deux remises,
 *    arrondie une seule fois par taux (pas ligne par ligne).
 *
 * Aucune opération flottante n'intervient sur les montants : `mulQty` et
 * `applyPercent` travaillent en arithmétique entière.
 */
export function computeDocumentTotals(
  lines: TotalsLineInput[],
  globalDiscount?: Discount | null,
): DocumentTotals {
  const lineNetHT: Cents[] = [];
  const lineVatRate: number[] = [];

  for (const line of lines) {
    const gross = mulQty(line.unitPriceCents, line.quantity);
    const lineDiscount = discountAmount(gross, line.discount);
    lineNetHT.push(gross - lineDiscount);
    lineVatRate.push(line.vatRate);
  }

  const subtotal = lineNetHT.reduce((a, b) => a + b, 0);

  const globalDiscountCents = discountAmount(subtotal, globalDiscount);
  const taxableShares = proRata(globalDiscountCents, lineNetHT).map(
    (share, i) => lineNetHT[i] - share,
  );

  const taxableByRate = new Map<number, Cents>();
  for (let i = 0; i < taxableShares.length; i++) {
    const rate = lineVatRate[i];
    taxableByRate.set(rate, (taxableByRate.get(rate) ?? 0) + taxableShares[i]);
  }

  const vatByRate: Record<string, Cents> = {};
  let vatTotal = 0;
  for (const [rate, taxable] of taxableByRate) {
    const vat = applyPercent(taxable, rate);
    vatByRate[String(rate)] = vat;
    vatTotal += vat;
  }

  const total = subtotal - globalDiscountCents + vatTotal;

  return {
    subtotal,
    discount: globalDiscountCents,
    vatByRate,
    // Jamais de clamp à 0 ici : un avoir (story 18) a des quantités
    // négatives et donc un total négatif, légitime. Un devis/facture normal
    // ne peut jamais atteindre ce cas (les remises sont déjà bornées au
    // sous-total par `discountAmount`, qui ne s'applique d'ailleurs jamais
    // à une ligne ou un sous-total négatif — garde `base <= 0` ci-dessus).
    total,
  };
}
