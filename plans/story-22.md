# Story 22 — Paramètres : facturation, emails, mon compte

**PR** : `story/22-settings-billing-emails-account` · **Dépend de** : 08, 10 · **Écrans** : E-21, E-22, E-24

## Objectif
Compléter les paramètres : numérotation configurable, TVA (dont franchise 293 B), délais par défaut, textes d'emails, page Mon compte (accessible member).

## Étapes
1. `packages/core/numbering.ts` : `validateNumberFormat(format)` (tokens autorisés `{YYYY}|{YY}|{seq:n}` n∈2..6, `{seq}` requis exactement une fois, longueur ≤ 40) + `previewNextNumber(format, seq)` — tests.
2. Page `/parametres/facturation` (E-21) : formats ×3 avec aperçu live (lit `number_sequences` courant + 1), warning si modification alors que la séquence de l'année a démarré ; TVA : checkboxes des taux actifs (au moins un), select défaut (∈ actifs), switch franchise 293 B → force défaut 0 % + ajoute la mention au footer légal (composition, pas d'écrasement du texte custom) ; délais (paiement, validité devis).
3. Effets : nouveaux documents utilisent les nouveaux défauts (délais, TVA défaut sur nouvelle ligne, franchise) ; l'émission utilise le format courant. Tests `[I]`.
4. Page `/parametres/emails` (E-22) : reply-to (validation email), 3 blocs objets/corps avec chips de variables (insertion au curseur — composant `variable-textarea`), reset défaut, aperçu repliable (rendu des variables avec valeurs factices).
5. Page `/parametres/compte` (E-24) : **hors guard admin** (déplacer la route ou exempter dans le layout) ; nom (update), email lecture seule, changement de mot de passe via Better Auth (`changePassword` avec mot de passe actuel), radio-cards thème (next-themes).
6. Sous-nav paramètres : tout est actif désormais ; visibilité pour member = Compte uniquement.

## Fichiers touchés
`packages/core/src/numbering.ts` (+tests), `src/app/(app)/parametres/{facturation,emails,compte}/page.tsx` + layout (exemption compte), `src/modules/organization/**` (actions), composant `variable-textarea.tsx`, `src/modules/auth/` (changePassword action), tests `[I]`, `e2e/settings.spec.ts` (maj).

## Échecs probables + parade
- **Format sans `{seq}`** → collision garantie : validation bloquante testée.
- **Changement de format en cours d'année** → autorisé (la séquence continue), warning UI ; unicité garantie par (org, kind, year, seq) pas par le libellé — vérifier que le numéro **formaté** n'a pas de contrainte unique bloquante (sinon la retirer au profit du tuple).
- **Franchise activée avec documents existants** → n'affecte QUE les nouveaux documents ; les émis sont immuables (rien à faire).
- **changePassword sans vérif du mot de passe actuel** → utiliser l'API Better Auth qui l'exige.

## Done
- `[U]` validateNumberFormat (valides/invalides) + preview. `[I]` franchise → nouveau devis : lignes à 0 %, mention présente sur le PDF ; texte email custom utilisé à l'envoi suivant ; délais appliqués aux nouvelles créations.
- `[E]` member accède à Compte mais pas aux autres pages ; changement de mot de passe → logout/login avec le nouveau.

## Quand s'arrêter
Pas de numérotation par client/projet, pas de signature d'email HTML riche, pas de 2FA (hors scope V1).
