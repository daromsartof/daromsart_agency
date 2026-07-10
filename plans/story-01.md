# Story 01 — Scaffold monorepo + packages fondation

**PR** : `story/01-monorepo-scaffold` · **Dépend de** : rien · **Écrans** : aucun

## Objectif
Monorepo pnpm + Turborepo opérationnel avec `@daromsart/config`, `@daromsart/theme`, `@daromsart/ui`. Aucune app encore (story 02) — mais tout doit builder/linter.

## Étapes
1. Racine : `package.json` (private, scripts `dev/build/lint/test` via turbo, `packageManager: pnpm`), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `turbo.json` (build depends `^build`, outputs `.next/**`, `dist/**` ; test depends build), `.gitignore` (node_modules, .next, .env, .storage, .turbo), `.env.example` complet (voir architecture §6), `docker-compose.yml` (postgres:16, port 5432, volume nommé).
2. `packages/config` : `tsconfig.base.json` (strict, moduleResolution bundler, paths vides), config eslint partagée (flat), `.prettierrc` partagé. Export via `exports` du package.json.
3. `packages/theme` : `src/tokens.css` (variables ShadCN light + `.dark`, palette ledger H17/brief), `src/tailwind-preset.ts` (darkMode class, colors mappées sur `hsl(var(--…))`, radius, keyframes accordion, fontFamily Inter), `src/index.ts`.
4. `packages/ui` : init ShadCN manuel (pas de CLI interactive) — `components.json`, `src/lib/utils.ts` (cn), génération des composants listés dans architecture §1.1 (copier depuis le registre shadcn "new-york"), + composés : `DataTable` (tanstack : tri, pagination, état vide intégré), `PageHeader`, `EmptyState`, `StatCard`, `StatusBadge` (map statut→variante, labels FR), `MoneyInput` (saisie FR "1 234,56" ↔ centimes int), `ConfirmDialog`, `DatePicker` (Popover+Calendar, locale fr), `AppShell` (props: nav items, user, children). Dépendances : radix, tanstack-table, lucide-react, date-fns, sonner, next-themes (peer).
5. Vitest au niveau workspace (`vitest.workspace.ts`), premiers tests dans `packages/ui` et `packages/theme`.
6. README racine minimal (sera enrichi story 23).

## Fichiers touchés (créés)
`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.env.example`, `docker-compose.yml`, `vitest.workspace.ts`, `packages/config/**`, `packages/theme/src/{tokens.css,tailwind-preset.ts,index.ts}`, `packages/ui/src/components/**`, `packages/ui/src/lib/utils.ts`, `packages/ui/src/index.ts`, tests `packages/*/src/**/*.test.ts(x)`.

## Échecs probables + parade
- **CLI shadcn refuse un package sans app Next** → ne pas utiliser la CLI : copier les sources des composants depuis le registre, adapter les imports vers `../lib/utils`.
- **Tailwind ne scanne pas packages/ui depuis l'app** (symptôme différé) → documenter dans le preset : les apps doivent ajouter `../../packages/ui/src/**/*.{ts,tsx}` à `content`. Le noter en commentaire dans `tailwind-preset.ts`.
- **Turbo cache des tests flaky** → `"test": {"cache": false}` d'abord, optimiser plus tard.
- **MoneyInput et arrondis** : ne jamais manipuler des floats ; parse string → centimes int (regex), tests sur "1 234,56", "12", "0,1", vide, négatif.

## Done
- `pnpm install && pnpm build && pnpm lint && pnpm test` verts à la racine.
- `[U]` MoneyInput : ≥ 6 cas de parse/format.
- `[U]` snapshot : le preset expose primary/success/warning/destructive et `tokens.css` contient `:root` et `.dark`.

## Quand s'arrêter
Ne PAS créer l'app, ni Storybook, ni tsup/build des packages (consommation source), ni le package storage/email/pdf/qr (stories 04/10/08/13). Si un composant ShadCN manque à l'appel plus tard, il sera ajouté dans la story concernée.
