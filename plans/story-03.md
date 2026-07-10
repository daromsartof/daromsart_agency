# Story 03 — Base de données + Better Auth

**PR** : `story/03-db-auth` · **Dépend de** : 02 · **Écrans** : E-01, E-02, E-03, E-33

## Objectif
Postgres + Drizzle en place ; Better Auth (email/password, signup public désactivé) ; pages connexion / mot de passe oublié / reset ; protection de `(app)` ; seed org + admin.

## Étapes
1. Deps app : `drizzle-orm`, `postgres`, `drizzle-kit`, `better-auth`. `src/lib/env.ts` : parsing zod de TOUTES les env (fail fast au boot).
2. `src/db/schema/auth.ts` : tables Better Auth via son adaptateur Drizzle (user, session, account, verification — suivre la doc Better Auth/Drizzle). `src/db/schema/organization.ts` : `organizations` (tous champs architecture §2.2, defaults FR H21), `memberships`, `invitations` (structure seulement, flux en story 21). `src/db/index.ts` : client postgres-js + drizzle. Scripts app : `db:generate`, `db:migrate`, `db:push`, `db:studio`, `db:seed` (exposés à la racine via turbo).
3. `packages/auth` : `createAuth({ db, schema, secret, baseUrl, sendEmail })` → Better Auth avec emailAndPassword (signup désactivé : `disableSignUp: true`), reset password (envoi via callback `sendEmail` injecté — cette story : log console en dev + TODO Resend branché en story 10, **hypothèse ledger H12 : acceptable temporairement, l'email réel de reset arrive avec le package email**).
4. App `src/modules/auth/` : instance `auth.ts` (server), `client.ts` (createAuthClient), helpers `requireSession()` / `requireAdmin()` (lisent session + membership, redirect sinon), route `api/auth/[...all]/route.ts`.
5. Pages (auth) réelles : connexion (react-hook-form + zod, erreurs inline), mot-de-passe-oublie, reinitialiser/[token]. `middleware.ts` : cookie de session absent sur `(app)` → redirect `/connexion` (vérification forte dans les layouts server).
6. Menu avatar réel (nom, Déconnexion). `src/db/seed.ts` : org "Daromsart" (valeurs plausibles complètes, IBAN de test) + user admin depuis `SEED_ADMIN_EMAIL/PASSWORD` + membership admin.
7. DB de test : `TEST_DATABASE_URL` + helper `tests/db.ts` (migrate + truncate entre tests) pour les tests `[I]` de toutes les stories suivantes.

## Fichiers touchés
`packages/auth/src/**`, `apps/invoiceflow-ai/src/{lib/env.ts,db/**,modules/auth/**,middleware.ts}`, `src/app/api/auth/[...all]/route.ts`, pages `(auth)/**`, `(app)/layout.tsx` (requireSession), `drizzle.config.ts`, `.env.example` (maj), `tests/db.ts`, `e2e/auth.spec.ts`.

## Échecs probables + parade
- **Divergence schéma Better Auth ↔ Drizzle** (noms de colonnes) → générer le schéma avec `npx @better-auth/cli generate` puis l'adapter, ne pas l'écrire de tête.
- **Middleware edge sans accès DB** → le middleware ne vérifie QUE la présence du cookie ; la vraie validation de session est dans le layout server `(app)`. Ne pas importer drizzle dans middleware.
- **Seed non idempotent** → upsert par email/nom (relançable à volonté).
- **Signup désactivé bloque le seed** → créer l'admin via l'API server de Better Auth (`auth.api.signUpEmail` interne) ou insertion directe hashée par les utilitaires Better Auth.

## Done
- `[E]` login seed → `/` ; mauvais mot de passe → message d'erreur ; logout → retour connexion.
- `[E]` accès `/clients` sans session → redirect `/connexion`.
- `[I]` reset password : token valide change le mdp, token réutilisé refusé.
- `[U]` env.ts : var manquante → throw explicite. `db:push` + `db:seed` documentés dans le README.

## Quand s'arrêter
Pas d'invitations (story 21), pas d'email réel (story 10), pas de page compte (story 22). Rôle `member` : helper prêt mais aucun écran ne le gère encore.
