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
