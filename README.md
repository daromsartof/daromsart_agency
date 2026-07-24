# Daromsart Agency — Monorepo

Monorepo pnpm + Turborepo hébergeant les applications de l'agence et leurs
packages partagés (design system, domaine, infrastructure).

> Le plan de build complet vit dans [`plans/`](./plans) — commencer par
> [`plans/architecture.md`](./plans/architecture.md) et [`plans/ledger.md`](./plans/ledger.md).

## Structure

```
apps/
  invoiceflow-ai/     # SaaS de facturation (Next.js) — en construction
packages/
  config/             # @daromsart/config — tsconfig / eslint / prettier partagés
  theme/              # @daromsart/theme — tokens + preset Tailwind partagés
  ui/                 # @daromsart/ui — design system ShadCN
```

## Prérequis

- Node ≥ 20
- pnpm ≥ 9
- Docker (Postgres de dev)

## Démarrage

```bash
pnpm install
pnpm build      # typecheck de tous les packages
pnpm test       # tests unitaires (Vitest)
pnpm lint
```

Le détail par application (base de données, seed, variables d'env) sera
documenté au fil des stories (voir `plans/stories.md`).

## Emails (Daroms'Art Systems) — Resend

En dev, `RESEND_API_KEY` vide suffit : les emails sont écrits dans
`.storage/emails/*.html` au lieu d'être réellement envoyés.

En production, pour suivre la délivrabilité (délivré/ouvert/bounce) :

1. Renseigner `RESEND_API_KEY` et `EMAIL_FROM` (domaine d'envoi vérifié
   sur [resend.com](https://resend.com)).
2. Dans le dashboard Resend, section **Webhooks**, ajouter un endpoint
   pointant vers `https://<votre-domaine>/api/webhooks/resend`.
3. Activer les events `email.delivered`, `email.opened`, `email.bounced`,
   `email.complained`.
4. Copier le **signing secret** (`whsec_...`) fourni par Resend dans
   `RESEND_WEBHOOK_SECRET`.

Sans `RESEND_WEBHOOK_SECRET` configuré, le webhook refuse toute requête
(signature invalide, 401) — c'est le comportement attendu tant que
l'endpoint n'est pas branché côté Resend.

## Docker

Deux usages distincts, pensés pour monter en charge (plusieurs apps à venir) :

| Fichier                   | Rôle                                                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `docker-compose.yml`      | **Dev** : infrastructure partagée seulement (Postgres, + Adminer via `--profile tools`). Les apps tournent en local (`pnpm dev`). |
| `docker-compose.prod.yml` | **Prod-like** : construit et lance les apps en conteneur + Postgres. Référence de déploiement.                                    |
| `apps/<app>/Dockerfile`   | Image de production **par application** (une par app).                                                                            |

```bash
# Dev : lancer l'infra
pnpm docker:dev                 # Postgres sur :5432
docker compose --profile tools up -d   # + Adminer sur :8080

# Prod-like / self-hosted : builder et lancer toute la stack
cp .env.example .env
pnpm docker:prod                # build images + run (app sur :3000)

# Builder l'image d'une app seule
pnpm docker:build:invoiceflow
```

### Installation self-hosted (Windows, Linux, macOS)

`docker-compose.prod.yml` est directement utilisable pour une installation
locale/serveur privé — c'est le même fichier que la référence de déploiement
ci-dessus, aucune étape manuelle de base de données n'est nécessaire.

**Prérequis** : [Docker Desktop](https://www.docker.com/products/docker-desktop/)
(Windows/macOS) ou Docker Engine + Compose plugin (Linux). Identique sur les
trois OS — les conteneurs tournent toujours sous Linux, seul Docker change
d'implémentation selon l'hôte.

```bash
git clone <ce-dépôt>
cd daromsart_agency
cp .env.example .env
# Éditer .env : au minimum BETTER_AUTH_SECRET (openssl rand -base64 32),
# SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD (votre compte admin initial).

docker compose -f docker-compose.prod.yml up -d --build
```

Au premier démarrage du conteneur `invoiceflow-ai`, `src/instrumentation.ts`
déclenche automatiquement (voir `src/db/startup.ts`) :

1. l'application des migrations Drizzle sur une base vide (`db/startup.ts`
   utilise l'API programmatique `drizzle-orm`, pas le CLI `drizzle-kit` —
   absent de l'image de production) ;
2. la création de l'organisation + du compte administrateur définis par
   `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` — **jamais** les clients/devis/
   factures de démonstration (`pnpm db:seed`, dev uniquement).

Ces deux étapes sont idempotentes : redémarrer le conteneur (mise à jour,
`docker compose up -d --build` après un `git pull`) ne recrée rien qui existe
déjà et n'échoue jamais sur une base déjà à jour. Les fichiers uploadés
(logos, PDF générés en `STORAGE_DRIVER=fs`) persistent dans le volume nommé
`daromsart_prod_invoiceflow_storage`, indépendant du cycle de vie du
conteneur.

Application disponible sur `http://localhost:3000` (ou l'URL renseignée dans
`APP_URL`/`BETTER_AUTH_URL`).

### Dockeriser une nouvelle application

Chaque app possède son propre `Dockerfile` (build multi-étapes optimisé :
`turbo prune` pour un cache d'install minimal, sortie Next **standalone** pour
une image légère et un démarrage rapide). Pour une nouvelle app :

1. copier `apps/invoiceflow-ai/Dockerfile` dans `apps/<nouvelle-app>/` ;
2. y remplacer `@daromsart/invoiceflow-ai` et `apps/invoiceflow-ai` par les
   valeurs de la nouvelle app ;
3. activer `output: "standalone"` dans son `next.config.mjs` ;
4. ajouter un service dans `docker-compose.prod.yml` ;
5. si la nouvelle app utilise Drizzle + a besoin d'un bootstrap self-hosted
   (migrations + compte admin au premier démarrage sans étape manuelle),
   reproduire le trio `src/instrumentation.ts` + `src/db/startup.ts` +
   `src/db/bootstrap-admin.ts` de invoiceflow-ai (`experimental.instrumentationHook`
   dans `next.config.mjs`, ligne `COPY .../drizzle` dans le `Dockerfile`) ;
   sinon ignorer cette étape.

Le contexte de build est toujours la **racine du monorepo** :

```bash
docker build -f apps/<app>/Dockerfile -t daromsart/<app>:latest .
```
