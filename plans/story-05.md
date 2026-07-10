# Story 05 — Clients : liste + CRUD

**PR** : `story/05-clients-crud` · **Dépend de** : 03 · **Écrans** : E-07, E-08

## Objectif
Gestion clients complète : liste (recherche, pagination, archivés), création/édition en Sheet, contacts additionnels, archivage.

## Étapes
1. Schéma : `src/db/schema/clients.ts` — `clients`, `client_contacts` (architecture §2.2). Migration + seed : 8 clients variés (sociétés/particuliers, avec/sans contacts).
2. `packages/core` : zod `clientSchema` (type, nom requis, email format, CP FR 5 chiffres si pays France, contacts array).
3. `modules/clients/` : `queries.ts` (liste paginée + recherche insensible accents/casse sur nom+email, filtre archivés ; getById avec contacts), `actions.ts` (create, update — remplace les contacts par diff, archive, unarchive ; toutes vérifient session+org), `components/` : `ClientForm` (RHF + zod, sections, useFieldArray contacts), `ClientsTable` (DataTable, colonnes E-07 — colonnes CA/encours rendues "—" tant que story 12 non faite : prévoir les colonnes, valeurs optionnelles), `ClientSheet` (création/édition, ouvert par querystate `?edit=id` ou état local).
4. Page `/clients` : PageHeader + bouton, toolbar (recherche débouncée via searchParams, switch archivés), table, pagination serveur (searchParams `page`, `q`, `archives`).
5. Archivage : `ConfirmDialog` ; pas de suppression physique (le bouton "Supprimer" n'existe pas — archiver seulement, décision définitive, cf. ledger).

## Fichiers touchés
`src/db/schema/clients.ts`, `src/db/seed.ts` (maj), `packages/core/src/schemas/client.ts` (+tests), `src/modules/clients/**`, `src/app/(app)/clients/page.tsx`, `src/app/(app)/clients/loading.tsx`, `e2e/clients.spec.ts`, tests `[I]` `src/modules/clients/actions.test.ts`.

## Échecs probables + parade
- **Recherche accents** (é vs e) → `unaccent` Postgres si dispo, sinon `ilike` simple + normalisation colonne dédiée ; choisir `ilike` simple V1 (noter la limite en commentaire).
- **useFieldArray contacts : pertes de focus** → keys stables (`field.id`), pas l'index.
- **Pagination + recherche** : reset page à 1 quand `q` change (sinon page vide) — géré dans le composant toolbar.
- **Concurrence Sheet création/édition** : un seul Sheet piloté par état `{mode, clientId?}`.

## Done
- `[I]` create (avec 2 contacts) / update (ajout+suppression contact) / archive / unarchive.
- `[E]` créer un client depuis la liste → visible sans reload ; recherche "dupont" filtre ; switch archivés inclut l'archivé.
- `[I]` action avec org d'un autre user → refus. `[U]` clientSchema (5 cas).
- Skeleton + EmptyState présents.

## Quand s'arrêter
Pas de fiche client (story 06), pas de stats CA/encours réelles (story 12 les branchera), pas d'import CSV (hors scope V1).
