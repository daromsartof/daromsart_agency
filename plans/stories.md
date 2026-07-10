# User stories — verticales, 1 story = 1 PR, ordonnées par dépendance

> Détail d'exécution : `story-NN.md`. Écrans : `ecrans.md`. Chaque story livre un incrément **utilisable et testé** (critères d'acceptation = tests à écrire dans la PR : `[U]` unitaire Vitest, `[I]` intégration (server actions + DB de test), `[E]` e2e Playwright, `[M]` manuel documenté dans la PR).
> Branches : `story/NN-slug`. Une story n'est "done" que si `pnpm build && pnpm test` passent à la racine.

| # | Story | Écrans | Dépend de |
|---|-------|--------|-----------|
| 01 | Scaffold monorepo + packages fondation (config, theme, ui) | – | – |
| 02 | App invoiceflow-ai + AppShell + thème + dark mode | E-05 | 01 |
| 03 | Base de données + Better Auth (connexion, reset, seed) | E-01..E-03, E-33 | 02 |
| 04 | Paramètres entreprise + upload logo (storage) | E-20 | 03 |
| 05 | Clients : liste + CRUD | E-07, E-08 | 03 |
| 06 | Fiche client | E-09 | 05 |
| 07 | Devis : éditeur + liste (brouillons) + moteur de totaux | E-10, E-11 | 05 |
| 08 | Devis : émission (numérotation), PDF, page détail | E-12 | 07, 04 |
| 09 | Modèles de documents (CRUD + éditeur avec aperçu live) | E-18, E-19 | 08 |
| 10 | Envoi de devis par email | E-13, E-28 | 08 |
| 11 | Page publique devis + signature | E-25, E-27, E-31 | 10 |
| 12 | Factures : éditeur, liste, émission, PDF, détail | E-14, E-11, E-16 | 08 |
| 13 | QR codes (paiement EPC + lien public) sur les PDF | (PDF) | 12 |
| 14 | Envoi de facture par email + page publique facture | E-13, E-26, E-29 | 12, 10 |
| 15 | Paiements + statuts payé / partiel / en retard | E-17, E-16 | 12 |
| 16 | Relance manuelle des factures en retard | E-30 | 15, 14 |
| 17 | Conversion devis → facture | E-12, E-11 | 12, 11 |
| 18 | Avoirs (notes de crédit) | E-11, E-16 | 15 |
| 19 | Dashboard | E-06 | 15 |
| 20 | Webhooks Resend + historique des emails | E-12/E-16 (tab Emails) | 14 |
| 21 | Équipe : rôles, invitations | E-23, E-04, E-32 | 03 |
| 22 | Paramètres : facturation, emails, mon compte | E-21, E-22, E-24 | 08, 10 |
| 23 | Durcissement : états vides/chargement/erreurs, seed riche, e2e | tous | toutes |

---

## Récapitulatif des stories (titre + critères d'acceptation clés)

### 01 — Scaffold monorepo + packages fondation
Workspace pnpm+turbo opérationnel ; `@daromsart/config`, `@daromsart/theme` (tokens + preset), `@daromsart/ui` (ShadCN init + DataTable/PageHeader/EmptyState/StatCard/StatusBadge/MoneyInput/ConfirmDialog).
CA : `pnpm install && pnpm build && pnpm lint` verts à la racine `[M]` ; `[U]` sur `MoneyInput` parsing ; tokens light+dark présents et consommés par le preset `[U]` (snapshot).

### 02 — App + AppShell + dark mode
App Next.js `apps/invoiceflow-ai` branchée sur theme/ui, AppShell complet (sidebar, topbar, responsive), `next-themes`, pages placeholder pour toute la nav, `error.tsx`/`not-found.tsx`/`loading.tsx` racine.
CA : `[E]` la nav affiche 6 entrées et chaque lien répond 200 ; `[E]` toggle dark persiste après reload ; `[M]` mobile : sidebar en Sheet.

### 03 — DB + Better Auth
Docker Postgres, Drizzle configuré, schéma auth + `organizations` + `memberships`, Better Auth (email/password, signup public OFF), pages connexion/oubli/reset, middleware de protection, seed (org + admin depuis env).
CA : `[E]` login seed → dashboard ; mauvais mdp → erreur ; `[E]` route (app) sans session → redirect `/connexion` ; `[I]` reset : token consommé une seule fois ; `[U]` env validée par zod (boot échoue si var manquante).

### 04 — Paramètres entreprise + logo
Page `/parametres/entreprise` complète, `@daromsart/storage` (fs + s3), upload logo, mentions par défaut FR, guard admin.
CA : `[I]` update org persiste tous les champs ; `[I]` upload logo → key stockée, fichier lisible via URL signée ; `[E]` member → redirect hors paramètres ; `[U]` validation IBAN/BIC format.

### 05 — Clients CRUD
Liste + recherche + pagination, Sheet création/édition, contacts additionnels, archivage (jamais de hard delete si documents), toasts.
CA : `[I]` create/update/archive + unicité raisonnable ; `[E]` créer un client depuis la liste → il apparaît sans reload ; `[E]` recherche filtre ; `[I]` client archivé exclu par défaut, inclus avec le switch.

### 06 — Fiche client
Header + stats (0 € tant que pas de docs), tabs Infos/Activité (Devis/Factures branchées par 07/12), édition via le Sheet de 05.
CA : `[E]` navigation liste → fiche → édition → retour ; `[I]` stats calculées justes sur données seed ; 404 propre sur id inconnu `[E]`.

### 07 — Devis : éditeur + liste + totaux
`@daromsart/core` : Money, computeDocumentTotals, machine à états — **couvert unitairement**. Éditeur complet (lignes dynamiques, réordonnancement, remises, panneau totaux live), liste avec tabs-filtres, suppression brouillon. Tab "Devis" de la fiche client.
CA : `[U]` totaux : 12 cas (multi-taux, remise ligne+globale %/€, arrondis par taux, qté décimale) ; `[U]` transitions de statut invalides rejetées ; `[I]` create/update draft recalcule les totaux serveur (jamais confiance client) ; `[E]` créer un devis 3 lignes → totaux affichés = attendus ; `[E]` un devis non-draft n'est pas éditable (redirect).

### 08 — Devis : émission + PDF + détail
`NumberSequence` transactionnelle, action `issueQuote`, `@daromsart/pdf` (rendu A4 complet FR), route PDF authentifiée, page détail (aperçu, panneau statut, actions, duplication).
CA : `[I]` 20 émissions concurrentes → 20 numéros consécutifs sans trou ni doublon ; `[I]` émission fige les lignes (update refusé ensuite) ; `[E]` "Émettre" → numéro visible + PDF s'affiche ; `[U]` formatDocumentNumber tokens ; `[M]` PDF : logo, adresses, lignes, TVA par taux, mentions, checklist visuelle dans la PR.

### 09 — Modèles de documents
CRUD modèles, éditeur split avec aperçu live (données factices), options de rendu appliquées par `@daromsart/pdf`, défaut par type, garde anti-suppression si utilisé.
CA : `[I]` un seul défaut par type (setter atomique) ; `[E]` changer la couleur d'accent → aperçu mis à jour ; `[I]` nouveau devis prend le modèle par défaut ; `[I]` suppression refusée si référencé.

### 10 — Envoi de devis par email
`@daromsart/email` (Resend + React Email, layout brandé), dialog d'envoi (destinataires multiples, corps templétisé variables), pièce jointe PDF, EmailLog, DocumentEvent, émission auto si brouillon.
CA : `[I]` envoi → EmailLog `sent` + event + statut devis `sent` ; `[U]` résolution des variables `{client}/{numero}/{total}/{lien}` ; `[E]` dialog pré-rempli avec l'email client ; `[M]` email reçu (Resend test) : rendu + PDF joint OK.

### 11 — Page publique devis + signature
Route `/p/devis/[token]`, visionneuse + PDF public, marquage `viewed`, panneau signature (canvas), refus avec motif, PDF signé archivé (hash SHA-256 + page de signature), emails de confirmation, états signé/refusé/expiré/invalide.
CA : `[I]` signature → Signature créée, statut `signed`, PDF signé stocké, hash vérifiable ; `[I]` re-signature refusée ; `[I]` token inconnu → page invalide (pas de 500, pas d'info) ; `[E]` parcours complet : envoyer → ouvrir lien → signer → détail affiche "Signé" ; `[I]` devis expiré → signature bloquée.

### 12 — Factures : bout en bout
Réutilisation du module documents : éditeur (échéance), liste (tabs + mini-stats), émission avec **snapshot** émetteur/client, PDF facture, détail. Tab "Factures" de la fiche client.
CA : `[I]` snapshot figé (modifier le client après émission ne change pas le PDF) ; `[I]` séquence FAC indépendante de DEV ; `[E]` créer → émettre → PDF ; `[U]` overdue calculé (échéance hier + reste dû > 0) ; `[E]` liste filtre par statut.

### 13 — QR codes
`@daromsart/qr` : payload EPC069-12 + rendu PNG/SVG ; QR paiement (si IBAN org) + QR lien public sur PDF facture, QR lien sur PDF devis, switches dans le modèle.
CA : `[U]` payload EPC exact sur cas connu (montant, IBAN, remittance = numéro) ; `[U]` montant > 999 999 999,99 → QR paiement omis ; `[I]` PDF contient les QR si options actives, aucun sinon ; `[M]` scan réel du QR EPC par une app bancaire.

### 14 — Envoi facture + page publique facture
Dialog d'envoi réutilisé, email facture, `/p/factures/[token]` (consultation, téléchargement, bloc virement IBAN + QR EPC), marquage viewed.
CA : `[I]` envoi → statut `sent` + EmailLog ; `[E]` page publique affiche montant/échéance + télécharge le PDF ; `[I]` facture payée → bannière "réglée" ; token invalide → page E-27 `[I]`.

### 15 — Paiements
Dialog paiement, recalcul `amount_paid_cents`, transitions `partially_paid`/`paid`, encart paiements du détail, suppression d'un paiement (admin) avec recalcul.
CA : `[I]` paiement partiel → `partially_paid`, solde → `paid` + `paid_at` ; `[I]` montant > reste dû rejeté ; `[I]` paiement sur draft/cancelled rejeté ; `[E]` enregistrer un paiement soldant → badge "Payée".

### 16 — Relance manuelle
Bouton Relancer (détail + liste factures en retard), email de relance pré-rempli, `last_reminder_at`, event `reminded`.
CA : `[I]` relance → EmailLog kind=reminder + event ; `[I]` relance impossible si non en retard ; `[E]` bouton visible uniquement en retard.

### 17 — Conversion devis → facture
Action convertir (signé direct ; envoyé avec confirmation), copie lignes/remises/notes/template, liens croisés, devis `invoiced` à l'émission de la facture.
CA : `[I]` conversion copie tout à l'identique (totaux égaux) ; `[I]` double conversion refusée ; `[E]` devis signé → Convertir → éditeur facture pré-rempli → émettre → devis affiche "Facturé" + lien.

### 18 — Avoirs
Création depuis facture émise (lignes inversées éditables), séquence AV, PDF "AVOIR" visuellement distinct, avoir total → facture `cancelled`, liste tab Avoirs.
CA : `[U]` totaux négatifs corrects ; `[I]` avoir sur brouillon refusé ; `[I]` avoir total → parent `cancelled` ; `[I]` cumul avoirs ≤ total parent ; `[E]` créer un avoir total → facture affichée annulée.

### 19 — Dashboard
Stats agrégées (encaissé année, en attente, en retard, devis en cours), bar chart CA 12 mois (recharts, brief dataviz), listes retard/derniers devis/activité.
CA : `[I]` agrégats justes sur jeu de données seed contrôlé (avoirs déduits, avoirs/brouillons exclus de l'encours) ; `[E]` dashboard se charge < 2 s avec seed, liens des listes fonctionnent ; empty state global `[E]`.

### 20 — Webhooks Resend
Route webhook (signature svix vérifiée), mise à jour EmailLog (delivered/opened/bounced), events, tab Emails avec badges de statut, alerte bounce sur le détail.
CA : `[I]` payloads simulés delivered/opened/bounced → statuts mis à jour, idempotent (replay sans doublon) ; `[I]` signature invalide → 401 ; `[E]` tab Emails affiche le statut.

### 21 — Équipe
Invitations (create/renvoyer/révoquer, expiration 7 j), page `/invitation/[token]`, email d'invitation, gestion des rôles, garde-fous (dernier admin, soi-même).
CA : `[I]` cycle invitation → acceptation → membership `member` ; `[I]` token expiré/consommé refusé ; `[I]` rétrogradation du dernier admin refusée ; `[E]` parcours invitation complet ; `[E]` member ne voit pas Paramètres (sauf Compte).

### 22 — Paramètres facturation + emails + compte
Numérotation configurable (aperçu live, validation format), TVA (taux actifs, défaut, franchise 293 B), délais par défaut, textes d'emails avec variables, mon compte (nom, mot de passe, thème).
CA : `[U]` parseur de format de numérotation (tokens valides/invalides) ; `[I]` franchise → nouveaux documents à 0 % + mention auto ; `[I]` texte d'email custom utilisé au prochain envoi ; `[E]` changement de mot de passe → reconnexion OK.

### 23 — Durcissement
Passe transverse : tous les empty/loading/error states, 404 par entité, seed démo riche (30 clients, 40 devis, 60 factures sur 14 mois, tous statuts), suite e2e smoke (login → client → devis → envoi → signature → conversion → paiement), README racine (setup, scripts, env), audit accès (chaque action revérifie org+rôle).
CA : `[E]` suite smoke verte en CI locale ; `[M]` grille de revue : chaque écran de `ecrans.md` a ses états ; `[I]` fuzz léger : actions avec ids d'une autre org → refus systématique.
