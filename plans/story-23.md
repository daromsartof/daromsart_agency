# Story 23 — Durcissement final

**PR** : `story/23-hardening` · **Dépend de** : toutes · **Écrans** : tous (états transverses)

## Objectif
Passe de finition production : états UI complets, seed démo riche, suite e2e smoke, audit d'accès, README. C'est une story de VÉRIFICATION systématique, pas de nouvelles features.

## Étapes
1. **Grille écrans** : parcourir `ecrans.md` E-01→E-27 ; pour chaque écran vérifier/créer : `loading.tsx` (skeleton fidèle), EmptyState avec CTA, gestion d'erreur (error.tsx segment ou toast), 404 par entité, responsive mobile. Cocher la grille dans la description de PR.
2. **Audit d'accès** : revue de TOUTES les actions/queries : session requise, filtre organization_id, rôle. Test `[I]` de fuzz : pour chaque action, appel avec un id d'une autre org (fixture 2e org créée à la main en DB) → refus/notFound systématique. Vérifier les routes PDF (session/token) et storage.
3. **Seed démo** (`db:seed -- --demo`) : 30 clients, 2 modèles +, ~40 devis et ~60 factures répartis sur 14 mois, tous statuts représentés (signés, refusés, expirés, convertis, payées, partielles, échues, avoirs), paiements, EmailLogs variés → dashboard et listes réalistes.
4. **Suite e2e smoke** (`e2e/smoke.spec.ts`, DB dédiée reset avant run) : login → créer client → créer devis 3 lignes → émettre + envoyer (mode dev email fichier) → ouvrir lien public → signer → convertir en facture → émettre → envoyer → paiement partiel puis solde → vérifier dashboard non vide. Un seul test long, stable, sans dépendance réseau.
5. **README racine** : prérequis, `docker compose up -d`, `pnpm install`, `cp .env.example .env`, `pnpm db:push && pnpm db:seed`, `pnpm dev`, scripts, structure du monorepo (renvoi vers plans/architecture.md), déploiement (env prod, `STORAGE_DRIVER=s3`, webhook Resend).
6. **Nettoyage** : TODO restants triés (fait / reporté au ledger), `console.log` supprimés, deps inutilisées (`pnpm dlx knip` indicatif), `pnpm build` sans warning bloquant.

## Fichiers touchés
Transverse : `loading/error/not-found` manquants, `src/db/seed.ts` (mode demo), `e2e/smoke.spec.ts`, `tests/authz-fuzz.test.ts`, `README.md`, ajustements mineurs partout (PAS de refactor structurel).

## Échecs probables + parade
- **Tentation de refactorer** → interdit ici : toute anomalie structurelle découverte = issue notée dans la PR, pas de chantier.
- **e2e flaky** (PDF iframe, emails) → asserts sur les données/DOM, pas sur le rendu PDF ; mode email fichier ; timeouts généreux mais bornés.
- **Seed lent** → insertions par batch, un seul round-trip par table.

## Done
- Grille écrans 100 % cochée ; fuzz authz vert ; smoke vert 3 exécutions consécutives ; `pnpm build && pnpm test && pnpm e2e` verts à la racine sur DB fraîche ; README suivi à la lettre sur un clone propre `[M]`.

## Quand s'arrêter
Le produit est livrable. Toute idée nouvelle (Stripe, exports, relances auto, multi-org, i18n) = backlog dans `plans/ledger.md`, pas de code.
