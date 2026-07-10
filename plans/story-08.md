# Story 08 — Devis : émission, PDF, page détail

**PR** : `story/08-quotes-issue-pdf` · **Dépend de** : 07, 04 · **Écrans** : E-12

## Objectif
Émettre un devis (numéro séquentiel), générer son PDF A4 conforme FR (`@daromsart/pdf`), page détail complète avec aperçu et timeline.

## Étapes
1. `packages/core` : `numbering.ts` — `formatDocumentNumber(format, {year, seq})` parse les tokens `{YYYY}`, `{YY}`, `{seq:n}` (+ tests, formats invalides → erreur claire).
2. `modules/documents/numbering.ts` : `issueNumber(tx, orgId, kind, year)` — `INSERT … ON CONFLICT` + `SELECT FOR UPDATE`, incrément, retourne seq. Test de concurrence `[I]` : `Promise.all(20 émissions)`.
3. `packages/pdf` : `renderDocumentPdf(input: DocumentPdfInput)` avec `@react-pdf/renderer`. DTO sérialisable (architecture §1.1). Layout A4 : bandeau accent, logo (fetch buffer passé dans le DTO, pas d'URL), blocs émetteur/client, méta (numéro, dates), titre/objet, note intro, tableau lignes (description multiligne, colonnes conditionnelles), récap totaux (TVA par taux), note pied + mentions légales, pagination "1/2", zone signature (devis). Fonte embarquée (Inter TTF dans le package). Données 100 % venant du DTO.
4. `modules/quotes/actions.ts` : `issueQuote(id)` — transaction : vérifs (draft, ≥1 ligne, client ok) → numéro → statut `sent`… **non : décision** : émission = statut reste interne `sent` seulement après envoi ; introduire statut intermédiaire ? Ledger H14 n'a pas de `issued` pour devis → l'émission d'un devis SANS envoi le passe directement à `sent` avec `sent_at = émission` (interprétation : "émis/prêt à transmettre"). Documenter dans le code. → numéro + `share_token` (crypto 32 bytes base64url) + events.
5. `modules/documents/pdf.ts` : `buildQuotePdfInput(quoteId)` (org, client, lignes, template par défaut hardcodé V1 — options neutres, story 09 branchera les vrais modèles), route `api/documents/devis/[id]/pdf/route.ts` (session, runtime nodejs, `Content-Disposition: inline; filename="devis-DEV-….pdf"`).
6. Page `/devis/[id]` complète (E-12) : iframe PDF, panneau statut/montants/lien public (copie), actions par statut (Émettre, Modifier/Supprimer si draft, Dupliquer, Télécharger, Marquer refusé — action `markRefused` manuelle), timeline events (composant `modules/documents/components/event-timeline.tsx`).

## Fichiers touchés
`packages/core/src/numbering.ts` (+tests), `packages/pdf/src/**`, `src/modules/documents/{numbering.ts,pdf.ts,components/event-timeline.tsx}`, `src/modules/quotes/actions.ts`, `src/app/(app)/devis/[id]/page.tsx`, `src/app/api/documents/[type]/[id]/pdf/route.ts`, seed (2 devis émis), tests `[I]`/`[U]`, `e2e/quotes.spec.ts` (maj).

## Échecs probables + parade
- **Trous de numérotation en cas de rollback** → le numéro est pris DANS la même transaction que le passage de statut ; toute erreur annule tout. Test : émission qui échoue (client archivé) → séquence inchangée.
- **@react-pdf sur runtime edge** → `export const runtime = "nodejs"` sur la route ; ne jamais importer le package pdf dans un composant client.
- **Fonte manquante → glyphes carrés** → embarquer Inter (regular+bold) via `Font.register` avec chemin résolu (`import url` / fs read), test de rendu (le buffer commence par `%PDF`).
- **Logo distant dans le PDF** → passer le buffer du logo dans le DTO (lu via storage), pas d'URL réseau au rendu.
- **Textes longs** (description 20 lignes) → `wrap` activé, test manuel avec description très longue.

## Done
- `[I]` 20 émissions concurrentes → numéros 1..20 sans trou ; update après émission refusé ; suppression après émission refusée.
- `[U]` numbering tokens ; `[U]` renderDocumentPdf retourne un buffer `%PDF` avec un DTO complet.
- `[E]` créer → émettre → badge "Envoyé" + numéro + iframe PDF chargée ; copier le lien public.
- `[M]` checklist visuelle PDF dans la PR (logo, adresses, multi-taux TVA, mentions, 2 pages).

## Quand s'arrêter
Pas de modèles personnalisés (options par défaut hardcodées, story 09), pas d'envoi email (10), pas de page publique (11), pas de conversion (17). `markRefused` = action interne simple (motif optionnel), le refus par le client arrive en 11.
