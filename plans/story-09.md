# Story 09 — Modèles de documents

**PR** : `story/09-templates` · **Dépend de** : 08 · **Écrans** : E-18, E-19

## Objectif
CRUD des modèles (facture/devis), éditeur split avec aperçu PDF live, application des options au rendu, sélection du modèle dans l'éditeur de document.

## Étapes
1. Schéma : `src/db/schema/templates.ts` (`document_templates`, options json — zod `templateOptionsSchema` dans core, valeurs par défaut = celles hardcodées en story 08). Migration ; seed : 2 modèles ("Classique" défaut both, "Moderne" accent différent).
2. `@daromsart/pdf` : consommer `templateOptions` du DTO (couleur accent, logo on/off + position, police sans/serif — embarquer une serif (Source Serif), colonnes conditionnelles, textes par défaut, flags QR — flags stockés mais QR rendus en story 13 : ignorer proprement ici).
3. `modules/templates/` : queries, actions (create, update, duplicate, setDefault — transaction qui dé-défaut les autres du même type, delete → refuse si référencé sinon delete réel, archive non nécessaire), composants.
4. Page `/modeles` (E-18) : grille de cards avec vignette = PDF de démo rendu en image ? **Parade simplicité** : vignette = div stylisée simulant la 1re page (couleur accent, mini-blocs) — PAS un vrai rendu PDF (coût). Noter le choix.
5. Page `/modeles/[id]` + `/modeles/nouveau` (E-19) : formulaire à gauche, aperçu à droite = iframe sur `api/templates/preview?options=…` (route qui rend un PDF avec données factices fixes + options passées, debounce 500 ms côté client via re-src). Guard admin ? **Décision : accessible member aussi** (outil interne, seuls les paramètres org sont admin).
6. Éditeur de document (story 07) : activer le select Modèle (défaut = modèle par défaut du type), persister `template_id` ; `buildQuotePdfInput` lit les options du modèle du document (fallback défaut).
7. Défauts de contenu du modèle (note intro/pied, conditions) : pré-remplissent l'éditeur à la création d'un document.

## Fichiers touchés
`src/db/schema/templates.ts`, `packages/core/src/schemas/template.ts` (+tests), `packages/pdf/src/**` (options), `src/modules/templates/**`, `src/app/(app)/modeles/**`, `src/app/api/templates/preview/route.ts`, éditeur document (select modèle), `src/modules/documents/pdf.ts`, seed, `e2e/templates.spec.ts`.

## Échecs probables + parade
- **Aperçu live trop lourd** (re-rendu PDF à chaque frappe) → debounce 500 ms + n'actualiser que sur blur/changement discret ; options sérialisées en base64 dans l'URL avec limite de taille (sinon POST + blob URL).
- **Options json non versionnées** → `templateOptionsSchema.parse` avec defaults à CHAQUE lecture (tolérance aux champs manquants futurs).
- **setDefault en course** → transaction unique `UPDATE … SET is_default=false WHERE type=…` puis set true.
- **Suppression d'un modèle référencé** → compter les références (quotes+invoices) avant delete ; UI désactive avec tooltip.

## Done
- `[I]` un seul défaut par type après setDefault concurrents ; delete référencé refusé ; duplicate copie les options.
- `[E]` créer un modèle, changer couleur/police → l'aperçu change ; le définir par défaut → nouveau devis l'utilise (select pré-rempli).
- `[I]` buildQuotePdfInput reflète les options du modèle choisi. `[U]` templateOptionsSchema defaults.

## Quand s'arrêter
Pas de rendu des QR (story 13), pas d'upload de logo par modèle (le logo est celui de l'org), pas d'éditeur WYSIWYG libre — uniquement les options structurées listées.
