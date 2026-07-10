# Story 12 — Factures : éditeur, liste, émission, PDF, détail

**PR** : `story/12-invoices` · **Dépend de** : 08 · **Écrans** : E-14, E-11 (mode facture), E-16 (sans paiements)

## Objectif
Cycle facture complet jusqu'à l'émission : réutiliser massivement `modules/documents` (éditeur, numérotation, PDF, events). Spécificités : échéance, snapshot, statut `issued`, kind (avoir prévu, actif en 18).

## Étapes
1. Schéma : `src/db/schema/invoices.ts` (`invoices`, `invoice_lines`, champs §2.2 dont `kind`, `parent_invoice_id`, snapshots json, `amount_paid_cents` default 0). `payments` : créé ici (structure), utilisé en 15.
2. Généraliser `modules/documents` si la story 07/08 a du code spécifique devis : l'éditeur, le line-editor, le totals-panel, send-dialog, numbering, pdf-input builder deviennent paramétrés par `kind: "quote" | "invoice"`. **Refactor autorisé mais sans changement de comportement devis (tests 07/08 doivent rester verts).**
3. `modules/invoices/` : actions (createDraft — aussi depuis `?client=`, updateDraft, deleteDraft, duplicate, `issueInvoice` : transaction = vérifs → snapshot org+client (json figé) → numéro séquence `invoice` → statut `issued` → share_token → event), queries (liste + filtres dont `overdue` calculé en SQL : `due_date < now AND total-paid > 0 AND status ∈ issued/sent/viewed/partially_paid`).
4. `@daromsart/pdf` : variante facture (mention "FACTURE", échéance, conditions de paiement, IBAN/BIC affichés, pas de zone signature). Le DTO utilise les **snapshots** pour émetteur/client si émise.
5. Pages : `/factures` (E-14 : mini-StatCards — encours/retard/encaissé mois = requêtes agrégées, tabs-filtres dont "En retard" et "Avoirs" (vide)), `/factures/nouvelle` (+ `?client=`), `/factures/[id]/modifier`, `/factures/[id]` (E-16 sans encart paiements — carte "Paiement" placeholder "disponible prochainement").
6. Fiche client : tab Factures + `getClientStats` **réel** (CA facturé = Σ factures émises non annulées − avoirs ; encours = Σ restes dus ; retard = Σ restes dus échus). Dashboard non touché (story 19).
7. Seed : 10 factures variées (brouillons, émises, échues).

## Fichiers touchés
`src/db/schema/invoices.ts`, refactor `src/modules/documents/**`, `src/modules/invoices/**`, `packages/pdf/src/**` (variante), `src/app/(app)/factures/**`, fiche client (tab + stats), `src/modules/clients/queries.ts`, route pdf `[type]` (accepte `factures`), seed, tests, `e2e/invoices.spec.ts`.

## Échecs probables + parade
- **Refactor qui casse les devis** → lancer TOUTE la suite avant/après ; interdiction de modifier les assertions des tests 07/08.
- **Snapshot oublié dans le PDF** → test `[I]` dédié : émettre, modifier le nom du client, régénérer le PDF-input → nom = snapshot.
- **`overdue` stocké par erreur** → revue : aucun UPDATE ne doit écrire "overdue" ; c'est un filtre/affichage (core : `isOverdue(invoice)`).
- **Deux séquences mélangées** → test : émettre 1 devis + 1 facture → DEV-…-0001 et FAC-…-0001 indépendants.

## Done
- `[I]` issueInvoice (snapshot figé, séquence propre, update/delete refusés après émission) ; stats client justes sur jeu contrôlé.
- `[U]` isOverdue (échue+impayée oui ; échue+payée non ; brouillon non).
- `[E]` créer → émettre → PDF (échéance + IBAN visibles) ; liste filtre "En retard" ; fiche client affiche CA réel.
- Suite devis toujours verte.

## Quand s'arrêter
Pas de paiements réels (15), pas d'envoi (14), pas d'avoir (18), pas de QR (13), pas de conversion (17). Le tab "Avoirs" existe mais vide.
