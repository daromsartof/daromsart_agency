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
services/
  python-worker/      # Worker Python (FastAPI) — modèle de référence, voir plus bas
```

`apps/` = produits Next.js (pnpm/Turborepo). `services/` = workers/services
backend non-Node (Python pour l'instant) ; ils ne font pas partie du workspace
pnpm et se gèrent avec leur propre outillage (voir « Workers Python »).

## Prérequis

- Node ≥ 20
- pnpm ≥ 9
- [uv](https://docs.astral.sh/uv/) (workers Python, voir `services/`)
- Docker (Postgres de dev, et pour lancer n'importe quelle app/worker en conteneur)

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

## Workers Python (REST API)

`services/` héberge les workers/services backend qui ne sont pas des apps
Next.js — typiquement du Python exposant une API REST (traitement lourd,
librairies ML/PDF/OCR, scripts métier, etc.). Ils sont hors du workspace
pnpm (pas de `package.json`) et se gèrent avec [uv](https://docs.astral.sh/uv/),
l'équivalent Python de pnpm : installs rapides, lockfile (`uv.lock`) reproductible.

`services/python-worker/` est le **modèle de référence** : FastAPI + uvicorn,
authentification par clé API (header `X-API-Key`, variable `WORKER_API_KEY`),
un endpoint `/health` public (sondes/healthcheck) et un endpoint d'exemple
`POST /v1/echo` protégé, à remplacer par la vraie logique métier.

### IA locale (Ollama) — 4ᵉ provider du mode agent

Le worker sert aussi de **proxy vers une IA locale** (Ollama sur GPU), utilisée
comme 4ᵉ provider LLM du mode agent — **sans clé API ni coût**. Le worker expose
`POST /v1/chat/completions` (compatible OpenAI, streaming) qui relaie vers Ollama
(`WORKER_OLLAMA_BASE_URL`, défaut `http://localhost:11434`) ; l'app Next.js pointe
son provider OpenAI sur le worker via `OLLAMA_WORKER_URL`.

```bash
# 1) Ollama (natif, accès GPU) + un modèle compatible outils (~8 Go VRAM)
ollama serve
ollama pull qwen2.5:7b        # ou llama3.1:8b

# 2) le worker (relaie vers Ollama)
pnpm start:python-worker      # écoute sur :8000

# 3) l'app : dans apps/invoiceflow-ai/.env
#    OLLAMA_WORKER_URL="http://localhost:8000"
pnpm --filter @daromsart/invoiceflow-ai dev
```

Puis, en mode agent, choisir un modèle « (local) » dans le sélecteur. Le champ
`OLLAMA_WORKER_URL` vide = provider local désactivé (il n'apparaît pas). Les
petits modèles locaux savent appeler des outils mais restent moins fiables que
Gemini/Claude sur les enchaînements complexes. Les ids de `AGENT_MODELS`
(`modules/agent/models.ts`, provider `ollama`) doivent correspondre à des
modèles réellement `ollama pull`és.

**Dev local (sans Docker)** — le plus rapide pour itérer :

```bash
cd services/python-worker
uv sync                    # installe les dépendances (voir pyproject.toml)
uv run uvicorn app.main:app --reload --port 8000
# ou depuis la racine : pnpm start:python-worker

uv run pytest               # tests            (ou : pnpm test:python-worker)
uv run ruff check .         # lint             (ou : pnpm lint:python-worker)
```

Documentation interactive générée automatiquement : `http://localhost:8000/docs`.

**Appel depuis l'intérieur ou l'extérieur de Docker** :

| Depuis…                                    | URL                            |
| ------------------------------------------- | ------------------------------- |
| un autre conteneur du même réseau compose   | `http://python-worker:8000`     |
| l'hôte / une autre app en dehors de Docker  | `http://localhost:8000`         |

Le port `8000` est publié dans les deux fichiers compose (`docker-compose.yml`
sous le profil `--profile workers`, `docker-compose.prod.yml` toujours actif) —
c'est la même image, appelable indifféremment par son nom de service en interne
ou par le port publié en externe. Sans authentification par défaut en dev
(`WORKER_API_KEY` vide) ; toujours la renseigner en production.

```bash
# Lancer le worker conteneurisé en dev (optionnel, sinon `uv run` suffit)
docker compose --profile workers up -d --build

curl http://localhost:8000/health
curl -X POST http://localhost:8000/v1/echo \
  -H "Content-Type: application/json" -H "X-API-Key: $WORKER_API_KEY" \
  -d '{"message": "bonjour"}'
```

### Créer un nouveau worker Python

1. dupliquer `services/python-worker/` vers `services/<nouveau-worker>/` ;
2. renommer `name` dans `pyproject.toml`, adapter `app/main.py` et les routers ;
3. depuis `services/<nouveau-worker>/` : `rm uv.lock && uv sync` (régénère le
   lockfile pour ce worker) ;
4. le `Dockerfile` copié n'a besoin d'aucune modification (il lit son propre
   chemin via `PROJECT_PATH`, déjà correct après la copie) ;
5. ajouter un service dans `docker-compose.yml` (profil `workers`) et
   `docker-compose.prod.yml`, avec un port hôte différent de ceux déjà pris ;
6. si d'autres apps du monorepo doivent l'appeler, leur passer son URL via une
   variable d'env (interne : `http://<nom-du-service>:<port>`).
