# Story 06 — Fiche client

**PR** : `story/06-client-detail` · **Dépend de** : 05 · **Écrans** : E-09

## Objectif
Page `/clients/[id]` : header riche, stats (placeholders 0 € pour l'instant), tabs Informations / Activité. Les tabs Devis/Factures arrivent avec les stories 07/12 (emplacements prêts).

## Étapes
1. `modules/clients/queries.ts` : `getClientDetail(id)` (client + contacts) ; `getClientStats(id)` retourne `{caFactureCents, encoursCents, retardCents}` — implémentation V1 : zéros (TODO branché story 12 ; laisser la signature définitive).
2. Page : header (avatar initiales — util `initials()` dans ui, badges type/archivé, actions : Modifier → réutilise `ClientSheet`, Archiver, boutons "Nouveau devis"/"Nouvelle facture" désactivés avec tooltip "bientôt" tant que 07/12 absents → activer un lien `?client=id` dans les stories concernées).
3. StatCards ×3. Tabs (searchParam `tab`) : Informations (2 cards lecture : coordonnées, fiscal/facturation + contacts listés), Activité (EmptyState "Aucune activité" — branché DocumentEvent en 08+), Devis/Factures : onglets présents mais rendus `EmptyState` "disponible prochainement" (remplacés en 07/12).
4. `not-found.tsx` du segment : id inconnu ou autre org → notFound().

## Fichiers touchés
`src/app/(app)/clients/[id]/{page.tsx,loading.tsx,not-found.tsx}`, `src/modules/clients/queries.ts`, `src/modules/clients/components/client-header.tsx`, `e2e/clients.spec.ts` (maj).

## Échecs probables + parade
- **Tabs via searchParams et scroll reset** → composant Tabs contrôlé qui pousse `router.replace` avec `scroll: false`.
- **Fuite inter-org** : `getClientDetail` filtre TOUJOURS par organization_id de la session ; test `[I]` dédié.
- **Réutilisation du ClientSheet hors liste** : extraire le Sheet en composant autonome (story 05 l'a peut-être couplé à la liste — découpler ici si besoin).

## Done
- `[E]` liste → fiche → Modifier (Sheet pré-rempli) → sauvegarde → header mis à jour.
- `[E]` id inconnu → 404 propre. `[I]` client d'une autre org → notFound.
- `[I]` getClientStats retourne des zéros typés (contrat verrouillé pour story 12).

## Quand s'arrêter
Ne pas implémenter les stats réelles, ni les tabs Devis/Factures/Activité réels. Ne pas créer de route `clients/[id]/modifier` (le Sheet suffit).
