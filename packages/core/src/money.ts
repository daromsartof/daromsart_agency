/**
 * Montants en centimes (entier), jamais en float. `Cents` documente l'intention
 * mais reste un `number` — TypeScript n'a pas de type entier distinct.
 */
export type Cents = number;

/** Formate des centimes en euros fr-FR avec symbole (« 1 234,56 € »). */
export function formatEUR(cents: Cents): string {
  return (Math.round(cents) / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  });
}

/** Somme de montants en centimes (entiers, addition exacte). */
export function addCents(...values: Cents[]): Cents {
  return values.reduce((sum, v) => sum + v, 0);
}

/**
 * Multiplie un montant (centimes) par une quantité potentiellement fractionnaire
 * (ex. 0,333) sans jamais passer par une division/multiplication flottante sur
 * le résultat final : la quantité est convertie en millièmes (entier), le
 * produit centimes×millièmes est un entier, puis on divise par 1000 avec un
 * arrondi half-up réalisé entièrement en arithmétique entière.
 */
export function mulQty(cents: Cents, qty: number): Cents {
  const qtyMilli = Math.round(qty * 1000);
  const product = cents * qtyMilli;
  const sign = product < 0 ? -1 : 1;
  const abs = Math.abs(product);
  return sign * Math.floor((abs + 500) / 1000);
}

/**
 * Arrondi half-up d'un pourcentage appliqué à un montant en centimes, sans
 * float sur l'opération de division : le taux (ex. 5,5) est converti en
 * millièmes de point (5500), le produit reste entier, division par 100000
 * (100 pour le %, ×1000 pour les millièmes) avec arrondi half-up entier.
 */
export function applyPercent(cents: Cents, percent: number): Cents {
  const percentBasis = Math.round(percent * 1000);
  const numerator = cents * percentBasis;
  const sign = numerator < 0 ? -1 : 1;
  const abs = Math.abs(numerator);
  return sign * Math.floor((abs + 50000) / 100000);
}
