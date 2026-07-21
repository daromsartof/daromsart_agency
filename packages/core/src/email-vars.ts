/**
 * Variables de personnalisation des textes d'email (H12) : `{client}`,
 * `{numero}`, `{total}`, `{lien}`, `{echeance}`, `{jours_retard}` (story 16,
 * relance — nombre de jours de retard, non pertinent hors relance donc
 * absent de `vars` dans ce cas). Une variable absente de `vars` (ou non
 * reconnue) est laissée telle quelle plutôt que de faire planter le rendu —
 * un texte d'email custom mal formé ne doit jamais bloquer un envoi.
 */
export type EmailVariableName =
  | "client"
  | "numero"
  | "total"
  | "lien"
  | "echeance"
  | "jours_retard";

export type EmailVariables = Partial<Record<EmailVariableName, string>>;

const VARIABLE_PATTERN = /\{(client|numero|total|lien|echeance|jours_retard)\}/g;

export function renderEmailVariables(text: string, vars: EmailVariables): string {
  return text.replace(VARIABLE_PATTERN, (match, name: EmailVariableName) => {
    return vars[name] ?? match;
  });
}
