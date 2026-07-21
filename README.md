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

## Emails (InvoiceFlow AI) — Resend

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

# Prod-like : builder et lancer toute la stack
cp .env.example .env
pnpm docker:prod                # build images + run (app sur :3000)

# Builder l'image d'une app seule
pnpm docker:build:invoiceflow
```

### Dockeriser une nouvelle application

Chaque app possède son propre `Dockerfile` (build multi-étapes optimisé :
`turbo prune` pour un cache d'install minimal, sortie Next **standalone** pour
une image légère et un démarrage rapide). Pour une nouvelle app :

1. copier `apps/invoiceflow-ai/Dockerfile` dans `apps/<nouvelle-app>/` ;
2. y remplacer `@daromsart/invoiceflow-ai` et `apps/invoiceflow-ai` par les
   valeurs de la nouvelle app ;
3. activer `output: "standalone"` dans son `next.config.mjs` ;
4. ajouter un service dans `docker-compose.prod.yml`.

Le contexte de build est toujours la **racine du monorepo** :

```bash
docker build -f apps/<app>/Dockerfile -t daromsart/<app>:latest .
```
