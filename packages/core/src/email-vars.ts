/**
 * Variables de personnalisation des textes d'email (H12) : `{client}`,
 * `{numero}`, `{total}`, `{lien}`, `{echeance}`. Une variable absente de
 * `vars` (ou non reconnue) est laissée telle quelle plutôt que de faire
 * planter le rendu — un texte d'email custom mal formé ne doit jamais
 * bloquer un envoi.
 */
export type EmailVariableName = "client" | "numero" | "total" | "lien" | "echeance";

export type EmailVariables = Partial<Record<EmailVariableName, string>>;

const VARIABLE_PATTERN = /\{(client|numero|total|lien|echeance)\}/g;

export function renderEmailVariables(text: string, vars: EmailVariables): string {
  return text.replace(VARIABLE_PATTERN, (match, name: EmailVariableName) => {
    return vars[name] ?? match;
  });
}
