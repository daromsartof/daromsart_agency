# Story 04 — Paramètres entreprise + storage logo

**PR** : `story/04-org-settings-storage` · **Dépend de** : 03 · **Écrans** : E-20

## Objectif
Page Paramètres > Entreprise complète (identité, adresse, banque, mentions, logo) + package `@daromsart/storage` (fs/s3). Guard admin sur `parametres/*`.

## Étapes
1. `packages/storage` : interface `Storage { put, getSignedUrl, delete }` ; driver `fs` (écrit sous `.storage/`, URLs servies par une route app `api/storage/[...key]` en dev) ; driver `s3` (`@aws-sdk/client-s3` + presigner, endpoint configurable pour R2) ; `createStorage(env)` choisit via `STORAGE_DRIVER`.
2. Layout `parametres/layout.tsx` : sous-nav verticale (Entreprise, Facturation, Emails, Équipe, Mon compte — liens inactifs "bientôt" sauf Entreprise) + `requireAdmin()`.
3. `modules/organization/` : `queries.ts` (getOrg), `actions.ts` (updateIdentity, updateAddress, updateBank, updateLegalFooter, uploadLogo, deleteLogo — zod strict, validation IBAN (mod-97) et BIC (regex) dans `@daromsart/core`), `schemas.ts`.
4. Page E-20 : cards par section, save par card, dropzone logo (input file, taille ≤ 2 Mo, png/svg/jpg, aperçu), toasts succès/erreur.
5. Défauts H21 déjà seedés (story 03) — vérifier et compléter le seed si besoin.

## Fichiers touchés
`packages/storage/src/**`, `packages/core/src/{iban.ts,index.ts}` (+tests), `apps/…/src/app/(app)/parametres/{layout.tsx,entreprise/page.tsx}`, `src/app/api/storage/[...key]/route.ts` (dev fs), `src/modules/organization/**`, `.env.example` (STORAGE_*), `e2e/settings.spec.ts`.

## Échecs probables + parade
- **Upload > body limit server action** → limiter à 2 Mo côté client ET vérifier côté serveur ; si blocage Next, passer par une route handler `POST api/storage/logo`.
- **URLs signées fs en dev** → le driver fs retourne simplement `/api/storage/{key}` ; ne pas sur-ingénierer la signature en dev.
- **IBAN avec espaces** → normaliser (strip espaces, upper) avant validation mod-97 ; tests : IBAN FR valide, invalide (checksum), vide accepté (champ optionnel).

## Done
- `[I]` chaque action persiste et revalide ; champs invalides → erreurs zod mappées.
- `[I]` uploadLogo → `logo_key` en DB, fichier lisible via URL ; deleteLogo nettoie.
- `[U]` IBAN mod-97 (3 valides, 3 invalides), BIC. `[E]` admin édite et voit la persistance après reload ; `[M]` driver s3 relu (revue de code) — testé réellement hors scope.
- `[E]` un user `member` (créé à la main dans le test) → redirect hors `/parametres`.

## Quand s'arrêter
Pas de pages Facturation/Emails/Équipe/Compte (stories 21/22). Le logo n'apparaît sur aucun PDF encore (story 08).
