# Story 07 — Devis : éditeur + liste + moteur de totaux

**PR** : `story/07-quotes-editor` · **Dépend de** : 05 · **Écrans** : E-10, E-11 (mode devis)

## Objectif
Le cœur métier : `@daromsart/core` (Money, totaux, machine à états) totalement testé, éditeur de document complet, liste des devis, CRUD brouillons. Pas d'émission ni de PDF (story 08).

## Étapes
1. `packages/core` :
   - `money.ts` : type `Cents = number` (int), `formatEUR`, `addCents`, `mulQty(cents, qtyNumeric)` (arrondi half-up au centime).
   - `totals.ts` : `computeDocumentTotals(lines, globalDiscount)` → `{subtotal, discount, vatByRate: Record<string, Cents>, total}` — remise ligne d'abord, remise globale au prorata HT, TVA **par taux après remises**, arrondie par taux (H "règle FR", ledger #invariant 1).
   - `status.ts` : enums `QuoteStatus`/`InvoiceStatus` + `canTransition(kind, from, to)` (tables H14/H15).
   - `schemas/document.ts` : zod lignes + document draft.
   - Tests : ≥ 12 cas totaux (multi-taux, remises %/€ combinées, qté 0,333, montant 1 centime, remise > total → clamp 0), transitions valides/invalides exhaustives.
2. Schéma DB : `src/db/schema/quotes.ts` (`quotes`, `quote_lines`), `documents.ts` (`document_events`, `number_sequences` — structures créées ici, events utilisés dès maintenant pour `created/updated`).
3. `modules/documents/` (partagé) : `line-editor/` (composant tableau de lignes : useFieldArray, drag reorder — `@formkit/drag-and-drop` ou dnd-kit, MoneyInput, select TVA depuis org, remise ligne), `totals-panel.tsx` (live, délègue à core côté client pour l'affichage), `recalculate.ts` server (recalcul autoritaire), `events.ts` (addDocumentEvent).
4. `modules/quotes/` : `actions.ts` (createDraft, updateDraft — refuse si non-draft, deleteDraft, duplicate), `queries.ts` (liste paginée filtrée statut + recherche, getById avec lignes), composants liste.
5. Pages : `/devis` (E-10, tabs-filtres avec compteurs), `/devis/nouveau` (E-11 : client Command — pré-sélection via `?client=id`, activer le bouton de la fiche client), `/devis/[id]/modifier` (draft only sinon redirect), page `/devis/[id]` **minimale provisoire** (récap + bouton Modifier — remplacée story 08).
6. Fiche client : tab Devis branché (table filtrée). Seed : 6 devis brouillons variés.

## Fichiers touchés
`packages/core/src/{money.ts,totals.ts,status.ts,schemas/document.ts}` + tests, `src/db/schema/{quotes.ts,documents.ts}`, `src/modules/documents/**`, `src/modules/quotes/**`, `src/app/(app)/devis/**`, fiche client (tab), seed, `e2e/quotes.spec.ts`.

## Échecs probables + parade
- **Floats dans les totaux** → interdits : qté en numeric string→ decimal.js ? Non : qté ×1000 en int côté calcul (`mulQty` documenté), tests de non-régression sur 0,1 × 3.
- **Autosave conflictuel** → V1 : PAS d'autosave ; bouton Enregistrer explicite + garde `beforeunload` si dirty. (Le brief E-11 mentionne l'autosave : le remplacer par l'indicateur dirty — noter dans la PR.)
- **Recalcul client ≠ serveur** → le serveur recalcule TOUJOURS via core et persiste ses valeurs ; le client n'affiche qu'une prévision. Test `[I]` : payload falsifié (totaux gonflés) → valeurs serveur.
- **Drag & drop et RHF** → réordonner via `move()` de useFieldArray, position persistée = index.

## Done
- `[U]` core : totaux 12 cas + transitions. `[I]` create/update draft (recalcul serveur), update sur non-draft refusé (statut forcé en DB pour le test), delete draft.
- `[E]` créer devis 3 lignes multi-taux → panneau totaux = valeurs attendues ; réordonner ; supprimer une ligne ; sauvegarde → liste l'affiche en Brouillon.
- `[E]` tabs-filtres et recherche liste OK.

## Quand s'arrêter
Pas d'émission, numéro, PDF, envoi, statuts au-delà de draft (story 08+). Pas de choix de modèle dans l'éditeur (select présent mais vide/désactivé, branché story 09). La page détail reste minimale.
