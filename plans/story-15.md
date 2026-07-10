# Story 15 — Paiements

**PR** : `story/15-payments` · **Dépend de** : 12 · **Écrans** : E-17, E-16 (encart complet)

## Objectif
Enregistrer les paiements, piloter `partially_paid`/`paid`, encart Paiement complet sur le détail facture, montants agrégés fiables partout.

## Étapes
1. `modules/invoices/payments.ts` : `recordPayment(invoiceId, {dateCents…})` — transaction : facture émise requise (ni draft ni cancelled), montant > 0 et ≤ reste dû → insert Payment → recalcul `amount_paid_cents` (somme SQL, pas d'incrément aveugle) → transition statut via core (`partially_paid` | `paid` + `paid_at`) → event. `deletePayment(id)` (admin) : recalcul complet + éventuel retour de statut (`paid→partially_paid→sent/issued`) + event.
2. Machine à états core : vérifier que les retours arrière liés aux paiements sont autorisés explicitement (`paid→partially_paid` via deletePayment uniquement) — ajuster `canTransition` + tests.
3. UI E-16 : card Paiement (reste dû grand, Progress, liste des paiements avec moyen en badge, suppression admin avec ConfirmDialog), Dialog E-17 (MoneyInput pré-rempli reste dû, garde > reste dû bloquante, date défaut aujourd'hui, moyens).
4. Liste factures : action rapide "Enregistrer un paiement" (menu ⋯) ; colonnes Reste dû désormais réelles ; page publique facture : reste dû réel.
5. Fiche client stats : vérifier qu'elles utilisent `amount_paid_cents` (déjà le cas depuis 12 — sinon corriger).

## Fichiers touchés
`src/modules/invoices/payments.ts` (+ actions), `packages/core/src/status.ts` (+tests), `src/modules/invoices/components/{payment-card.tsx,payment-dialog.tsx}`, détail/liste factures, tests `[I]`, `e2e/payments.spec.ts`.

## Échecs probables + parade
- **Paiements concurrents dépassant le total** → transaction + re-lecture du reste dû `FOR UPDATE` sur la facture ; test `[I]` : 2 paiements simultanés de 100 % → un seul passe.
- **Incrément dénormalisé qui dérive** → TOUJOURS recalculer par somme SQL dans la transaction.
- **Montants négatifs/zéro** → zod `positive()` ; avoirs : paiement sur un avoir = enregistrement du remboursement, autorisé (montant ≤ |total|) — noter, tests en 18.

## Done
- `[I]` partiel → partially_paid ; solde → paid + paid_at ; > reste dû rejeté ; sur draft rejeté ; deletePayment → statut recalculé ; concurrence.
- `[E]` enregistrer un paiement partiel puis soldant → Progress bar, badge "Payée", toast ; liste "En retard" ne contient plus la facture soldée.

## Quand s'arrêter
Pas de rapprochement bancaire, pas d'export comptable, pas de multi-devise. Pas de relance (16).
