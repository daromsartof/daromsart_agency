# Story 18 — Avoirs (notes de crédit)

**PR** : `story/18-credit-notes` · **Dépend de** : 15 · **Écrans** : E-11 (mode avoir), E-16 (card Avoirs), E-14 (tab)

## Objectif
Corriger/annuler une facture émise via un avoir (`kind=credit_note`) : lignes inversées, séquence AV, PDF distinct, annulation du parent si avoir total (H7).

## Étapes
1. `modules/invoices/actions.ts` : `createCreditNoteDraft(parentInvoiceId)` — garde : parent émis, non cancelled ; draft `kind=credit_note`, `parent_invoice_id`, lignes copiées avec quantités **négatives** (éditables en draft — avoir partiel possible), même client/template ; garde d'édition : total avoir cumulé (avoirs émis + ce draft) ≥ −(total parent) i.e. |Σ avoirs| ≤ total parent, revérifiée à l'émission.
2. Émission : séquence `credit_note` (format AV H6) ; à l'émission, si Σ avoirs émis == total parent → parent `cancelled` + event `cancelled` (transition core à ajouter) ; sinon event `credit_note_created` seulement.
3. Totaux négatifs : `computeDocumentTotals` doit accepter les quantités négatives (vérifier core, ajouter tests) ; TVA négative par taux.
4. PDF : en-tête "AVOIR", référence "Annule et remplace partiellement/totalement la facture FAC-…", montants négatifs entre parenthèses ou signe explicite, pas de QR paiement (fait en 13), pas d'échéance.
5. UI : bouton "Créer un avoir" sur détail facture émise ; bannière warning dans l'éditeur (E-11) ; card "Avoirs" sur le parent (liste + total avoiré) ; bannière danger "Annulée par AV-…" si cancelled ; tab "Avoirs" de la liste (kind filter) ; badge outline "Avoir" partout où le numéro apparaît.
6. Encaissements : `recordPayment` sur un avoir = remboursement (montant négatif interdit — on enregistre un paiement positif sur montant absolu ? **Décision simple** : paiements interdits sur les avoirs V1 ; le remboursement se suit hors outil — noter au ledger).

## Fichiers touchés
`src/modules/invoices/actions.ts`, `packages/core/src/{totals.ts,status.ts}` (+tests), `packages/pdf/src/**` (variante avoir), détail/liste factures, éditeur (bannière), `plans/ledger.md` (maj décision remboursements), tests `[I]`, `e2e/credit-notes.spec.ts`.

## Échecs probables + parade
- **Avoir sur avoir** → garde : parent doit être `kind=invoice`.
- **Cumul d'avoirs dépassant le parent** (2 avoirs concurrents) → vérification du cumul DANS la transaction d'émission avec verrou sur le parent.
- **Stats/dashboard qui comptent les avoirs en positif** → toutes les agrégations (client stats, mini-stats liste) : CA = factures − |avoirs| ; vérifier et tester (le dashboard story 19 s'appuiera dessus).
- **Numérotation : avoir dans la séquence des factures** → séquence distincte `credit_note`, test dédié.

## Done
- `[U]` totaux négatifs ; transitions cancelled. `[I]` avoir total → parent cancelled ; partiel → parent inchangé + cumul borné ; avoir sur brouillon/avoir refusé ; séquence AV indépendante.
- `[E]` facture émise → Créer un avoir → éditeur pré-rempli négatif → émettre → parent affiche la card Avoirs (et "Annulée" si total) ; PDF "AVOIR" correct `[M]`.
- Stats client re-testées avec avoirs.

## Quand s'arrêter
Pas de remboursements trackés (décision ci-dessus), pas de refacturation automatique après annulation.
