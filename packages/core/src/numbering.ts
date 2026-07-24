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

const MAX_FORMAT_LENGTH = 40;
const SEQ_TOKEN_PATTERN = /\{seq(?::(\d+))?\}/g;

export type ValidateNumberFormatResult = { valid: true } | { valid: false; error: string };

/**
 * Validation STRICTE pour le formulaire de paramétrage (story 22) — distincte
 * d'`isValidDocumentNumberFormat` (garde défensive à l'émission, plus
 * permissive : tolère un format sans `{seq}` pour ne jamais bloquer une
 * émission sur un format déjà enregistré). Un format soumis via ce
 * formulaire DOIT contenir `{seq}` exactement une fois (parade « format sans
 * seq → collision garantie ») et tout `{seq:n}` doit avoir 2 ≤ n ≤ 6.
 */
export function validateNumberFormat(format: string): ValidateNumberFormatResult {
  if (!format.trim()) {
    return { valid: false, error: "Le format ne peut pas être vide." };
  }
  if (format.length > MAX_FORMAT_LENGTH) {
    return { valid: false, error: `Le format ne peut pas dépasser ${MAX_FORMAT_LENGTH} caractères.` };
  }
  if (!isValidDocumentNumberFormat(format)) {
    return { valid: false, error: "Le format contient un token inconnu ou une accolade mal fermée." };
  }

  const seqMatches = [...format.matchAll(SEQ_TOKEN_PATTERN)];
  if (seqMatches.length !== 1) {
    return {
      valid: false,
      error:
        seqMatches.length === 0
          ? "Le format doit contenir le token {seq} (numéro de séquence)."
          : "Le format ne peut contenir qu'un seul token {seq}.",
    };
  }
  const pad = seqMatches[0][1];
  if (pad !== undefined) {
    const digits = Number(pad);
    if (digits < 2 || digits > 6) {
      return { valid: false, error: "Le nombre de chiffres de {seq:n} doit être compris entre 2 et 6." };
    }
  }

  return { valid: true };
}

/** Aperçu d'un numéro pour un format donné, année civile courante — `seq` est
 * déjà le numéro à afficher (l'appelant calcule `lastNumber + 1` en amont,
 * lu depuis `number_sequences`). */
export function previewNextNumber(format: string, seq: number): string {
  return formatDocumentNumber(format, { year: new Date().getFullYear(), seq });
}
