# Story 19 — Dashboard

**PR** : `story/19-dashboard` · **Dépend de** : 15 (18 souhaitable pour des agrégats justes) · **Écrans** : E-06

## Objectif
Dashboard réel : 4 StatCards, bar chart CA 12 mois, listes retard / derniers devis / activité récente.

## Étapes
1. `modules/dashboard/queries.ts` — une requête agrégée par bloc (SQL via drizzle, pas de N+1) :
   - `encaisseAnnee` : Σ payments année civile courante (moins remboursements si existants) ; variation vs N−1.
   - `enAttente` : Σ restes dus factures émises non échues ; `enRetard` : Σ restes dus échus (+ count).
   - `devisEnCours` : count statut sent/viewed + Σ TTC.
   - `caParMois` : 12 derniers mois, Σ factures émises (net d'avoirs) par mois d'émission — gaps à 0.
   - `facturesEnRetard` (top 8, tri jours de retard desc), `derniersDevis` (top 6), `activiteRecente` (top 10 events toutes entités, joins pour libellés).
2. UI : StatCards (variation en badge), bar chart recharts — **lire le skill dataviz avant d'écrire le chart** (couleurs = tokens thème, axes muted, tooltip format EUR), listes en cards avec liens, timeline (réutiliser event-timeline).
3. Empty state global (aucun document) : illustration + CTA "Créer mon premier devis".
4. Perf : `Promise.all` des requêtes ; page server component, pas de fetch client.

## Fichiers touchés
`src/modules/dashboard/**`, `src/app/(app)/page.tsx` (+loading skeleton dédié), dep `recharts` (app), tests `[I]` agrégats, `e2e/dashboard.spec.ts`.

## Échecs probables + parade
- **Agrégats faux avec avoirs/brouillons** → jeu de données de test contrôlé couvrant : brouillon (exclu), émise, payée, partielle, échue, avoir partiel/total ; assertions exactes au centime.
- **Recharts en SSR** → composant chart `"use client"` avec données passées en props sérialisées ; skeleton pendant l'hydratation.
- **Timezone des mois** (facture du 31 à 23 h) → agrégation par `date_trunc('month', issued_at)` en zone Europe/Paris, cohérente avec l'affichage.

## Done
- `[I]` chaque agrégat validé au centime sur le jeu contrôlé.
- `[E]` dashboard avec seed : 4 cards renseignées, chart 12 barres, liens des listes naviguent ; empty state sur DB vierge.
- `[M]` rendu conforme au brief E-06 (dark inclus).

## Quand s'arrêter
Pas de filtres de période, pas d'export, pas de widgets configurables.
