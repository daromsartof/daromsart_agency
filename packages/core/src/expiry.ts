/**
 * Expiration d'un devis (H14) : calculée, jamais stockée (comme `overdue`
 * pour les factures). Un devis reste valable jusqu'à la fin de la journée de
 * `validUntil` — simplification volontaire (UTC plutôt qu'un calcul
 * Europe/Paris exact avec heure d'été/hiver) : suffisant pour un outil
 * interne FR (YAGNI, H20), à revoir seulement si un vrai décalage à la
 * frontière du jour est signalé en pratique.
 */
export function isQuoteExpired(validUntil: Date | null, now: Date = new Date()): boolean {
  if (!validUntil) return false;
  const endOfDay = new Date(
    Date.UTC(
      validUntil.getUTCFullYear(),
      validUntil.getUTCMonth(),
      validUntil.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
  return now.getTime() > endOfDay.getTime();
}
