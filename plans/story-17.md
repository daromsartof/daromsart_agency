# Story 17 — Conversion devis → facture

**PR** : `story/17-quote-to-invoice` · **Dépend de** : 12, 11 · **Écrans** : E-12 (action), E-11 (bannière origine)

## Objectif
Convertir un devis signé (ou envoyé, avec confirmation) en facture brouillon pré-remplie ; liens croisés ; devis `invoiced` quand la facture est émise.

## Étapes
1. `modules/quotes/actions.ts` : `convertToInvoice(quoteId)` — garde : statut ∈ `signed` (direct) ou `sent/viewed` (le client confirme via ConfirmDialog côté UI ; l'action reçoit `force: true`) ; refus si `invoice_id` déjà présent. Transaction : créer facture draft (client, template, lignes copiées avec positions, remise globale, notes ; date émission = jour, échéance = jour + délai client/org) + `quote_id` sur la facture + `invoice_id` sur le devis + events des deux côtés (`converted`).
2. `issueInvoice` (story 12) : si `quote_id` → passer le devis à `invoiced` (transition core à ajouter H14) + event.
3. UI : bouton "Convertir en facture" sur détail devis (primaire si signé) → redirige vers `/factures/[newId]/modifier` avec bannière "Créée depuis le devis DEV-…" (lien) ; détail devis : card "Facturation" (lien facture, statut) ; détail facture : card "Origine".
4. Suppression du brouillon de facture issu d'une conversion → dé-lier le devis (`invoice_id = null`, event) pour permettre une nouvelle conversion.

## Fichiers touchés
`src/modules/quotes/actions.ts`, `src/modules/invoices/actions.ts` (issue + deleteDraft), `packages/core/src/status.ts` (+tests `invoiced`), détails devis/facture (cards + bannières), éditeur facture (bannière), tests `[I]`, `e2e/convert.spec.ts`.

## Échecs probables + parade
- **Double conversion concurrente** → re-lecture `FOR UPDATE` du devis dans la transaction ; unique partiel sur `quotes.invoice_id` inutile (nullable) — le verrou suffit ; test concurrence.
- **Copie divergente** (totaux ≠) → test : totaux facture === totaux devis au centime.
- **Devis expiré converti** → autorisé avec `force` (décision : l'interne reste maître) — documenter.

## Done
- `[I]` conversion signée : copie intégrale, liens croisés, events ; double conversion refusée ; suppression du draft → dé-liaison ; émission facture → devis `invoiced`.
- `[E]` devis signé → Convertir → éditeur pré-rempli identique → Émettre → détail devis badge "Facturé" + lien facture.

## Quand s'arrêter
Pas de facturation partielle/acompte (hors scope V1 — noter au ledger si demandé plus tard), pas de conversion multiple.
