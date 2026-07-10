# Story 14 — Envoi facture par email + page publique facture

**PR** : `story/14-invoice-email-public` · **Dépend de** : 12, 10 (13 souhaitable pour le bloc virement) · **Écrans** : E-13 (facture), E-26, E-29

## Objectif
Envoyer les factures par email (dialog générique de la story 10), page publique `/p/factures/[token]` avec bloc virement (IBAN + QR EPC), marquage viewed.

## Étapes
1. `modules/emails/sendDocument.ts` : brancher kind=invoice (émission auto si draft → `issueInvoice`, template E-29 avec échéance, statut `issued→sent`). Textes org par défaut facture (seed déjà présent).
2. Boutons Envoyer/Renvoyer sur détail + liste factures (mêmes composants que devis).
3. Page `/p/factures/[token]` (E-26) : résumé (total, échéance, badge retard, reste dû si partiel — 0 partout tant que story 15 absente : afficher reste dû = total si non payée, champ `amount_paid_cents` existe déjà), iframe PDF public, Télécharger, bloc "Régler par virement" si IBAN : IBAN formaté + copier, BIC, référence = numéro, QR EPC (composant `qr` → dataURL, montant = reste dû). État payée : bannière succès. Token invalide → E-27. `markViewed` (statut `sent→viewed`).
4. Route PDF public : étendre `api/p/[type]/[token]/pdf` au type factures.

## Fichiers touchés
`src/modules/emails/**`, `packages/email/src/templates/invoice-email.tsx`, `src/app/p/factures/[token]/page.tsx`, `src/app/api/p/[type]/[token]/pdf/route.ts`, détail/liste factures (boutons), tests `[I]`, `e2e/invoices-send.spec.ts`.

## Échecs probables + parade
- **QR EPC côté page web** : montant = reste dû au moment du rendu (pas du cache) → `dynamic = "force-dynamic"` sur la page publique.
- **Dialog d'envoi couplé aux devis** (si le refactor 12 a fui) → le rendre paramétré proprement, tests devis inchangés.
- **Facture brouillon partagée** → un brouillon n'a pas de token ; garde : page publique ne matche que les documents émis.

## Done
- `[I]` envoi facture : émission auto si draft, EmailLog, statut sent, event ; `[I]` markViewed idempotent.
- `[E]` envoyer une facture → ouvrir le lien public anonyme → total/échéance affichés, PDF téléchargeable, bloc IBAN + QR visible ; interne : badge "Vue".
- `[I]` facture payée (forcer en DB) → bannière "réglée", pas de bloc virement.

## Quand s'arrêter
Pas de paiement en ligne (Stripe = hors scope V1, ledger), pas de relance (16), pas de webhook (20).
