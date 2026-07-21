/**
 * Rate-limit mémoire simple (H4/architecture §6) sur les actions publiques
 * (`p/`) : par clé (IP), fenêtre glissante fixe de 60 s. Suffisant pour V1 —
 * pas de partage entre instances (upgrade Redis plus tard si besoin, noté
 * dans plans/architecture.md).
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

/** `true` si la requête est autorisée (et comptabilisée), `false` si la limite est dépassée. */
export function checkRateLimit(
  key: string,
  now: number = Date.now(),
  maxRequests: number = MAX_REQUESTS_PER_WINDOW,
): boolean {
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= maxRequests) {
    return false;
  }
  bucket.count += 1;
  return true;
}

/** Réservé aux tests : vide l'état entre deux scénarios. */
export function resetRateLimit(): void {
  buckets.clear();
}
