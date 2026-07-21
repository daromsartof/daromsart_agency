/**
 * Formatage des numéros de documents (H6). Le format est configurable par
 * l'organisation (`organizations.numberFormats`, ex. `"FAC-{YYYY}-{seq:4}"`)
 * et supporte 3 tokens : `{YYYY}` (année sur 4 chiffres), `{YY}` (année sur 2
 * chiffres) et `{seq:n}` (numéro de séquence, complété à `n` chiffres avec
 * des zéros ; `n` omis → aucun complètement).
 */

const TOKEN_PATTERN = /\{(YYYY|YY|seq(?::(\d+))?)\}/g;

/** Vérifie qu'un format ne contient que des tokens reconnus. */
export function isValidDocumentNumberFormat(format: string): boolean {
  if (!format.trim()) return false;
  const withoutTokens = format.replace(TOKEN_PATTERN, "");
  // Un format valide ne doit plus contenir d'accolade après retrait des
  // tokens reconnus (accolade orpheline ou token inconnu).
  return !withoutTokens.includes("{") && !withoutTokens.includes("}");
}

export interface FormatDocumentNumberParams {
  year: number;
  seq: number;
}

/**
 * Résout un format en numéro concret. Lève une erreur explicite si le format
 * contient un token non reconnu (ex. `{foo}`) plutôt que de le laisser passer
 * tel quel — une organisation ne doit jamais pouvoir émettre un numéro avec
 * un artefact de template non résolu.
 */
export function formatDocumentNumber(
  format: string,
  { year, seq }: FormatDocumentNumberParams,
): string {
  if (!isValidDocumentNumberFormat(format)) {
    throw new Error(`Format de numérotation invalide : "${format}"`);
  }

  return format.replace(TOKEN_PATTERN, (_match, token: string, pad?: string) => {
    if (token === "YYYY") return String(year);
    if (token === "YY") return String(year % 100).padStart(2, "0");
    // token === "seq" (avec ou sans précision)
    const digits = pad ? Number(pad) : 0;
    return digits > 0 ? String(seq).padStart(digits, "0") : String(seq);
  });
}
