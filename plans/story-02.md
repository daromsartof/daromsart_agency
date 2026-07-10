# Story 02 — App invoiceflow-ai + AppShell + dark mode

**PR** : `story/02-app-shell` · **Dépend de** : 01 · **Écrans** : E-05

## Objectif
App Next.js (App Router, TS) dans `apps/invoiceflow-ai`, branchée sur theme/ui, avec AppShell complet et navigation placeholder. Aucune donnée, aucune auth (story 03).

## Étapes
1. `apps/invoiceflow-ai` : `package.json` (next@latest stable, react, deps ui/theme workspace), `next.config.ts` avec `transpilePackages: ["@daromsart/ui","@daromsart/theme","@daromsart/core", …]`, `tailwind.config.ts` (`presets: [daromsartPreset]`, content = app src + `../../packages/ui/src/**`), `tsconfig.json` extends config base, `postcss.config`.
2. `src/app/layout.tsx` : import `@daromsart/theme/tokens.css` + globals, fonte Inter (`next/font`), `<ThemeProvider>` (next-themes, attribute class), `<Toaster>` sonner, lang fr.
3. Groupe `(app)/layout.tsx` : `AppShell` de `@daromsart/ui` — sidebar (Dashboard `/`, Clients, Devis, Factures, Modèles, Paramètres), topbar (titre par segment, ThemeToggle, menu avatar factice). Responsive : Sheet mobile.
4. Pages placeholder pour chaque entrée nav : `PageHeader` + `EmptyState` "Bientôt disponible".
5. Groupe `(auth)/layout.tsx` : layout centré (carte), page `/connexion` placeholder statique (formulaire non branché).
6. `error.tsx`, `not-found.tsx`, `loading.tsx` racine (skeleton du shell).
7. Playwright installé à la racine (`e2e/`), config `webServer` qui lance l'app.

## Fichiers touchés
`apps/invoiceflow-ai/{package.json,next.config.ts,tailwind.config.ts,tsconfig.json,postcss.config.mjs}`, `src/app/{layout.tsx,globals.css,error.tsx,not-found.tsx,loading.tsx}`, `src/app/(app)/{layout.tsx,page.tsx}`, `src/app/(app)/{clients,devis,factures,modeles,parametres}/page.tsx`, `src/app/(auth)/{layout.tsx,connexion/page.tsx}`, `src/components/theme-toggle.tsx`, `playwright.config.ts`, `e2e/shell.spec.ts`, `turbo.json` (pipeline e2e).

## Échecs probables + parade
- **Styles ShadCN absents** (classes purgées) → vérifier le `content` Tailwind pointe bien sur `packages/ui/src` en chemin relatif depuis l'app.
- **Hydration mismatch next-themes** → `suppressHydrationWarning` sur `<html>`, ThemeProvider `defaultTheme="system"` + `enableSystem`.
- **transpilePackages oublié** → erreur "Cannot use import outside a module" sur @daromsart/* : ajouter tous les packages consommés.

## Done
- `pnpm dev` affiche le shell complet, nav 6 entrées, chaque route rend 200.
- `[E]` e2e : visite de chaque entrée nav (titre visible) ; toggle dark → classe `dark` sur html, persiste après reload.
- `[M]` viewport 375px : sidebar en Sheet fonctionnelle. Build racine vert.

## Quand s'arrêter
Pas d'auth, pas de DB, pas de middleware, pas de contenu réel dans les pages. Le menu Paramètres pointe vers une page unique placeholder (sous-nav en story 04).
