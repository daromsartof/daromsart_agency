/**
 * Validation IBAN (ISO 13616, contrôle mod-97) et BIC (ISO 9362).
 * Domaine pur, sans dépendance — testé unitairement.
 */

/** Retire les espaces et met en majuscules. */
export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

/** Formatte un IBAN par groupes de 4 pour l'affichage (« FR76 3000 … »). */
export function formatIban(value: string): string {
  return normalizeIban(value).replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Valide un IBAN via le contrôle mod-97.
 * Longueur 15–34, 2 lettres pays + 2 chiffres de contrôle + BBAN alphanumérique.
 */
export function isValidIban(value: string): boolean {
  const iban = normalizeIban(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) {
    return false;
  }

  // Déplace les 4 premiers caractères à la fin.
  const rearranged = iban.slice(4) + iban.slice(0, 4);

  // Convertit les lettres en nombres (A=10 … Z=35) puis calcule mod 97 par
  // segments pour éviter les dépassements d'entier sur les grands nombres.
  let remainder = 0;
  for (const char of rearranged) {
    const code = char.charCodeAt(0);
    const chunk =
      code >= 65 && code <= 90
        ? String(code - 55) // A(65)->10 … Z(90)->35
        : char;
    for (const digit of chunk) {
      remainder = (remainder * 10 + (digit.charCodeAt(0) - 48)) % 97;
    }
  }
  return remainder === 1;
}

/**
 * Valide un BIC/SWIFT : 6 lettres (banque + pays) + 2 alphanum (localité) +
 * éventuellement 3 alphanum (agence). Longueur 8 ou 11.
 */
export function isValidBic(value: string): boolean {
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(value.trim().toUpperCase());
}
